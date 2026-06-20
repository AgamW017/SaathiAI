import { Router } from 'express';
import { requireBotSecret } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { BotEventSchema } from '../schemas/index.js';
import { recordBotEvent, getRecentEvents } from '../services/eventService.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generateAadhaarOtp, verifyAadhaarOtp } from '../services/sandboxService.js';
import { DocumentParserService } from '../services/documentParserService.js';

export const internalRouter = Router();

/**
 * @openapi
 * /internal/bot-events:
 *   post:
 *     summary: Receive an event from the bot server
 *     tags: [Internal]
 *     security: [{ botSecret: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [event_type]
 *             properties:
 *               event_type: { type: string }
 *               learner_id: { type: string, format: uuid }
 *               phone: { type: string }
 *               metadata: { type: object }
 */
internalRouter.post(
  '/bot-events',
  requireBotSecret,
  validateBody(BotEventSchema),
  async (req, res) => {
    const event = await recordBotEvent(req.body);
    res.status(201).json({ id: event.id, recorded: true });
  }
);

/**
 * @openapi
 * /admin/bot-status:
 *   get:
 *     summary: Get bot connection status and QR code
 *     tags: [Admin]
 *     security: []
 */
internalRouter.get(
  '/bot-status',
  async (_req, res) => {
    // Bot status is fetched from bot's /status endpoint
    // Backend acts as a proxy to avoid CORS issues
    const botUrl = process.env.BOT_INTERNAL_URL ?? 'http://localhost:3000';
    try {
      const resp = await fetch(`${botUrl}/status`);
      if (!resp.ok) {
        res.status(502).json({ error: 'Bot returned an error', status: 'error', connected: false, qr: null });
        return;
      }
      const data = await resp.json();
      res.json(data);
    } catch {
      res.status(503).json({ error: 'Bot service is unreachable', status: 'unreachable', connected: false, qr: null });
    }
  }
);

/**
 * @openapi
 * /admin/events:
 *   get:
 *     summary: Get recent bot events (audit log)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 */
internalRouter.get(
  '/events',
  authenticate,
  authorize('admin', 'dssdo'),
  async (req, res) => {
    const limit = Number(req.query.limit) || 50;
    const events = await getRecentEvents(Math.min(limit, 200));
    res.json(events);
  }
);

/**
 * @openapi
 * /internal/kyc/aadhaar-otp:
 *   post:
 *     summary: Generate an Aadhaar OTP via Sandbox
 *     tags: [Internal]
 *     security: [{ botSecret: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [aadhaarNumber]
 *             properties:
 *               aadhaarNumber: { type: string, pattern: '^\d{12}$' }
 */
internalRouter.post(
  '/kyc/aadhaar-otp',
  requireBotSecret,
  async (req, res) => {
    const { aadhaarNumber } = req.body as { aadhaarNumber?: string };
    if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber)) {
      res.status(400).json({ error: 'aadhaarNumber must be exactly 12 digits' });
      return;
    }
    try {
      const result = await generateAadhaarOtp(aadhaarNumber);
      res.status(200).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: `Sandbox OTP generation failed: ${message}` });
    }
  }
);

/**
 * @openapi
 * /internal/kyc/aadhaar-verify:
 *   post:
 *     summary: Verify an Aadhaar OTP via Sandbox and return KYC data
 *     tags: [Internal]
 *     security: [{ botSecret: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [referenceId, otp]
 *             properties:
 *               referenceId: { type: string }
 *               otp: { type: string }
 */
internalRouter.post(
  '/kyc/aadhaar-verify',
  requireBotSecret,
  async (req, res) => {
    const { referenceId, otp } = req.body as { referenceId?: string; otp?: string };
    if (!referenceId || !otp) {
      res.status(400).json({ error: 'referenceId and otp are required' });
      return;
    }
    try {
      const result = await verifyAadhaarOtp(referenceId, otp);
      res.status(200).json(result);
    } catch (err) {
      const e = err as Error & { otpInvalid?: boolean };
      if (e.otpInvalid) {
        res.status(422).json({ error: 'otp_invalid', message: e.message });
        return;
      }
      res.status(502).json({ error: `Sandbox OTP verification failed: ${e.message ?? String(err)}` });
    }
  }
);

/**
 * @openapi
 * /internal/extract-aadhaar:
 *   post:
 *     summary: Extract 12-digit Aadhaar number from an uploaded image/PDF
 *     tags: [Internal]
 *     security: [{ botSecret: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fileBase64, mimeType]
 *             properties:
 *               fileBase64: { type: string, description: 'Base64-encoded file content' }
 *               mimeType: { type: string }
 *               filename: { type: string }
 */
internalRouter.post(
  '/extract-aadhaar',
  requireBotSecret,
  async (req, res) => {
    const { fileBase64, mimeType, filename } = req.body as {
      fileBase64?: string;
      mimeType?: string;
      filename?: string;
    };

    if (!fileBase64 || !mimeType) {
      res.status(400).json({ error: 'fileBase64 and mimeType are required' });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileBase64, 'base64');
    } catch {
      res.status(400).json({ error: 'fileBase64 is not valid base64' });
      return;
    }

    try {
      const parser = new DocumentParserService();
      const parsed = await parser.parseDocument(buffer, mimeType, filename ?? 'aadhaar');
      const text = parsed.text ?? '';

      // Match patterns like "1234 5678 9012", "1234-5678-9012", "123456789012"
      const match = text.match(/\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4})\b/);
      if (!match) {
        res.status(200).json({ aadhaarNumber: null });
        return;
      }

      const raw = match[1].replace(/[\s\-]/g, '');
      if (raw.length !== 12) {
        res.status(200).json({ aadhaarNumber: null });
        return;
      }

      res.status(200).json({ aadhaarNumber: raw });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: `Aadhaar extraction failed: ${message}` });
    }
  }
);
