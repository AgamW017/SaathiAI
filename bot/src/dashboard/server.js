import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../../public');

export class DashboardServer {
  constructor({ config, stats, store, logger }) {
    this.config = config;
    this.stats = stats;
    this.store = store;
    this.logger = logger;

    // ── Single Dashboard and WebSocket server ───────────────────────────
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, { cors: { origin: '*' } });

    // Live state: current QR code data URL and connection status
    this._currentQr = null;
    this._connectionStatus = 'initializing';
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
