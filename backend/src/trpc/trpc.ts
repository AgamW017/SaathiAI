import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context.js';

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const middleware = t.middleware;

/** Open to anyone — no auth required */
export const publicProcedure = t.procedure;

/** Requires a valid Bearer JWT in the request */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Requires officer, dssdo, or admin role */
export const officerProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  const allowed = ['officer', 'dssdo', 'admin'] as const;
  if (!allowed.includes(ctx.user.role as typeof allowed[number])) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Officer or above required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Requires employer role */
export const employerProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  if (ctx.user.role !== 'employer') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Employer access required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
