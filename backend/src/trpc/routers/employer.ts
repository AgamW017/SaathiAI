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

const db = supabase as any;

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

  create: employerProcedure
    .input(VacancyCreateInput)
    .mutation(async ({ ctx, input }) => {
      // 1. Get employer profile for state info
      const { data: employer } = await db
        .from('employers')
        .select('state')
        .eq('id', ctx.user.sub)
        .single();

      const state = input.state ?? employer?.state ?? 'Uttar Pradesh';

      // 2. Check minimum wage compliance
      const compliant = checkMinimumWageCompliance(input.salary_min, input.trade_required, state);
      const minWage = getMinimumWage(input.trade_required, state);

      // 3. Determine status: flagged if non-compliant, else draft
      const status: string = compliant ? 'draft' : 'flagged';

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
            id, full_name, phone, trade, district, risk_score
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
      return data ?? [];
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
          id, full_name, trade, district, state, status,
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
});

// ─── Combined Employer Router ─────────────────────────────────────────────────

export const employerRouter = router({
  profile: profileRouter,
  vacancies: vacanciesRouter,
  pipeline: pipelineRouter,
  naps: napsRouter,
  analytics: analyticsRouter,
  skillCard: skillCardRouter,
});
