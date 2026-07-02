import { Router } from 'express';
import multer from 'multer';
import { requireBotSecret } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { BotEventSchema } from '../schemas/index.js';
import { recordBotEvent, getRecentEvents } from '../services/eventService.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generateAadhaarOtp, verifyAadhaarOtp } from '../services/sandboxService.js';
import { DocumentParserService } from '../services/documentParserService.js';
import { fetchJobsForLearner } from '../services/sidhScrapingService.js';

const demoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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

/**
 * @openapi
 * /internal/jobs/search:
 *   post:
 *     summary: Fetch relevant SIDH job listings for a learner
 *     description: >
 *       Classifies the learner's job title into a SIDH sector via LLM, then
 *       scrapes Skill India Digital Hub for active job listings in that sector
 *       and state. Excludes recommendation-section cards.
 *     tags: [Internal]
 *     security: [{ botSecret: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [jobTitle, state]
 *             properties:
 *               jobTitle:
 *                 type: string
 *                 description: The learner's job title or trade (e.g. "electrician", "NAPS Trainee")
 *               state:
 *                 type: string
 *                 description: Full state/UT name (e.g. "Andhra Pradesh", "Delhi")
 *               pageSize:
 *                 type: integer
 *                 default: 18
 *                 description: Number of listings to fetch (max 18 per SIDH page)
 *     responses:
 *       200:
 *         description: Job listings found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 sector: { type: string }
 *                 totalJobs: { type: integer }
 *                 jobs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title: { type: string, nullable: true }
 *                       company: { type: string, nullable: true }
 *                       cardTag: { type: string, nullable: true }
 *                       via: { type: string, nullable: true }
 *                       venue: { type: string, nullable: true }
 *                       date: { type: string, nullable: true }
 *                       location: { type: string, nullable: true }
 *                       sector: { type: string, nullable: true }
 *                       employmentType: { type: string, nullable: true }
 *                       joiningType: { type: string, nullable: true }
 *                       salaryText: { type: string, nullable: true }
 */
internalRouter.post(
  '/jobs/search',
  requireBotSecret,
  async (req, res) => {
    const { jobTitle, state, pageSize } = req.body as {
      jobTitle?: string;
      state?: string;
      pageSize?: number;
    };

    if (!jobTitle || typeof jobTitle !== 'string' || !jobTitle.trim()) {
      res.status(400).json({ error: 'jobTitle is required and must be a non-empty string' });
      return;
    }
    if (!state || typeof state !== 'string' || !state.trim()) {
      res.status(400).json({ error: 'state is required and must be a non-empty string' });
      return;
    }

    const clampedPageSize =
      typeof pageSize === 'number' && pageSize > 0 ? Math.min(pageSize, 18) : 18;

    try {
      const result = await fetchJobsForLearner(jobTitle.trim(), state.trim(), clampedPageSize);
      res.status(200).json({
        ok: true,
        sector: result.sector,
        totalJobs: result.jobs.length,
        jobs: result.jobs,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: `SIDH job fetch failed: ${message}` });
    }
  }
);

/**
 * POST /admin/docling-demo
 * No auth — demo-only endpoint for presentation use.
 * Accepts a file upload, runs it through Docling, returns raw markdown text.
 */
internalRouter.post(
  '/docling-demo',
  demoUpload.single('file'),
  async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    try {
      const parser = new DocumentParserService();
      const result = await parser.parseDocument(file.buffer, file.mimetype, file.originalname);
      res.json({ markdown: result.text, pages: result.pages ?? null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Docling parse failed: ${message}` });
    }
  }
);
