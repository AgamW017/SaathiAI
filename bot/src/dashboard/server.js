import express from 'express';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../../public');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DashboardServer {
  constructor({ config, stats, store, logger, onboardingRetryService = null }) {
    this.config = config;
    this.stats = stats;
    this.store = store;
    this.logger = logger;
    this.onboardingRetryService = onboardingRetryService;

    // ── Single Dashboard and WebSocket server ───────────────────────────
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, { cors: { origin: '*' } });

    // Live state: current QR code data URL and connection status
    this._currentQr = null;
    this._connectionStatus = 'initializing';

    // Callback for sending WhatsApp messages: (phone, text) => Promise<void>
    this._sendMessage = null;
  }

  /**
   * Set the callback used to send WhatsApp messages.
   * @param {function} fn - Async function: (phone: string, text: string) => Promise<void>
   */
  setSendMessage(fn) {
    this._sendMessage = fn;
  }

  configure() {
    this.app.use(express.static(publicDir));
    this.app.use(express.json({ limit: '512kb' }));

    this.app.get('/health', (_req, res) => {
      res.json({ ok: true, stats: this.stats.snapshot() });
    });

    this.app.get('/events', async (_req, res, next) => {
      try {
        res.json(await this.store.recentEvents(100));
      } catch (error) {
        next(error);
      }
    });

    this.app.get('/card/:id', async (req, res, next) => {
      try {
        const card = await this.store.getSkillCardById(req.params.id);
        if (!card) {
          res.status(404).send('Skill Card not found');
          return;
        }
        res.send(renderSkillCard(card));
      } catch (error) {
        next(error);
      }
    });

    // ── /status — returns bot connection state + QR ────
    this.app.get('/status', (_req, res) => {
      res.json({
        status: this._connectionStatus,
        connected: this._connectionStatus === 'ready',
        qr: this._currentQr,
        stats: this.stats.snapshot(),
      });
    });

    // ── Internal API: Send Ping ─────────────────────────────────────────
    this.app.post('/internal/send-ping', async (req, res) => {
      try {
        const { learnerId, message, senderName, source } = req.body;

        if (!learnerId || !message || !senderName) {
          res.status(400).json({ success: false, error: 'Missing required fields: learnerId, message, senderName' });
          return;
        }

        if (message.length > 1000) {
          res.status(400).json({ success: false, error: 'Message exceeds maximum length of 1000 characters' });
          return;
        }

        if (!this._sendMessage) {
          res.status(503).json({ success: false, error: 'WhatsApp client not ready' });
          return;
        }

        // Look up learner phone
        const learner = await this.store.queryOne(
          'SELECT id, phone FROM learners WHERE id = $1',
          [learnerId]
        );

        if (!learner) {
          res.status(404).json({ success: false, error: 'Learner not found' });
          return;
        }

        // Format and deliver message
        const formattedMessage = `[${senderName}] says: ${message}`;
        try {
          await this._sendMessage(learner.phone, formattedMessage);
        } catch (deliveryError) {
          this.logger.error({ learnerId, err: deliveryError.message }, 'Failed to deliver ping via WhatsApp');

          // Update message status to 'failed' if we have a message record
          await this.store.query(
            `UPDATE messages SET status = 'failed' WHERE receiver_learner_id = $1 AND content = $2 AND status = 'sent' ORDER BY created_at DESC LIMIT 1`,
            [learnerId, message]
          );

          res.status(502).json({ success: false, error: 'WhatsApp delivery failed' });
          return;
        }

        // Generate a simple message ID for tracking
        const messageId = crypto.randomUUID();

        this.logger.info({ learnerId, senderName, source, messageId }, 'Ping delivered via WhatsApp');
        res.json({ success: true, messageId });
      } catch (error) {
        this.logger.error({ err: error.message }, 'Internal send-ping error');
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });

    // ── Internal API: Broadcast Vacancy Notifications ──────────────────────
    this.app.post('/internal/broadcast', async (req, res) => {
      try {
        const { learnerIds, vacancy, employer_id } = req.body;

        if (!Array.isArray(learnerIds) || learnerIds.length === 0) {
          res.status(400).json({ success: false, error: 'Missing or empty learnerIds array' });
          return;
        }

        if (!vacancy || !vacancy.id || !vacancy.title) {
          res.status(400).json({ success: false, error: 'Missing vacancy info (id, title)' });
          return;
        }

        if (!this._sendMessage) {
          res.status(503).json({ success: false, error: 'WhatsApp client not ready' });
          return;
        }

        // Look up phone numbers for all learner IDs
        const placeholders = learnerIds.map((_, i) => `$${i + 1}`).join(', ');
        const learners = await this.store.query(
          `SELECT id, phone, full_name FROM learners WHERE id IN (${placeholders})`,
          learnerIds
        );

        if (!learners || learners.length === 0) {
          res.json({ success: true, total: 0, sent: 0, failed: 0 });
          return;
        }

        let sent = 0;
        let failed = 0;

        // Get employer company name for attribution
        let companyName = 'Employer';
        if (employer_id) {
          const employer = await this.store.queryOne(
            `SELECT company_name FROM employers WHERE id = $1`,
            [employer_id]
          );
          if (employer?.company_name) {
            companyName = employer.company_name;
          }
        }

        const notificationMessage = `🔔 नई Job Alert!\n\n*${vacancy.title}*\nCompany: ${companyName}\n\nयह job आपके trade से match करती है। अगर interested हैं तो "JOBS" लिखें।\n\n- SaathiAI`;

        for (let i = 0; i < learners.length; i++) {
          const learner = learners[i];

          if (!learner.phone) {
            failed += 1;
            this.logger.warn({ learnerId: learner.id }, 'Skipping learner: no phone number');
            continue;
          }

          try {
            await this._sendMessage(learner.phone, notificationMessage);
            sent += 1;
            this.logger.info({ learnerId: learner.id, vacancyId: vacancy.id, phone: learner.phone }, 'Broadcast notification sent');
          } catch (deliveryError) {
            failed += 1;
            this.logger.error({ learnerId: learner.id, phone: learner.phone, err: deliveryError.message }, 'Broadcast notification delivery failed');
          }

          // Stagger: 1 second between messages to avoid rate limiting
          if (i < learners.length - 1) {
            await sleep(1000);
          }
        }

        this.logger.info({ vacancyId: vacancy.id, total: learners.length, sent, failed }, 'Broadcast complete');
        res.json({ success: true, total: learners.length, sent, failed });
      } catch (error) {
        this.logger.error({ err: error.message }, 'Internal broadcast error');
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });

    // ── Internal API: Trigger Onboarding ─────────────────────────────────
    this.app.post('/internal/trigger-onboarding', async (req, res) => {
      try {
        const { learners } = req.body;

        if (!Array.isArray(learners) || learners.length === 0) {
          res.status(400).json({ success: false, error: 'Missing or empty learners array' });
          return;
        }

        if (!this._sendMessage) {
          res.status(503).json({ success: false, error: 'WhatsApp client not ready' });
          return;
        }

        const results = [];
        let sent = 0;
        let failed = 0;

        const welcomeMessage = 'Namaste! 🙏 Main SaathiAI hoon — aapka career companion. Main aapko jobs dhundne, skill card banane, aur interviews ki taiyaari mein madad karunga. Chaliye shuru karte hain!';

        for (let i = 0; i < learners.length; i++) {
          const learner = learners[i];

          if (!learner.phone) {
            results.push({ learnerId: learner.id, status: 'failed', error: 'Missing phone number' });
            failed += 1;
            continue;
          }

          try {
            await this._sendMessage(learner.phone, welcomeMessage);
            results.push({ learnerId: learner.id, status: 'sent' });
            sent += 1;
            this.logger.info({ learnerId: learner.id, phone: learner.phone }, 'Onboarding message sent');
          } catch (deliveryError) {
            results.push({ learnerId: learner.id, status: 'failed', error: deliveryError.message });
            failed += 1;
            this.logger.error({ learnerId: learner.id, phone: learner.phone, err: deliveryError.message }, 'Onboarding message delivery failed');

            // Record failure for retry logic
            if (this.onboardingRetryService && learner.id) {
              try {
                await this.onboardingRetryService.recordFailure(learner.id, learner.phone, deliveryError.message);
              } catch (retryErr) {
                this.logger.error({ learnerId: learner.id, err: retryErr.message }, 'Failed to record onboarding failure for retry');
              }
            }
          }

          // Stagger dispatch: wait 1 second between messages (max 1 msg/sec)
          if (i < learners.length - 1) {
            await sleep(1000);
          }
        }

        res.json({ total: learners.length, sent, failed, results });
      } catch (error) {
        this.logger.error({ err: error.message }, 'Internal trigger-onboarding error');
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });

    // ── Internal API: Update Message Status ────────────────────────────────
    // Called when delivery status changes (e.g., delivered, read, failed)
    // from WhatsApp delivery receipts or other status callbacks.
    // Requirements: 4.3, 4.7
    this.app.post('/internal/update-message-status', async (req, res) => {
      try {
        const { messageId, status } = req.body;

        if (!messageId || !status) {
          res.status(400).json({ success: false, error: 'Missing required fields: messageId, status' });
          return;
        }

        const validStatuses = ['sent', 'delivered', 'read', 'failed'];
        if (!validStatuses.includes(status)) {
          res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
          return;
        }

        const result = await this.store.query(
          `UPDATE messages SET status = $1 WHERE id = $2 RETURNING id, status`,
          [status, messageId]
        );

        if (!result || result.length === 0) {
          res.status(404).json({ success: false, error: 'Message not found' });
          return;
        }

        this.logger.info({ messageId, status }, 'Message status updated');
        res.json({ success: true, messageId, status });
      } catch (error) {
        this.logger.error({ err: error.message }, 'Internal update-message-status error');
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });

    this.io.on('connection', (socket) => {
      this.logger.info('Dashboard client connected');
      socket.emit('bot_status', {
        status: this._connectionStatus,
        connected: this._connectionStatus === 'ready',
        qr: this._currentQr,
      });
      socket.emit('stats', this.stats.snapshot());
      socket.emit('log', 'Dashboard connected');
    });
  }

  /**
   * Updates the stored QR code and broadcasts it to WS clients.
   */
  setQr(qrDataUrl) {
    this._currentQr = qrDataUrl;
    this._connectionStatus = 'awaiting_scan';
    this.io.emit('bot_status', {
      status: 'awaiting_scan',
      connected: false,
      qr: qrDataUrl,
    });
  }

  /**
   * Updates the bot connection status and notifies clients.
   */
  setConnectionStatus(status) {
    this._connectionStatus = status;
    if (status === 'ready' || status === 'authenticated') {
      this._currentQr = null; // Clear QR once connected
    }
    this.io.emit('bot_status', {
      status,
      connected: status === 'ready',
      qr: this._currentQr,
    });
  }

  emit(event, payload) {
    this.io.emit(event, payload);
  }

  start() {
    this.configure();

    this.server.listen(this.config.port, () => {
      this.logger.info({ port: this.config.port }, 'Dashboard listening');
    });
  }
}

function renderSkillCard(card) {
  const skills = (card.skills ?? []).map((skill) => `<li>${escapeHtml(skill)}</li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(card.name)} - SaathiAI Skill Card</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f7f3eb; color: #17201b; }
    main { max-width: 720px; margin: 0 auto; padding: 28px 18px; }
    .card { background: #fff; border: 1px solid #d8ded6; border-radius: 8px; padding: 22px; box-shadow: 0 8px 24px rgba(0,0,0,.06); }
    h1 { margin: 0 0 4px; font-size: 28px; }
    .muted { color: #59645d; }
    .badge { display: inline-block; margin: 14px 0; padding: 6px 10px; border-radius: 999px; background: #e7f6ec; color: #126b35; font-weight: 700; }
    dl { display: grid; grid-template-columns: 130px 1fr; gap: 10px; }
    dt { color: #59645d; }
    dd { margin: 0; font-weight: 700; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <p class="muted">SaathiAI Skill Card</p>
      <h1>${escapeHtml(card.name)}</h1>
      <div class="badge">${escapeHtml(card.verificationStatus)}</div>
      <dl>
        <dt>Trade</dt><dd>${escapeHtml(card.trade)}</dd>
        <dt>Location</dt><dd>${escapeHtml(card.district)}, ${escapeHtml(card.state ?? '')}</dd>
        <dt>Certificate</dt><dd>${escapeHtml(card.certificateType)}</dd>
      </dl>
      <h2>Skills</h2>
      <ul>${skills}</ul>
      <p class="muted">Generated ${escapeHtml(new Date(card.createdAt).toLocaleString('en-IN'))}</p>
    </section>
  </main>
</body>
</html>`;
}

function escapeHtml(value = '') {
  return value
    .toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
