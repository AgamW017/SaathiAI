/**
 * tRPC client for the SaathiAI frontend.
 *
 * Import `trpc` from this file wherever you need to call backend procedures.
 * All calls are fully type-safe — types come from the backend AppRouter.
 *
 * Usage:
 *   const { data } = trpc.dashboard.cohortStats.useQuery({ cohort: 'batch-1' });
 *   const signin = trpc.auth.signin.useMutation();
 */
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../../backend/src/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

export type { AppRouter };
