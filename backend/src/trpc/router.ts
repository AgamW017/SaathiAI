import { router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { dashboardRouter } from './routers/dashboard.js';

/**
 * Root tRPC router.
 * All procedures are accessible under their namespace:
 *   auth.*     — sign in, sign up, me, refresh, signout
 *   dashboard.*  — ITI officer dashboard (cohortStats, priorityInbox, etc.)
 */
export const appRouter = router({
  auth: authRouter,
  dashboard: dashboardRouter,
});

/** Exported type — imported by the frontend to get full type safety */
export type AppRouter = typeof appRouter;
