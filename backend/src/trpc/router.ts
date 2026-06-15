import { router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { dashboardRouter } from './routers/dashboard.js';
import { cohortsRouter } from './routers/cohorts.js';

/**
 * Root tRPC router.
 * All procedures are accessible under their namespace:
 *   auth.*     — sign in, sign up, me, refresh, signout
 *   dashboard.*  — ITI officer dashboard (cohortStats, priorityInbox, etc.)
 *   cohorts.*  — ITI officer cohort management
 */
export const appRouter = router({
  auth: authRouter,
  dashboard: dashboardRouter,
  cohorts: cohortsRouter,
});

/** Exported type — imported by the frontend to get full type safety */
export type AppRouter = typeof appRouter;
