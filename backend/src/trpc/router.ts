import { router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { dashboardRouter } from './routers/dashboard.js';
import { messagingRouter } from './routers/messaging.js';
import { cohortRouter } from './routers/cohort.js';
import { reportsRouter } from './routers/reports.js';
import { cohortsRouter } from './routers/cohorts.js';
import { employerRouter, publicSkillCardRouter } from './routers/employer.js';
import { officerRouter } from './routers/officer.js';

/**
 * Root tRPC router.
 * All procedures are accessible under their namespace:
 *   auth.*       — sign in, sign up, me, refresh, signout
 *   dashboard.*  — ITI officer dashboard (cohortStats, priorityInbox, etc.)
 *   messaging.*  — officer/employer ↔ learner ping messaging
 *   cohort.*     — cohort creation via document upload, listing, details
 *   cohorts.*    — ITI officer cohort CRUD management
 *   reports.*    — MIS report generation, listing, and download
 *   employer.*   — Employer portal (vacancies, pipeline, NAPS, analytics)
 *   skillCard.*  — Public skill card (no auth — token-validated)
 *   officer.*   — Officer onboarding (manual learner enrollment)
 */
export const appRouter = router({
  auth: authRouter,
  dashboard: dashboardRouter,
  messaging: messagingRouter,
  cohort: cohortRouter,
  cohorts: cohortsRouter,
  reports: reportsRouter,
  employer: employerRouter,
  skillCard: publicSkillCardRouter,
  officer: officerRouter,
});

/** Exported type — imported by the frontend to get full type safety */
export type AppRouter = typeof appRouter;
