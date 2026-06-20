import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, officerProcedure } from '../trpc.js';
import { supabase as _supabase } from '../../db/client.js';
import { handleSupabaseError } from '../errors.js';
import { triggerRiskScoreUpdate, computeProfileCompleteness } from '../../services/riskService.js';
const supabase = _supabase as any;

export const cohortsRouter = router({
  /**
   * List all cohorts for the logged-in officer
   */
  list: officerProcedure.query(async ({ ctx }) => {
    const { data, error } = await supabase
      .from('cohorts')
      .select('*, learners(count)')
      .eq('officer_id', ctx.user.sub)
      .order('created_at', { ascending: false });

    if (error) handleSupabaseError(error, 'cohorts.list');

    return data.map((c: any) => ({
      ...c,
      learnerCount: c.learners?.[0]?.count ?? 0,
    }));
  }),

  /**
   * Get a single cohort with its learners
   */
  get: officerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { data: cohort, error } = await supabase
        .from('cohorts')
        .select('*')
        .eq('id', input.id)
        .eq('officer_id', ctx.user.sub)
        .single();

      if (error || !cohort) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Cohort not found' });
      }

      const { data: learners } = await supabase
        .from('learners')
        .select('*')
        .eq('cohort_id', input.id)
        .order('full_name', { ascending: true });

      return { cohort, learners: learners ?? [] };
    }),

  /**
   * Create a new cohort
   */
  create: officerProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await supabase
        .from('cohorts')
        .insert({
          name: input.name,
          officer_id: ctx.user.sub,
        })
        .select()
        .single();

      if (error) handleSupabaseError(error, 'cohorts.create');
      return data;
    }),

  /**
   * Update a cohort
   */
  update: officerProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await supabase
        .from('cohorts')
        .update({ name: input.name, updated_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('officer_id', ctx.user.sub)
        .select()
        .single();

      if (error) handleSupabaseError(error, 'cohorts.update');
      return data;
    }),

  /**
   * Delete a cohort
   */
  delete: officerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await supabase
        .from('cohorts')
        .delete()
        .eq('id', input.id)
        .eq('officer_id', ctx.user.sub);

      if (error) handleSupabaseError(error, 'cohorts.delete');
      return { success: true };
    }),

  /**
   * Upload CSV to create cohort and learners
   */
  uploadCsv: officerProcedure
    .input(
      z.object({
        cohort_name: z.string().min(1),
        trade: z.string().optional(),
        learners: z.array(
          z.object({
            phone: z.string(),
            full_name: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Fetch officer's district and state
      const { data: officer } = await supabase
        .from('users')
        .select('district, state')
        .eq('id', ctx.user.sub)
        .single();

      const district = officer?.district ?? null;
      const state = officer?.state ?? null;

      // 1. Create cohort
      const { data: cohort, error: cohortError } = await supabase
        .from('cohorts')
        .insert({
          name: input.cohort_name,
          officer_id: ctx.user.sub,
        })
        .select()
        .single();

      if (cohortError) {
        handleSupabaseError(cohortError, 'cohorts.uploadCsv.createCohort');
      }

      let inserted = 0;
      let skipped = 0;

      // 2. Insert learners
      for (const l of input.learners) {
        const { data: existing } = await supabase
          .from('learners')
          .select('id')
          .eq('phone', l.phone)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        const { data: inserted_row, error } = await supabase.from('learners').insert({
          phone: l.phone,
          full_name: l.full_name ?? null,
          trade: input.trade ?? null,
          district: district,
          state: state,
          cohort_id: cohort.id,
          status: 'active',
          risk_score: 0,
          officer_id: ctx.user.sub,
        }).select('id').single();

        if (!error) {
          inserted++;
          if (inserted_row?.id) {
            triggerRiskScoreUpdate(inserted_row.id, {
              days_since_last_response: 0,
              status: 'active',
              profile_completeness: computeProfileCompleteness({
                full_name: l.full_name,
                trade: input.trade,
                district,
                phone: l.phone,
              }),
              days_to_cohort_end: 90,
            });
          }
        }
      }

      return { cohort, inserted, skipped, total: input.learners.length };
    }),
});
