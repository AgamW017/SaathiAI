import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc.js';
import { supabase } from '../../db/client.js';
import type { MatchStage } from '../../db/types.js';
import { handleSupabaseError } from '../errors.js';
import {
  verifyUdyam,
  submitNapsRegistration,
  getNapsEligibility,
  checkMinimumWageCompliance,
  getMinimumWage,
  computeEmployerRiskScore,
  isValidTransition,
  appendTimelineEvent,
} from '../../services/employerService.js';
import { employerMessagingRouter } from './employerMessaging.js';

const db = supabase as any;

/**
 * Bot internal API base URL for broadcasting notifications.
 * Falls back to localhost:3001 for local development.
 */
const BOT_INTERNAL_URL =
  process.env.BOT_INTERNAL_URL || 'http://localhost:3001';

/**
 * Rate limit: max 5 broadcasts per employer per calendar day (IST).
 */
const BROADCAST_RATE_LIMIT = 5;

/**
 * Returns today's date boundaries in IST (midnight-to-midnight).
 */
function getTodayISTBounds(): { start: string; end: string } {
  // IST is UTC+5:30
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);

  // Start of day in IST → convert back to UTC
  const istMidnight = new Date(istNow);
  istMidnight.setUTCHours(0, 0, 0, 0);
  const utcStart = new Date(istMidnight.getTime() - istOffset);

  // End of day in IST → convert back to UTC
  const istEndOfDay = new Date(istNow);
  istEndOfDay.setUTCHours(23, 59, 59, 999);
  const utcEnd = new Date(istEndOfDay.getTime() - istOffset);

  return {
    start: utcStart.toISOString(),
    end: utcEnd.toISOString(),
  };
}

// ─── Employer-only procedure ──────────────────────────────────────────────────

const employerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'employer') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Employer access required' });
  }
  return next({ ctx });
});

// ─── Schemas ──────────────────────────────────────────────────────────────────

const VacancyCreateInput = z.object({
  title: z.string().min(2),
  trade_required: z.string().min(2),
  nsqf_level_min: z.number().int().min(1).max(8).optional(),
  nsqf_level_max: z.number().int().min(1).max(8).optional(),
  salary_min: z.number().int().positive(),
  salary_max: z.number().int().positive(),
  location: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  description: z.string().optional(),
  working_hours: z.string().optional(),
  shift_type: z.enum(['day', 'night', 'rotational']).default('day'),
  naps_eligible: z.boolean().default(false),
  openings: z.number().int().positive().default(1),
  status: z.enum(['draft', 'active']).default('active'),
});

const VacancyUpdateInput = VacancyCreateInput.partial().extend({
  id: z.string().uuid(),
  status: z.enum(['draft', 'active', 'paused', 'closed']).optional(),
});

const PipelineTransitionInput = z.object({
  match_id: z.string().uuid(),
  to_stage: z.enum([
    'new_match', 'skill_card_viewed', 'interest_expressed',
    'interview_scheduled', 'interview_completed', 'offer_extended',
    'hired', 'rejected',
  ]),
  interview_at: z.string().datetime().optional(),
  offer_salary: z.number().int().positive().optional(),
  note: z.string().max(500).optional(),
});

// ─── Employer Profile Router ──────────────────────────────────────────────────

const profileRouter = router({
  get: employerProcedure.query(async ({ ctx }) => {
    const { data, error } = await db
      .from('employers')
      .select('*')
      .eq('id', ctx.user.sub)
      .single();

    if (error || !data) {
      // Return null instead of throwing — employer may not have completed profile yet
      return null;
    }
    return data;
  }),

  upsert: employerProcedure
    .input(z.object({
      company_name: z.string().min(2),
      district: z.string().optional(),
      state: z.string().optional(),
      address: z.string().optional(),
      total_employees: z.number().int().min(0).optional(),
      trade_categories: z.array(z.string()).optional(),
      udyam_number: z.string().regex(/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let verificationStatus = 'phone_verified';
      let udyamData: Record<string, unknown> = {};

      // If Udyam number provided, verify it (mocked)
      if (input.udyam_number) {
        const result = await verifyUdyam(input.udyam_number);
        if (result.valid) {
          verificationStatus = 'udyam_verified';
          udyamData = {
            company_name: result.company_name ?? input.company_name,
            trade_categories: result.trade_categories ?? input.trade_categories ?? [],
            total_employees: result.total_employees ?? input.total_employees ?? 0,
            district: result.district ?? input.district,
            state: result.state ?? input.state,
            gstin: result.gstin,
          };
        }
      }

      const upsertData = {
        id: ctx.user.sub,
        company_name: (udyamData.company_name as string) ?? input.company_name,
        udyam_number: input.udyam_number ?? null,
        gstin: (udyamData.gstin as string) ?? null,
        district: (udyamData.district as string) ?? input.district ?? null,
        state: (udyamData.state as string) ?? input.state ?? null,
        address: input.address ?? null,
        total_employees: (udyamData.total_employees as number) ?? input.total_employees ?? 0,
        trade_categories: (udyamData.trade_categories as string[]) ?? input.trade_categories ?? [],
        verification_status: verificationStatus,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await db
        .from('employers')
        .upsert(upsertData, { onConflict: 'id' })
        .select()
        .single();

      if (error) handleSupabaseError(error, 'employer.profile.upsert');
      return data;
    }),

  computeRiskScore: employerProcedure.mutation(async ({ ctx }) => {
    const score = await computeEmployerRiskScore(ctx.user.sub);
    await db.from('employers').update({ employer_risk_score: score }).eq('id', ctx.user.sub);
    return { employer_risk_score: score };
  }),
});

// ─── Vacancies Router ─────────────────────────────────────────────────────────

const vacanciesRouter = router({
  list: employerProcedure
    .input(z.object({
      status: z.enum(['draft', 'active', 'paused', 'closed', 'flagged']).optional(),
      trade: z.string().optional(),
      naps_eligible: z.boolean().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = db
        .from('vacancies')
        .select('*', { count: 'exact' })
        .eq('employer_id', ctx.user.sub)
        .order('created_at', { ascending: false })
        .range((input.page - 1) * input.limit, input.page * input.limit - 1);

      if (input.status) query = query.eq('status', input.status);
      if (input.trade) query = query.eq('trade_required', input.trade);
      if (input.naps_eligible !== undefined) query = query.eq('naps_eligible', input.naps_eligible);

      const { data, error, count } = await query;
      if (error) handleSupabaseError(error, 'employer.vacancies.list');

      return { vacancies: data ?? [], total: count ?? 0, page: input.page };
    }),

  get: employerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await db
        .from('vacancies')
        .select('*')
        .eq('id', input.id)
        .eq('employer_id', ctx.user.sub)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Vacancy not found' });
      }
      return data;
    }),

  create: employerProcedure
    .input(VacancyCreateInput)
    .mutation(async ({ ctx, input }) => {
      // 1. Get or auto-create employer profile
      let { data: employer, error: profileError } = await db
        .from('employers')
        .select('state')
        .eq('id', ctx.user.sub)
        .single();

      // Auto-create minimal employer profile if it doesn't exist (handles legacy users)
      if (profileError?.code === 'PGRST116' || !employer) {
        const { data: user } = await db
          .from('users')
          .select('full_name')
          .eq('id', ctx.user.sub)
          .single();

        const { data: created, error: createErr } = await db
          .from('employers')
          .upsert({
            id: ctx.user.sub,
            company_name: user?.full_name ?? 'My Company',
            verification_status: 'phone_verified',
          }, { onConflict: 'id' })
          .select('state')
          .single();

        if (createErr) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to initialize employer profile. Please try again.',
          });
        }
        employer = created;
      }

      const state = input.state ?? employer?.state ?? 'Uttar Pradesh';

      // 2. Check minimum wage compliance
      const compliant = checkMinimumWageCompliance(input.salary_min, input.trade_required, state);
      const minWage = getMinimumWage(input.trade_required, state);

      // 3. Determine status: flagged if non-compliant, else use requested status
      const status: string = compliant ? input.status : 'flagged';

      const { data, error } = await db
        .from('vacancies')
        .insert({
          ...input,
          employer_id: ctx.user.sub,
          state,
          minimum_wage_compliant: compliant,
          status,
        })
        .select()
        .single();

      if (error) handleSupabaseError(error, 'employer.vacancies.create');

      return {
        vacancy: data,
        minimum_wage_warning: !compliant
          ? {
              flagged: true,
              message: `Salary ₹${input.salary_min.toLocaleString('en-IN')} is below state minimum wage of ₹${minWage.toLocaleString('en-IN')}/month for ${input.trade_required} in ${state}.`,
              minimum_wage: minWage,
            }
          : null,
      };
    }),

  update: employerProcedure
    .input(VacancyUpdateInput)
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const { data: existing } = await db
        .from('vacancies')
        .select('employer_id, state, trade_required')
        .eq('id', input.id)
        .single();

      if (!existing || existing.employer_id !== ctx.user.sub) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Vacancy not found or access denied' });
      }

      const { id, ...updateFields } = input;

      // Re-check compliance if salary or trade changed
      let extraFields: Record<string, unknown> = {};
      if (updateFields.salary_min !== undefined) {
        const state = updateFields.state ?? existing.state ?? 'Uttar Pradesh';
        const trade = updateFields.trade_required ?? existing.trade_required;
        const compliant = checkMinimumWageCompliance(updateFields.salary_min, trade, state);
        extraFields.minimum_wage_compliant = compliant;
        if (!compliant && updateFields.status !== 'closed') {
          extraFields.status = 'flagged';
        }
      }

      const { data, error } = await db
        .from('vacancies')
        .update({ ...updateFields, ...extraFields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('employer_id', ctx.user.sub)
        .select()
        .single();

      if (error) handleSupabaseError(error, 'employer.vacancies.update');
      return data;
    }),

  delete: employerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await db
        .from('vacancies')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('employer_id', ctx.user.sub);

      if (error) handleSupabaseError(error, 'employer.vacancies.delete');
      return { success: true };
    }),

  previewTargetCount: employerProcedure
    .input(z.object({
      trade: z.string().optional(),
      district: z.string().optional(),
      location: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = db
        .from('learners')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      if (input.trade) query = query.eq('trade', input.trade);
      if (input.district) query = query.eq('district', input.district);
      if (input.location) query = query.eq('state', input.location);

      const { count, error } = await query;
      if (error) handleSupabaseError(error, 'employer.vacancies.previewTargetCount');

      return { count: count ?? 0 };
    }),

  /**
   * Broadcast a vacancy to all learners matching the given filters.
   * Creates match records with stage 'new_match' and queues WhatsApp notifications.
   * When exclude_applied is true, learners with existing match records for this
   * vacancy are excluded from the recipient list.
   *
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 8.1, 8.2, 8.3, 8.4, 8.5
   */
  broadcast: employerProcedure
    .input(z.object({
      vacancy_id: z.string().uuid(),
      filters: z.object({
        trade: z.string().optional(),
        district: z.string().optional(),
        location: z.string().optional(),
      }),
      exclude_applied: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const employerId = ctx.user.sub;

      // 1. Verify vacancy exists and belongs to this employer
      const { data: vacancy, error: vacancyError } = await db
        .from('vacancies')
        .select('id, title')
        .eq('id', input.vacancy_id)
        .eq('employer_id', employerId)
        .single();

      if (vacancyError || !vacancy) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Vacancy not found' });
      }

      // 2. Enforce rate limit: 5 broadcasts per employer per calendar day (IST)
      const { start, end } = getTodayISTBounds();

      // Count distinct vacancy_ids broadcast today as proxy for broadcast events
      const { data: todayBroadcasts, error: broadcastCheckError } = await db
        .from('matches')
        .select('vacancy_id')
        .eq('employer_id', employerId)
        .gte('created_at', start)
        .lte('created_at', end);

      if (broadcastCheckError) {
        handleSupabaseError(broadcastCheckError, 'employer.vacancies.broadcast.rateCheck');
      }

      const distinctVacancyIds = new Set(
        (todayBroadcasts ?? []).map((m: { vacancy_id: string }) => m.vacancy_id)
      );
      const isNewBroadcast = !distinctVacancyIds.has(input.vacancy_id);

      if (isNewBroadcast && distinctVacancyIds.size >= BROADCAST_RATE_LIMIT) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Daily broadcast limit reached (5 per day)',
        });
      }

      // 3. Query learners matching filters with status 'active'
      let learners: any[] = [];
      const broadcastAt = new Date().toISOString();

      if (input.filters.trade) {
        // Split trade by comma (vacancy might require multiple or learner might have multiple)
        // Query each trade separately and union results to avoid PostgREST parsing issues
        const trades = input.filters.trade.split(',').map((t: string) => t.trim()).filter(Boolean);
        let allResults: any[] = [];
        const seenIds = new Set<string>();

        for (const trade of trades) {
          let q = db
            .from('learners')
            .select('id, phone, full_name, trade, district, state')
            .eq('status', 'active')
            .ilike('trade', `%${trade}%`);

          // Apply location filters to each sub-query
          if (input.filters.district && input.filters.location) {
            q = q.or(`district.ilike.%${input.filters.district}%,state.ilike.%${input.filters.location}%`);
          } else if (input.filters.district) {
            q = q.or(`district.ilike.%${input.filters.district}%,state.ilike.%${input.filters.district}%`);
          } else if (input.filters.location) {
            q = q.or(`district.ilike.%${input.filters.location}%,state.ilike.%${input.filters.location}%`);
          }

          const { data, error } = await q;
          if (error) handleSupabaseError(error, 'employer.vacancies.broadcast.learnerQuery');
          for (const learner of (data ?? [])) {
            if (!seenIds.has(learner.id)) {
              seenIds.add(learner.id);
              allResults.push(learner);
            }
          }
        }

        let learners_temp = allResults;

        // Also try prefix match for fuzzy (e.g., "Electrician" matching "Electrical")
        const prefixes = trades.map((t: string) => t.slice(0, 5)).filter((p: string) => p.length >= 3);
        for (const prefix of prefixes) {
          let q = db
            .from('learners')
            .select('id, phone, full_name, trade, district, state')
            .eq('status', 'active')
            .ilike('trade', `%${prefix}%`);

          if (input.filters.district && input.filters.location) {
            q = q.or(`district.ilike.%${input.filters.district}%,state.ilike.%${input.filters.location}%`);
          } else if (input.filters.district) {
            q = q.or(`district.ilike.%${input.filters.district}%,state.ilike.%${input.filters.district}%`);
          } else if (input.filters.location) {
            q = q.or(`district.ilike.%${input.filters.location}%,state.ilike.%${input.filters.location}%`);
          }

          const { data } = await q;
          for (const learner of (data ?? [])) {
            if (!seenIds.has(learner.id)) {
              seenIds.add(learner.id);
              learners_temp.push(learner);
            }
          }
        }

        learners = learners_temp;
      } else {
        // No trade filter — query all active learners with optional location filter
        let locationQuery = db
          .from('learners')
          .select('id, phone, full_name, trade, district, state')
          .eq('status', 'active');

        if (input.filters.district) {
          locationQuery = locationQuery.ilike('district', `%${input.filters.district}%`);
        }
        if (input.filters.location) {
          locationQuery = locationQuery.ilike('state', `%${input.filters.location}%`);
        }

        const { data: locationResults, error: locErr } = await locationQuery;
        if (locErr) handleSupabaseError(locErr, 'employer.vacancies.broadcast.learnerQuery');
        learners = locationResults ?? [];
      }

      const { data: matchingLearners, error: learnerError } = { data: null, error: null }; // unused — kept for TS

      // 3b. If exclude_applied is true, query existing match records and exclude those learner_ids
      if (input.exclude_applied && learners.length > 0) {
        const { data: existingMatches, error: matchQueryError } = await db
          .from('matches')
          .select('learner_id')
          .eq('vacancy_id', input.vacancy_id);

        if (matchQueryError) {
          handleSupabaseError(matchQueryError, 'employer.vacancies.broadcast.excludeAppliedQuery');
        }

        const excludedIds = new Set(
          (existingMatches ?? []).map((m: { learner_id: string }) => m.learner_id)
        );

        learners = learners.filter((l: { id: string }) => !excludedIds.has(l.id));
      }

      // 4. Handle zero-match case: return count 0, no match records created
      if (learners.length === 0) {
        return { count: 0, broadcast_at: broadcastAt };
      }

      // 5. Create match records for each learner-vacancy pair
      const matchRecords = learners.map((learner: { id: string }) => ({
        vacancy_id: input.vacancy_id,
        learner_id: learner.id,
        employer_id: employerId,
        stage: 'new_match',
        timeline: JSON.stringify([{
          stage: 'new_match',
          timestamp: broadcastAt,
          actor: employerId,
          note: 'Broadcast match',
        }]),
      }));

      // Insert match records, ignoring duplicates (learner may already be matched)
      const { error: insertError } = await db
        .from('matches')
        .upsert(matchRecords, { onConflict: 'vacancy_id,learner_id', ignoreDuplicates: true });

      if (insertError) {
        handleSupabaseError(insertError, 'employer.vacancies.broadcast.insertMatches');
      }

      // 6. Call bot internal API to queue WhatsApp notifications
      const learnerIds = learners.map((l: { id: string }) => l.id);

      try {
        const response = await fetch(`${BOT_INTERNAL_URL}/internal/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            learnerIds,
            vacancy: {
              id: input.vacancy_id,
              title: vacancy.title,
            },
            employer_id: employerId,
          }),
        });

        if (!response.ok) {
          const statusCode = response.status;
          const body = await response.text().catch(() => '');
          console.error('Broadcast notification delivery failed:', statusCode, body);

          // Roll back match records since notifications were not delivered
          await db
            .from('matches')
            .delete()
            .eq('vacancy_id', input.vacancy_id)
            .eq('employer_id', employerId)
            .eq('created_at', broadcastAt);

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Notification delivery failed (bot returned ${statusCode}). No learners were notified.`,
          });
        }

        // Parse bot response to check actual delivery stats
        const botResult = await response.json().catch(() => null) as { sent?: number; failed?: number } | null;
        if (botResult && botResult.sent === 0 && (botResult.failed ?? 0) > 0) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'WhatsApp delivery failed for all learners. Match records were created but no messages sent.',
          });
        }
      } catch (error: any) {
        // Re-throw TRPCErrors we created above
        if (error instanceof TRPCError) throw error;

        // Bot service unreachable (network error, ECONNREFUSED, etc.)
        console.error('Unable to reach bot service for broadcast notifications:', error);

        // Roll back match records
        await db
          .from('matches')
          .delete()
          .eq('vacancy_id', input.vacancy_id)
          .eq('employer_id', employerId)
          .eq('created_at', broadcastAt);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not reach notification service. Please try again later.',
        });
      }

      // 7. Return count and broadcast timestamp
      return { count: learners.length, broadcast_at: broadcastAt };
    }),
});

// ─── Pipeline Router ──────────────────────────────────────────────────────────

const pipelineRouter = router({
  list: employerProcedure
    .input(z.object({
      vacancy_id: z.string().uuid().optional(),
      stage: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = db
        .from('matches')
        .select(`
          *,
          learners (
            id, full_name, phone, trade, district, risk_score, aadhaar_photo_url
          ),
          vacancies (
            id, title, trade_required
          )
        `)
        .eq('employer_id', ctx.user.sub)
        .order('updated_at', { ascending: false });

      if (input.vacancy_id) query = query.eq('vacancy_id', input.vacancy_id);
      if (input.stage) query = query.eq('stage', input.stage);

      const { data, error } = await query;
      if (error) handleSupabaseError(error, 'employer.pipeline.list');

      // Fetch the authed employer's verification status once (Req1/Req2). We
      // attach it to every match object so the returned shape stays an array —
      // existing callers that iterate the array are unaffected.
      const { data: employer } = await db
        .from('employers')
        .select('verification_status')
        .eq('id', ctx.user.sub)
        .single();
      const employer_verification_status = employer?.verification_status ?? 'unverified';

      return (data ?? []).map((m: Record<string, unknown>) => ({
        ...m,
        employer_verification_status,
      }));
    }),

  transition: employerProcedure
    .input(PipelineTransitionInput)
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch match and verify ownership
      const { data: match, error: fetchErr } = await db
        .from('matches')
        .select('*')
        .eq('id', input.match_id)
        .eq('employer_id', ctx.user.sub)
        .single();

      if (fetchErr || !match) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Match not found' });
      }

      // 2. Validate state machine transition
      if (!isValidTransition(match.stage as MatchStage, input.to_stage as MatchStage)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot transition from '${match.stage}' to '${input.to_stage}'`,
        });
      }

      // 3. Build timeline
      const newTimeline = appendTimelineEvent(
        match.timeline,
        input.to_stage as MatchStage,
        ctx.user.sub,
        input.note
      );

      // 4. Update match
      const updateData: Record<string, unknown> = {
        stage: input.to_stage,
        timeline: newTimeline,
        updated_at: new Date().toISOString(),
      };
      if (input.interview_at) updateData.interview_at = input.interview_at;
      if (input.offer_salary) updateData.offer_salary = input.offer_salary;

      const { data: updated, error: updateErr } = await db
        .from('matches')
        .update(updateData)
        .eq('id', input.match_id)
        .select()
        .single();

      if (updateErr) handleSupabaseError(updateErr, 'employer.pipeline.transition');

      // 4b. On hire → idempotently bootstrap a placement, mark the learner placed,
      // record an event, and ask the bot to schedule retention check-ins. All of
      // this is defensive: any failure here is logged but never breaks the
      // transition response (the bot also auto-bootstraps retention).
      if (input.to_stage === 'hired') {
        try {
          const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
          const nowIso = new Date().toISOString();

          // a. Load the match's vacancy + employer details.
          const { data: vacancy } = await db
            .from('vacancies')
            .select('id, title, trade_required, district, location, salary_min, salary_max')
            .eq('id', match.vacancy_id)
            .single();

          const { data: employer } = await db
            .from('employers')
            .select('company_name')
            .eq('id', ctx.user.sub)
            .single();

          const companyName = employer?.company_name ?? 'Employer';
          const placementSalary =
            input.offer_salary ?? match.offer_salary ?? vacancy?.salary_max ?? null;

          // b. placements.job_id → jobs.id, but vacancies are separate. Create one
          // jobs row per hire and reference its id.
          const { data: job, error: jobErr } = await db
            .from('jobs')
            .insert({
              title: vacancy?.title ?? 'Placement',
              company: companyName,
              location: vacancy?.district ?? vacancy?.location ?? null,
              trade: vacancy?.trade_required ?? null,
              posted_by: ctx.user.sub,
              is_active: true,
            })
            .select('id')
            .single();

          if (jobErr || !job) {
            throw new Error((jobErr as { message?: string })?.message ?? 'Failed to create job for placement');
          }

          // c. Idempotency: only insert a placement if none exists for this
          // (learner, job) pair. The job row is fresh per hire, so this guards
          // against a retried transition that already created one.
          const { data: existingPlacement } = await db
            .from('placements')
            .select('id')
            .eq('learner_id', match.learner_id)
            .eq('job_id', job.id)
            .maybeSingle();

          if (!existingPlacement) {
            await db.from('placements').insert({
              learner_id: match.learner_id,
              job_id: job.id,
              confirmed_by: ctx.user.sub,
              placement_date: today,
              salary: placementSalary,
              salary_claimed: placementSalary,
              notes: 'Auto-created on employer hire',
            });
          }

          // d. Update the learner row with placement details.
          await db
            .from('learners')
            .update({
              status: 'placed',
              placement_company: companyName,
              placement_role: vacancy?.title ?? null,
              placement_salary: placementSalary != null ? String(placementSalary) : null,
              placement_location: vacancy?.district ?? null,
              placement_date: today,
              placement_reported_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', match.learner_id);

          // e. Audit event.
          await db.from('events').insert({
            learner_id: match.learner_id,
            event_type: 'placement_confirmed',
            source: 'backend',
            metadata: {
              match_id: input.match_id,
              vacancy_id: match.vacancy_id,
              employer_id: ctx.user.sub,
              offer_salary: placementSalary,
            },
          });

          // f. Fire-and-forget: ask the bot to schedule retention check-ins.
          try {
            await fetch(`${BOT_INTERNAL_URL}/internal/schedule-retention`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                learnerId: match.learner_id,
                placementDate: new Date(today).toISOString(),
              }),
            });
          } catch (retentionErr) {
            console.error('schedule-retention ping failed (non-fatal):', retentionErr);
          }
        } catch (placementErr) {
          // Never let placement bootstrap break the stage transition.
          console.error('Placement bootstrap on hire failed (non-fatal):', placementErr);
        }
      }

      // 5. Fire Supabase Realtime broadcast (officer dashboard subscription)
      await db
        .channel('pipeline-transitions')
        .send({
          type: 'broadcast',
          event: 'pipeline:transition',
          payload: {
            match_id: input.match_id,
            employer_id: ctx.user.sub,
            from_stage: match.stage,
            to_stage: input.to_stage,
            learner_id: match.learner_id,
            timestamp: new Date().toISOString(),
          },
        });

      return updated;
    }),

  getCandidateDetail: employerProcedure
    .input(z.object({ match_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await db
        .from('matches')
        .select(`
          *,
          learners (
            id, full_name, phone, trade, district, state, risk_score, status,
            skill_cards (
              trade, skills, verification_status
            )
          ),
          vacancies (
            id, title, trade_required, salary_min, salary_max, district
          )
        `)
        .eq('id', input.match_id)
        .eq('employer_id', ctx.user.sub)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Match not found' });
      }
      return data;
    }),
});

// ─── NAPS Router ──────────────────────────────────────────────────────────────

const napsRouter = router({
  status: employerProcedure.query(async ({ ctx }) => {
    const { data: employer, error: employerError } = await db
      .from('employers')
      .select('total_employees, naps_registered, naps_registration_ref, udyam_number')
      .eq('id', ctx.user.sub)
      .single();

    if (employerError && employerError.code !== 'PGRST116') {
      handleSupabaseError(employerError, 'employer.naps.status');
    }

    const totalEmployees = employer?.total_employees ?? 0;
    const eligibility = getNapsEligibility(totalEmployees);

    const { data: claims, error: claimsError } = await db
      .from('naps_claims')
      .select('*')
      .eq('employer_id', ctx.user.sub)
      .order('created_at', { ascending: false });

    if (claimsError) handleSupabaseError(claimsError, 'employer.naps.status.claims');

    return {
      registered: employer?.naps_registered ?? false,
      registration_ref: employer?.naps_registration_ref ?? null,
      total_employees: totalEmployees,
      eligibility,
      claims: claims ?? [],
    };
  }),

  /**
   * NAPS compliance checklist + heuristic score for the authed employer (Req4,
   * 3.3.1). Self-contained — no LLM. Derived from registration state, presence
   * of a registration ref, NAPS-eligible active vacancies, and claim outcomes.
   */
  napsCompliance: employerProcedure.query(async ({ ctx }) => {
    const { data: employer, error: employerError } = await db
      .from('employers')
      .select('naps_registered, naps_registration_ref')
      .eq('id', ctx.user.sub)
      .single();

    if (employerError && employerError.code !== 'PGRST116') {
      handleSupabaseError(employerError, 'employer.naps.napsCompliance');
    }

    const registered = employer?.naps_registered ?? false;
    const hasRef = !!employer?.naps_registration_ref;

    // Count NAPS-eligible active vacancies.
    const { count: eligibleVacancies, error: vacErr } = await db
      .from('vacancies')
      .select('*', { count: 'exact', head: true })
      .eq('employer_id', ctx.user.sub)
      .eq('naps_eligible', true)
      .eq('status', 'active');

    if (vacErr) handleSupabaseError(vacErr, 'employer.naps.napsCompliance.vacancies');

    // Tally claims by status.
    const { data: claims, error: claimsErr } = await db
      .from('naps_claims')
      .select('status')
      .eq('employer_id', ctx.user.sub);

    if (claimsErr) handleSupabaseError(claimsErr, 'employer.naps.napsCompliance.claims');

    const claims_summary = { pending: 0, submitted: 0, approved: 0, rejected: 0 };
    for (const c of (claims ?? []) as { status: string }[]) {
      if (c.status in claims_summary) {
        claims_summary[c.status as keyof typeof claims_summary] += 1;
      }
    }

    const eligibleCount = eligibleVacancies ?? 0;
    const hasEligibleVacancy = eligibleCount >= 1;
    const hasApprovedClaim = claims_summary.approved >= 1;

    // Heuristic score (0-100).
    let score = 0;
    if (registered) score += 30;
    if (hasRef) score += 20;
    if (hasEligibleVacancy) score += 25;
    if (hasApprovedClaim) score += 25;

    const checklist = [
      {
        item: 'NAPS registration',
        status: registered ? 'ok' : 'missing',
        detail: registered
          ? 'Employer is registered under NAPS.'
          : 'Register under NAPS to claim apprentice reimbursements.',
      },
      {
        item: 'Registration reference on file',
        status: hasRef ? 'ok' : (registered ? 'pending' : 'missing'),
        detail: hasRef
          ? 'A NAPS registration reference is recorded.'
          : 'No registration reference recorded yet.',
      },
      {
        item: 'NAPS-eligible active vacancies',
        status: hasEligibleVacancy ? 'ok' : 'missing',
        detail: hasEligibleVacancy
          ? `${eligibleCount} active vacancy(ies) marked NAPS-eligible.`
          : 'No active NAPS-eligible vacancies. Mark eligible roles to qualify.',
      },
      {
        item: 'Approved reimbursement claims',
        status: hasApprovedClaim
          ? 'ok'
          : (claims_summary.pending + claims_summary.submitted > 0 ? 'pending' : 'missing'),
        detail: hasApprovedClaim
          ? `${claims_summary.approved} claim(s) approved.`
          : (claims_summary.pending + claims_summary.submitted > 0
              ? 'Claims submitted and awaiting approval.'
              : 'No claims submitted yet.'),
      },
    ] as { item: string; status: 'ok' | 'pending' | 'missing'; detail: string }[];

    return {
      score,
      registered,
      checklist,
      claims_summary,
    };
  }),

  register: employerProcedure.mutation(async ({ ctx }) => {
    const { data: employer } = await db
      .from('employers')
      .select('udyam_number, company_name, total_employees, naps_registered')
      .eq('id', ctx.user.sub)
      .single();

    if (!employer) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Complete your employer profile first' });
    }
    if (employer.naps_registered) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already registered for NAPS' });
    }
    if ((employer.total_employees ?? 0) < 4) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Need at least 4 employees to be NAPS eligible',
      });
    }

    const result = await submitNapsRegistration(
      employer.udyam_number ?? 'MOCK',
      employer.company_name,
      employer.total_employees
    );

    if (!result.success) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error ?? 'NAPS submission failed' });
    }

    await db.from('employers').update({
      naps_registered: true,
      naps_registration_ref: result.registration_ref,
    }).eq('id', ctx.user.sub);

    return {
      success: true,
      registration_ref: result.registration_ref,
      message: 'NAPS registration successful! Government will reimburse ₹1,500/month per apprentice.',
    };
  }),

  submitClaim: employerProcedure
    .input(z.object({
      vacancy_id: z.string().uuid(),
      learner_id: z.string().uuid().optional(),
      claim_month: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check eligibility
      const { data: employer } = await db
        .from('employers')
        .select('naps_registered, total_employees')
        .eq('id', ctx.user.sub)
        .single();

      if (!employer?.naps_registered) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Register for NAPS first' });
      }

      // Check for duplicate claim
      const { data: existing } = await db
        .from('naps_claims')
        .select('id')
        .eq('employer_id', ctx.user.sub)
        .eq('vacancy_id', input.vacancy_id)
        .eq('claim_month', input.claim_month)
        .single();

      if (existing) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Claim already submitted for this month' });
      }

      const submissionRef = `CLAIM-${Date.now()}-MOCK`;

      const { data, error } = await db
        .from('naps_claims')
        .insert({
          employer_id: ctx.user.sub,
          vacancy_id: input.vacancy_id,
          learner_id: input.learner_id ?? null,
          claim_month: input.claim_month,
          status: 'submitted',
          submission_ref: submissionRef,
        })
        .select()
        .single();

      if (error) handleSupabaseError(error, 'employer.naps.submitClaim');
      return { claim: data, submission_ref: submissionRef };
    }),
});

// ─── Analytics Router ─────────────────────────────────────────────────────────

const analyticsRouter = router({
  overview: employerProcedure.query(async ({ ctx }) => {
    const { data: matches, error: matchesError } = await db
      .from('matches')
      .select('stage, created_at')
      .eq('employer_id', ctx.user.sub);

    if (matchesError) handleSupabaseError(matchesError, 'employer.analytics.overview.matches');

    const allMatches = matches ?? [];
    const stageCounts: Record<string, number> = {};
    for (const m of allMatches) {
      stageCounts[m.stage] = (stageCounts[m.stage] ?? 0) + 1;
    }

    const { data: vacancies, error: vacanciesError } = await db
      .from('vacancies')
      .select('status')
      .eq('employer_id', ctx.user.sub);

    if (vacanciesError) handleSupabaseError(vacanciesError, 'employer.analytics.overview.vacancies');

    const allVacancies = vacancies ?? [];

    return {
      total_matches: allMatches.length,
      hired: stageCounts['hired'] ?? 0,
      in_pipeline: allMatches.length - (stageCounts['hired'] ?? 0) - (stageCounts['rejected'] ?? 0),
      rejected: stageCounts['rejected'] ?? 0,
      stage_funnel: [
        'new_match', 'skill_card_viewed', 'interest_expressed',
        'interview_scheduled', 'interview_completed', 'offer_extended', 'hired',
      ].map(s => ({ stage: s, count: stageCounts[s] ?? 0 })),
      vacancies: {
        total: allVacancies.length,
        active: allVacancies.filter((v: { status: string }) => v.status === 'active').length,
        draft: allVacancies.filter((v: { status: string }) => v.status === 'draft').length,
        flagged: allVacancies.filter((v: { status: string }) => v.status === 'flagged').length,
      },
    };
  }),
});

// ─── Skill Card Token Generator ───────────────────────────────────────────────

const skillCardRouter = router({
  generate: employerProcedure
    .input(z.object({ match_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { signSkillCardToken } = await import('../../services/employerService.js');

      const { data: match } = await db
        .from('matches')
        .select('learner_id, employer_id')
        .eq('id', input.match_id)
        .eq('employer_id', ctx.user.sub)
        .single();

      if (!match) throw new TRPCError({ code: 'NOT_FOUND', message: 'Match not found' });

      const token = signSkillCardToken({
        match_id: input.match_id,
        employer_id: match.employer_id,
        learner_id: match.learner_id,
      });

      const tokenExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await db.from('matches').update({
        skill_card_token: token,
        skill_card_token_exp: tokenExp,
      }).eq('id', input.match_id);

      return {
        token,
        expires_at: tokenExp,
        url: `/s/${token}`,
      };
    }),
});

// ─── Public Skill Card Router ─────────────────────────────────────────────────

export const publicSkillCardRouter = router({
  get: publicProcedure
    .input(z.object({ token: z.string().min(10) }))
    .query(async ({ input }) => {
      const { verifySkillCardToken } = await import('../../services/employerService.js');

      let payload: ReturnType<typeof verifySkillCardToken>;
      try {
        payload = verifySkillCardToken(input.token);
      } catch {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Skill card link has expired or is invalid' });
      }

      // Mark skill_card_viewed if still in new_match
      const { data: match } = await db
        .from('matches')
        .select('stage')
        .eq('id', payload.match_id)
        .single();

      if (match?.stage === 'new_match') {
        const newTimeline = appendTimelineEvent(
          match.timeline ?? [],
          'skill_card_viewed',
          'public',
          'Employer opened skill card'
        );
        await db.from('matches').update({
          stage: 'skill_card_viewed',
          timeline: newTimeline,
          updated_at: new Date().toISOString(),
        }).eq('id', payload.match_id);
      }

      // Fetch learner + skill card data
      const { data: learner, error } = await db
        .from('learners')
        .select(`
          id, full_name, phone, trade, district, state, status,
          skill_cards (
            trade, skills, verification_status
          )
        `)
        .eq('id', payload.learner_id)
        .single();

      if (error || !learner) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Learner not found' });
      }

      // Fetch vacancy title
      const { data: matchFull } = await db
        .from('matches')
        .select('vacancy_id, vacancies(title, district)')
        .eq('id', payload.match_id)
        .single();

      return {
        match_id: payload.match_id,
        learner: {
          id: learner.id,
          full_name: learner.full_name,
          phone: learner.phone,
          trade: learner.trade,
          district: learner.district,
          state: learner.state,
          skill_card: learner.skill_cards?.[0] ?? null,
        },
        vacancy: matchFull?.vacancies ?? null,
        expires_at: new Date(payload.exp! * 1000).toISOString(),
      };
    }),

  expressInterest: publicProcedure
    .input(z.object({
      token: z.string().min(10),
      employer_name: z.string().optional(),
      voice_note_url: z.string().url().optional(),
    }))
    .mutation(async ({ input }) => {
      const { verifySkillCardToken } = await import('../../services/employerService.js');

      let payload: ReturnType<typeof verifySkillCardToken>;
      try {
        payload = verifySkillCardToken(input.token);
      } catch {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Skill card link has expired' });
      }

      const { data: match } = await db
        .from('matches')
        .select('stage, timeline')
        .eq('id', payload.match_id)
        .single();

      if (!match) throw new TRPCError({ code: 'NOT_FOUND', message: 'Match not found' });

      // Only advance if not already past interest_expressed
      const pastInterest = ['interest_expressed', 'interview_scheduled', 'interview_completed', 'offer_extended', 'hired'].includes(match.stage);
      if (!pastInterest) {
        const newTimeline = appendTimelineEvent(
          match.timeline,
          'interest_expressed',
          'employer_public',
          input.employer_name ? `${input.employer_name} expressed interest via skill card` : 'Interest via skill card'
        );
        await db.from('matches').update({
          stage: 'interest_expressed',
          timeline: newTimeline,
          updated_at: new Date().toISOString(),
        }).eq('id', payload.match_id);
      }

      return {
        success: true,
        message: 'आपकी interest हमें मिल गई! हम जल्द ही connect करेंगे।',
      };
    }),

  pass: publicProcedure
    .input(z.object({ token: z.string().min(10) }))
    .mutation(async ({ input }) => {
      const { verifySkillCardToken } = await import('../../services/employerService.js');

      let payload: ReturnType<typeof verifySkillCardToken>;
      try {
        payload = verifySkillCardToken(input.token);
      } catch {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Skill card link has expired' });
      }

      const { data: match } = await db
        .from('matches')
        .select('stage, timeline')
        .eq('id', payload.match_id)
        .single();

      if (!match) throw new TRPCError({ code: 'NOT_FOUND' });

      if (!['hired', 'rejected'].includes(match.stage)) {
        const newTimeline = appendTimelineEvent(
          match.timeline,
          'rejected',
          'employer_public',
          'Passed via skill card'
        );
        await db.from('matches').update({
          stage: 'rejected',
          timeline: newTimeline,
          updated_at: new Date().toISOString(),
        }).eq('id', payload.match_id);
      }

      return { success: true };
    }),

  getByUuid: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data, error } = await db
        .from('skill_cards')
        .select(`
          id, trade, skills, certificate_type, verification_status,
          learners (
            full_name, trade, district, state
          )
        `)
        .eq('id', input.id)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Skill card not found' });
      }

      const learner = data.learners;

      return {
        learner: {
          full_name: learner.full_name,
          trade: learner.trade,
          district: learner.district,
          state: learner.state,
        },
        skillCard: {
          id: data.id,
          trade: data.trade,
          skills: data.skills,
          certificate_type: data.certificate_type,
          verification_status: data.verification_status,
        },
      };
    }),
});

// ─── Combined Employer Router ─────────────────────────────────────────────────

export const employerRouter = router({
  profile: profileRouter,
  vacancies: vacanciesRouter,
  pipeline: pipelineRouter,
  messaging: employerMessagingRouter,
  naps: napsRouter,
  analytics: analyticsRouter,
  skillCard: skillCardRouter,
});
