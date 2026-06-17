import WhatsAppWeb from 'whatsapp-web.js';
const { Client, LocalAuth } = WhatsAppWeb;
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import { EventTypes } from '../constants/steps.js';

export class WhatsAppBot {
  constructor({ config, engine, eventLog, stats, dashboard, logger }) {
    this.config = config;
    this.engine = engine;
    this.eventLog = eventLog;
    this.stats = stats;
    this.dashboard = dashboard;
    this.logger = logger;
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        ...(config.whatsapp.puppeteerExecutablePath
          ? { executablePath: config.whatsapp.puppeteerExecutablePath }
          : {}),
        args: config.whatsapp.puppeteerArgs,
        timeout: 60000
      }
    });
  }

  registerHandlers() {
    this.client.on('qr', async (qr) => {
      this.logger.info('QR code received');
      qrcodeTerminal.generate(qr, { small: true });
      this.dashboard.emit('log', 'QR code received, scan with WhatsApp');

      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        this.dashboard.emit('qr', qrDataUrl);
        // Also notify the admin WS server
        this.dashboard.setQr(qrDataUrl);
      } catch (error) {
        this.logger.error({ error }, 'Could not generate dashboard QR');
      }
    });

    this.client.on('authenticated', () => {
      this.logger.info('WhatsApp authenticated');
      this.dashboard.emit('authenticated');
      this.dashboard.emit('log', 'Authentication successful');
      this.stats.setStatus('authenticated');
      this.dashboard.setConnectionStatus('authenticated');
      this.dashboard.emit('stats', this.stats.snapshot());
    });

    this.client.on('ready', () => {
      this.logger.info('WhatsApp client ready');
      this.dashboard.emit('ready');
      this.dashboard.emit('log', 'Client is ready and listening for messages');
      this.stats.setStatus('ready');
      this.dashboard.setConnectionStatus('ready');
      this.dashboard.emit('stats', this.stats.snapshot());

      // Wire send capability into the dashboard's internal API endpoints
      this.dashboard.setSendMessage(async (phone, text) => {
        // The "phone" field in the DB can be:
        // 1. A 10-digit Indian mobile number (e.g. 9876543210)
        // 2. A 12-digit number with country code (e.g. 919876543210)
        // 3. A WhatsApp LID (Linked ID) — typically 13 digits (e.g. 7030878277806)
        let digits = phone.replace(/\D/g, '');

        let chatId;
        if (digits.length === 10 && /^[6-9]/.test(digits)) {
          // Standard 10-digit Indian mobile → prepend country code
          chatId = `91${digits}@c.us`;
        } else if (digits.length === 12 && digits.startsWith('91')) {
          // Already has country code
          chatId = `${digits}@c.us`;
        } else {
          // Likely a LID — use @lid suffix
          chatId = `${digits}@lid`;
        }

        this.logger.info({ phone, chatId }, 'Sending WhatsApp message');

        // For @c.us IDs, verify registration first
        if (chatId.endsWith('@c.us')) {
          const numberId = await this.client.getNumberId(chatId);
          if (!numberId) {
            throw new Error(`Phone ${digits} is not registered on WhatsApp`);
          }
          await this.client.sendMessage(numberId._serialized, text);
        } else {
          // LID-based — send directly
          await this.client.sendMessage(chatId, text);
        }
      });
    });

    this.client.on('auth_failure', (message) => {
      this.logger.error({ message }, 'WhatsApp authentication failure');
      this.dashboard.emit('log', `Authentication failure: ${message}`);
      this.stats.setStatus('auth_failure');
      this.dashboard.setConnectionStatus('auth_failure');
    });

    this.client.on('disconnected', (reason) => {
      this.logger.warn({ reason }, 'WhatsApp disconnected');
      this.dashboard.emit('log', `Disconnected: ${reason}`);
      this.stats.setStatus('disconnected');
      this.dashboard.setConnectionStatus('disconnected');
    });

    this.client.on('message', (message) => {
      this.handleMessage(message).catch((error) => {
        console.error('[DEBUG] Message handling failed:', error);
        this.logger.error({ error }, 'Message handling failed');
        this.dashboard.emit('log', `Message handling failed: ${error.message}`);
      });
    });
  }

  async initializeWithRetry(maxRetries = 3) {
    this.registerHandlers();

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        this.logger.info({ attempt, maxRetries }, 'Initializing WhatsApp client');
        this.dashboard.emit('log', `Initializing WhatsApp client (${attempt}/${maxRetries})`);
        this.stats.setStatus('initializing');
        await this.client.initialize();
        return;
      } catch (error) {
        console.error(error);
        this.logger.error({ error, attempt }, 'WhatsApp initialization failed');
        this.dashboard.emit('log', `Initialization failed: ${error}`);
        if (attempt === maxRetries) throw error;
        await sleep(10000);
      }
    }
  }

  async handleMessage(message) {
    if (message.fromMe) return;
    if (!(await this.shouldHandle(message))) return;

    this.stats.incrementMessages();
    this.dashboard.emit('stats', this.stats.snapshot());
    console.log('[DEBUG] handleMessage: processing message type=%s from=%s', message.type, message.from);

    let chat;
    try {
      chat = await message.getChat();
      await chat.sendStateTyping();
    } catch (error) {
      this.logger.warn({ error }, 'Failed to set typing state');
    }

    try {
      const isVoice = message.hasMedia && ['ptt', 'audio'].includes(message.type);
      const media = isVoice ? await message.downloadMedia() : null;
      const author = message.author ?? message.from;

      // Get quoted/replied-to message body if this is a reply
      let quotedBody = null;
      if (message.hasQuotedMsg) {
        try {
          const quoted = await message.getQuotedMessage();
          quotedBody = quoted?.body ?? null;
        } catch {
          // Non-critical — proceed without quote context
        }
      }

      const incoming = {
        phone: normalizeWhatsAppId(author),
        chatId: message.from,
        messageId: message.id?._serialized,
        body: cleanMessageBody(message.body ?? ''),
        type: message.type,
        isVoice,
        media,
        fromGroup: message.from.endsWith('@g.us'),
        quotedBody,
      };

      console.log('[DEBUG] calling processIncoming phone=%s step=%s', incoming.phone, 'unknown');
      const result = await this.engine.processIncoming(incoming);
      console.log('[DEBUG] processIncoming done, replies=%d duplicate=%s', result.replies?.length, result.duplicate);
      
      if (result.duplicate) return;

      for (const reply of result.replies) {
        if (reply.metadata?.debugReason) {
          this.dashboard.emit('log', `Voice transcription failed for ${result.session.phone}: ${reply.metadata.debugReason}`);
        }
        await message.reply(reply.text);
        this.stats.incrementSentMessages();
        await this.eventLog.record({
          learnerId: result.session.learnerId,
          phone: result.session.phone,
          eventType: EventTypes.MESSAGE_SENT,
          stepBefore: result.session.step,
          stepAfter: result.session.step,
          metadata: { kind: reply.type }
        });
      }

      this.dashboard.emit('stats', this.stats.snapshot());
    } finally {
      if (chat) {
        try {
          await chat.clearState();
        } catch (error) {
          this.logger.warn({ error }, 'Failed to clear typing state');
        }
      }
    }
  }

  async shouldHandle(message) {
    const isGroup = message.from.endsWith('@g.us');
    if (!isGroup) return true;

    const ownId = this.client.info?.wid?._serialized;
    if (!ownId) return false;
    return message.mentionedIds?.includes(ownId);
  }
}

function normalizeWhatsAppId(value = '') {
  return value.split('@')[0].replace(/\D/g, '');
}

function cleanMessageBody(value = '') {
  return value.replace(/@\d+/g, '').trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
