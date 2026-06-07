import { Client, LocalAuth } from 'whatsapp-web.js';
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
        this.dashboard.emit('qr', await QRCode.toDataURL(qr));
      } catch (error) {
        this.logger.error({ error }, 'Could not generate dashboard QR');
      }
    });

    this.client.on('authenticated', () => {
      this.logger.info('WhatsApp authenticated');
      this.dashboard.emit('authenticated');
      this.dashboard.emit('log', 'Authentication successful');
      this.stats.setStatus('authenticated');
      this.dashboard.emit('stats', this.stats.snapshot());
    });

    this.client.on('ready', () => {
      this.logger.info('WhatsApp client ready');
      this.dashboard.emit('ready');
      this.dashboard.emit('log', 'Client is ready and listening for messages');
      this.stats.setStatus('ready');
      this.dashboard.emit('stats', this.stats.snapshot());
    });

    this.client.on('auth_failure', (message) => {
      this.logger.error({ message }, 'WhatsApp authentication failure');
      this.dashboard.emit('log', `Authentication failure: ${message}`);
      this.stats.setStatus('auth_failure');
    });

    this.client.on('disconnected', (reason) => {
      this.logger.warn({ reason }, 'WhatsApp disconnected');
      this.dashboard.emit('log', `Disconnected: ${reason}`);
      this.stats.setStatus('disconnected');
    });

    this.client.on('message', (message) => {
      this.handleMessage(message).catch((error) => {
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
        this.logger.error({ error, attempt }, 'WhatsApp initialization failed');
        this.dashboard.emit('log', `Initialization failed: ${error.message}`);
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

    const isVoice = message.hasMedia && ['ptt', 'audio'].includes(message.type);
    const media = isVoice ? await message.downloadMedia() : null;
    const author = message.author ?? message.from;
    const incoming = {
      phone: normalizeWhatsAppId(author),
      chatId: message.from,
      messageId: message.id?._serialized,
      body: cleanMessageBody(message.body ?? ''),
      type: message.type,
      isVoice,
      media,
      fromGroup: message.from.endsWith('@g.us')
    };

    const result = await this.engine.processIncoming(incoming);
    if (result.duplicate) return;

    for (const reply of result.replies) {
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
