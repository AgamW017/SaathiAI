import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { DistrictAnalyticsFilterSchema } from '../schemas/index.js';
import { getDashboardStats, getDistrictAnalytics } from '../services/analyticsService.js';
import type { DistrictAnalyticsFilter } from '../schemas/index.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

/**
 * @openapi
 * /dashboard/stats:
 *   get:
 *     summary: Aggregate dashboard statistics
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Placement and learner stats
 */
dashboardRouter.get(
  '/stats',
  authorize('officer', 'dssdo', 'admin'),
  async (_req, res) => {
    const stats = await getDashboardStats();
    res.json(stats);
  }
);

/**
 * @openapi
 * /district/analytics:
 *   get:
 *     summary: District-level placement analytics
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 */
dashboardRouter.get(
  '/district/analytics',
  authorize('dssdo', 'admin'),
  validateQuery(DistrictAnalyticsFilterSchema),
  async (req, res) => {
    const filters = (req as typeof req & { parsedQuery: DistrictAnalyticsFilter }).parsedQuery;
    const analytics = await getDistrictAnalytics(filters.district, filters.from, filters.to);
    res.json(analytics);
  }
);
