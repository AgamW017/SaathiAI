import { router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { dashboardRouter } from './routers/dashboard.js';
import { cohortsRouter } from './routers/cohorts.js';
import { employerRouter, publicSkillCardRouter } from './routers/employer.js';

/**
 * Root tRPC router.
 * All procedures are accessible under their namespace:
 *   auth.*          — sign in, sign up, me, refresh, signout
 *   dashboard.*     — ITI officer dashboard (cohortStats, priorityInbox, etc.)
 *   cohorts.*       — ITI officer cohort management
 *   employer.*      — Employer portal (vacancies, pipeline, NAPS, analytics)
 *   skillCard.*     — Public skill card (no auth — token-validated)
 */
export const appRouter = router({
  auth: authRouter,
  dashboard: dashboardRouter,
  cohorts: cohortsRouter,
  employer: employerRouter,
  skillCard: publicSkillCardRouter,
});

/** Exported type — imported by the frontend to get full type safety */
export type AppRouter = typeof appRouter;
