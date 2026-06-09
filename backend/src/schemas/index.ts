import { z } from 'zod';

// ─── Auth ──────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  password: z.string().min(8),
}).refine((d) => d.email || d.phone, {
  message: 'Either email or phone is required',
});

export const RefreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export const OAuthCallbackSchema = z.object({
  code: z.string().min(1),
  provider: z.enum(['google']),
});

// ─── Learners ──────────────────────────────────────────────────────────────

export const LearnerFilterSchema = z.object({
  status: z.enum(['active', 'placed', 'dropped', 'at_risk']).optional(),
  cohort: z.string().optional(),
  risk_score_min: z.coerce.number().min(0).max(100).optional(),
  risk_score_max: z.coerce.number().min(0).max(100).optional(),
  district: z.string().optional(),
  trade: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Placements ────────────────────────────────────────────────────────────

export const PlacementCreateSchema = z.object({
  learner_id: z.string().uuid(),
  job_id: z.string().uuid(),
  placement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  salary: z.number().positive().optional(),
  notes: z.string().max(1000).optional(),
});

// ─── Bot Events ────────────────────────────────────────────────────────────

export const BotEventSchema = z.object({
  event_type: z.string().min(1),
  learner_id: z.string().uuid().optional(),
  phone: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  source: z.literal('bot').default('bot'),
});

// ─── Dashboard ────────────────────────────────────────────────────────────

export const DistrictAnalyticsFilterSchema = z.object({
  district: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ─── Type exports ─────────────────────────────────────────────────────────

export type LoginBody = z.infer<typeof LoginSchema>;
export type RefreshBody = z.infer<typeof RefreshSchema>;
export type LearnerFilter = z.infer<typeof LearnerFilterSchema>;
export type PlacementCreate = z.infer<typeof PlacementCreateSchema>;
export type BotEvent = z.infer<typeof BotEventSchema>;
export type DistrictAnalyticsFilter = z.infer<typeof DistrictAnalyticsFilterSchema>;
