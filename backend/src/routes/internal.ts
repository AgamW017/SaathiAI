import { Router } from 'express';
import { requireBotSecret } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { BotEventSchema } from '../schemas/index.js';
import { recordBotEvent, getRecentEvents } from '../services/eventService.js';
import { authenticate, authorize } from '../middleware/auth.js';

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
      console.log(resp);
      const data = await resp.json();
      res.json(data);
    } catch {
      res.json({ status: 'unreachable', connected: false, qr: null });
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
