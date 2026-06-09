import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { PlacementCreateSchema } from '../schemas/index.js';
import { confirmPlacement } from '../services/placementService.js';

export const placementsRouter = Router();

/**
 * @openapi
 * /placements:
 *   post:
 *     summary: Confirm a learner placement
 *     tags: [Placements]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [learner_id, job_id, placement_date]
 *             properties:
 *               learner_id: { type: string, format: uuid }
 *               job_id: { type: string, format: uuid }
 *               placement_date: { type: string, format: date }
 *               salary: { type: number }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Placement confirmed
 */
placementsRouter.post(
  '/',
  authenticate,
  authorize('officer', 'dssdo', 'admin'),
  validateBody(PlacementCreateSchema),
  async (req, res) => {
    const placement = await confirmPlacement(req.body, req.user!.sub);
    res.status(201).json(placement);
  }
);
