import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { LearnerFilterSchema } from '../schemas/index.js';
import { getLearnerById, getLearners } from '../services/learnerService.js';

export const learnersRouter = Router();

// All learner endpoints require authentication + officer or dssdo role
learnersRouter.use(authenticate, authorize('officer', 'dssdo', 'admin'));

/**
 * @openapi
 * /learners:
 *   get:
 *     summary: List learners with optional filters
 *     tags: [Learners]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, placed, dropped, at_risk] }
 *       - in: query
 *         name: cohort
 *         schema: { type: string }
 *       - in: query
 *         name: risk_score_min
 *         schema: { type: number }
 *       - in: query
 *         name: risk_score_max
 *         schema: { type: number }
 *       - in: query
 *         name: district
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated learner list
 */
learnersRouter.get('/', validateQuery(LearnerFilterSchema), async (req, res) => {
  const filters = (req as typeof req & { parsedQuery: typeof LearnerFilterSchema._type }).parsedQuery;
  const result = await getLearners(filters);
  res.json(result);
});

/**
 * @openapi
 * /learners/{id}:
 *   get:
 *     summary: Get a single learner by ID
 *     tags: [Learners]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Learner profile
 *       404:
 *         description: Not found
 */
learnersRouter.get('/:id', async (req, res) => {
  const learner = await getLearnerById(req.params.id);
  res.json(learner);
});
