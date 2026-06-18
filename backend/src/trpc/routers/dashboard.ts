import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, officerProcedure, protectedProcedure } from '../trpc.js';
import { supabase as _supabase } from '../../db/client.js';
import { handleSupabaseError } from '../errors.js';
import { triggerRiskScoreUpdate, computeProfileCompleteness } from '../../services/riskService.js';
const supabase = _supabase as any;
import type { LearnerRow, ApplicationRow } from '../../db/types.js';

// ─── Sub-routers ──────────────────────────────────────────────────────────────

const learnerRouter = router({
  /**
   * Feature 2.1.1 + 2.3.x: List learners with filters + pagination
   */
  list: officerProcedure
    .input(
      z.object({
        status: z.enum(['active', 'placed', 'dropped', 'at_risk']).optional(),
        cohort_id: z.string().uuid().optional(),
        district: z.string().optional(),
        trade: z.string().optional(),
        risk_score_min: z.number().min(0).max(100).optional(),
        risk_score_max: z.number().min(0).max(100).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const { status, cohort_id, district, trade, risk_score_min, risk_score_max, page, limit } = input;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('learners')
        .select('*, cohorts(name)', { count: 'exact' })
        .range(from, to)
        .order('risk_score', { ascending: false });

      if (status) query = query.eq('status', status);
      if (cohort_id) query = query.eq('cohort_id', cohort_id);
      if (district) query = query.eq('district', district);
      if (trade) query = query.eq('trade', trade);
      if (risk_score_min !== undefined) query = query.gte('risk_score', risk_score_min);
      if (risk_score_max !== undefined) query = query.lte('risk_score', risk_score_max);

      const { data, error, count } = await query;
      if (error) handleSupabaseError(error, 'dashboard.learner.list');

      const total = count ?? 0;
      return {
        data: (data ?? []) as LearnerRow[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * Feature 2.2.1: Individual learner profile + match history
   */
  byId: officerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data: learner, error } = await supabase
        .from('learners')
        .select('*')
        .eq('id', input.id)
        .single();

      if (error || !learner) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Learner not found' });
      }

      // Fetch their applications (match history)
      const { data: applications } = await supabase
        .from('applications')
        .select('*, jobs(*)')
        .eq('learner_id', input.id)
        .order('applied_at', { ascending: false });

      // Fetch placements
      const { data: placements } = await supabase
        .from('placements')
        .select('*, jobs(*)')
        .eq('learner_id', input.id);

      // AI summary placeholder — in production this would call LLM
      const statusLabel = ({
        active: 'actively seeking work',
        placed: 'currently placed',
        at_risk: 'at risk — needs attention',
        dropped: 'dropped out',
      } as Record<string, string>)[learner.status as string] ?? learner.status;

      const aiSummary = [
        `${learner.full_name ?? 'This learner'}`,
        learner.trade ? `, ${learner.trade}` : '',
        learner.district ? ` (${learner.district})` : '',
        ` — ${statusLabel}.`,
        applications && applications.length > 0
          ? ` Has applied to ${applications.length} opportunity/ies.`
          : ' No match history yet.',
        learner.risk_score > 60 ? ' ⚠️ High risk score — recommend direct outreach.' : '',
      ].join('');

      // Suggested action based on learner state
      let suggestedAction: string | null = null;
      if (learner.status === 'at_risk') {
        suggestedAction = 'Call learner — they have been silent for too long.';
      } else if (learner.status === 'active' && (!applications || applications.length === 0)) {
        suggestedAction = 'Send first job match to this learner.';
      } else if (learner.risk_score > 70) {
        suggestedAction = 'Send a check-in WhatsApp message today.';
      }

      return {
        learner: learner as LearnerRow,
        applications: (applications ?? []) as ApplicationRow[],
        placements: placements ?? [],
        aiSummary,
        suggestedAction,
      };
    }),

  /**
   * Feature 2.2.3: Update learner status (officer action)
   */
  updateStatus: officerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['active', 'placed', 'dropped', 'at_risk']),
        note: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, status } = input;
      const { data, error } = await supabase
        .from('learners')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) handleSupabaseError(error, 'dashboard.learner.updateStatus');
      return data as LearnerRow;
    }),

  /**
   * Feature 2.2.1 officer notes: Add/append a note to the learner profile
   */
  addNote: officerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        note: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // We store notes as events so we have an audit trail
      const { error } = await supabase.from('events').insert({
        learner_id: input.id,
        event_type: 'officer_note',
        source: 'manual',
        metadata: { note: input.note, officer_id: ctx.user.sub },
      });

      if (error) handleSupabaseError(error, 'dashboard.learner.addNote');
      return { success: true };
    }),
});

const placementsRouter = router({
  /**
   * Feature 2.4.2: Confirm a learner placement
   */
  confirm: officerProcedure
    .input(
      z.object({
        learner_id: z.string().uuid(),
        job_id: z.string().uuid(),
        placement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        salary: z.number().positive().optional(),
        notes: z.string().max(1000).optional(),
        source: z.enum(['saathai_match', 'officer_direct', 'learner_self']).default('saathai_match'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 1. Create placement record
      const { data: placement, error: placementError } = await supabase
        .from('placements')
        .insert({
          learner_id: input.learner_id,
          job_id: input.job_id,
          confirmed_by: ctx.user.sub,
          placement_date: input.placement_date,
          salary: input.salary ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (placementError) {
        handleSupabaseError(placementError, 'dashboard.placements.confirm');
      }

      // 2. Update learner status to placed
      await supabase
        .from('learners')
        .update({ status: 'placed', updated_at: new Date().toISOString() })
        .eq('id', input.learner_id);

      // 3. Log event
      await supabase.from('events').insert({
        learner_id: input.learner_id,
        event_type: 'placement_confirmed',
        source: 'manual',
        metadata: { placement_id: placement.id, source: input.source },
      });

      return placement;
    }),

  /**
   * Feature 2.4.1: List placements with optional filters
   */
  list: officerProcedure
    .input(
      z.object({
        learner_id: z.string().uuid().optional(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const { learner_id, from, to, page, limit } = input;
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      let query = supabase
        .from('placements')
        .select('*, learners(full_name, phone, trade), jobs(title, company)', { count: 'exact' })
        .range(start, end)
        .order('placement_date', { ascending: false });

      if (learner_id) query = query.eq('learner_id', learner_id);
      if (from) query = query.gte('placement_date', from);
      if (to) query = query.lte('placement_date', to);

      const { data, error, count } = await query;
      if (error) handleSupabaseError(error, 'dashboard.placements.list');

      return {
        data: data ?? [],
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      };
    }),
});

const employersRouter = router({
  /**
   * Feature 2.3.1: Employer directory with search
   */
  list: officerProcedure
    .input(
      z.object({
        search: z.string().optional(),
        trade: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const { page, limit } = input;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Employers are users with role='employer' plus job postings
      let query = supabase
        .from('users')
        .select('id, email, phone, full_name, district, created_at', { count: 'exact' })
        .eq('role', 'employer')
        .range(from, to)
        .order('created_at', { ascending: false });

      const { data, error, count } = await query;
      if (error) handleSupabaseError(error, 'dashboard.employers.list');

      // For each employer, count their active jobs
      const employerIds = (data ?? []).map((e: any) => e.id);
      const { data: jobs } = await supabase
        .from('jobs')
        .select('posted_by, id, is_active, trade')
        .in('posted_by', employerIds.length > 0 ? employerIds : ['__none__']);

      const jobsByEmployer = new Map<string, typeof jobs>();
      for (const job of jobs ?? []) {
        if (!job.posted_by) continue;
        if (!jobsByEmployer.has(job.posted_by)) jobsByEmployer.set(job.posted_by, []);
        jobsByEmployer.get(job.posted_by)!.push(job);
      }

      const enriched = (data ?? []).map((emp: any) => ({
        ...emp,
        total_jobs: jobsByEmployer.get(emp.id)?.length ?? 0,
        active_jobs: jobsByEmployer.get(emp.id)?.filter((j: any) => j.is_active).length ?? 0,
        trades: [...new Set((jobsByEmployer.get(emp.id) ?? []).map((j: any) => j.trade).filter(Boolean))],
      }));

      return {
        data: enriched,
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      };
    }),

  /**
   * Feature 2.3.1: Employer detail + hiring history
   */
  byId: officerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data: employer, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', input.id)
        .eq('role', 'employer')
        .single();

      if (error || !employer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Employer not found' });
      }

      const { data: jobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('posted_by', input.id)
        .order('created_at', { ascending: false });

      const jobIds = (jobs ?? []).map((j: any) => j.id);
      const { data: placements } = await supabase
        .from('placements')
        .select('*, learners(full_name, trade)')
        .in('job_id', jobIds.length > 0 ? jobIds : ['__none__']);

      return { employer, jobs: jobs ?? [], placements: placements ?? [] };
    }),

  /**
   * Feature 2.3.2: Manual match override — officer creates a match between
   * a specific learner and a specific employer's job.
   */
  createManualMatch: officerProcedure
    .input(
      z.object({
        learner_id: z.string().uuid(),
        job_id: z.string().uuid(),
        officer_note: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Create an application record with 'applied' status
      const { data, error } = await supabase
        .from('applications')
        .insert({
          learner_id: input.learner_id,
          job_id: input.job_id,
          status: 'applied',
          notes: input.officer_note
            ? `[Officer Match] ${input.officer_note}`
            : '[Officer Match] Manually matched by placement officer',
          officer_id: ctx.user.sub,
        })
        .select()
        .single();

      if (error) handleSupabaseError(error, 'dashboard.employers.createManualMatch');

      // Log the event
      await supabase.from('events').insert({
        learner_id: input.learner_id,
        event_type: 'manual_match_created',
        source: 'manual',
        metadata: {
          job_id: input.job_id,
          officer_id: ctx.user.sub,
          note: input.officer_note ?? null,
        },
      });

      return { application: data, success: true };
    }),
});

const cohortRouter = router({
  /**
   * Feature 2.5.1: Activate a new cohort from a list of learner records
   */
  activate: officerProcedure
    .input(
      z.object({
        cohort_name: z.string().min(1),
        learners: z.array(
          z.object({
            phone: z.string(),
            full_name: z.string().optional(),
            trade: z.string().optional(),
            district: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { cohort_name, learners } = input;
      let inserted = 0;
      let skipped = 0;

      for (const l of learners) {
        // Check if learner already exists (deduplication by phone)
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
          trade: l.trade ?? null,
          district: l.district ?? null,
          cohort: cohort_name,
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
                trade: l.trade,
                district: l.district,
                phone: l.phone,
              }),
              days_to_cohort_end: 90,
            });
          }
        }
      }

      return { cohort: cohort_name, inserted, skipped, total: learners.length };
    }),
});

const reportsRouter = router({
  /**
   * Feature 2.4.1 + 2.1.1: Cohort health score + KPI summary
   */
  cohortHealth: officerProcedure
    .input(
      z.object({
        cohort_id: z.string().uuid().optional(),
        district: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let query = supabase.from('learners').select('status, risk_score, cohort_id');
      if (input.cohort_id) query = query.eq('cohort_id', input.cohort_id);
      if (input.district) query = query.eq('district', input.district);

      const { data, error } = await query;
      if (error) handleSupabaseError(error, 'dashboard.reports.cohortHealth');

      const learners = (data ?? []) as Pick<LearnerRow, 'status' | 'risk_score' | 'cohort'>[];
      const total = learners.length;
      const placed = learners.filter((l) => l.status === 'placed').length;
      const at_risk = learners.filter((l) => l.status === 'at_risk').length;
      const active = learners.filter((l) => l.status === 'active').length;
      const dropped = learners.filter((l) => l.status === 'dropped').length;
      const placementRate = total > 0 ? Math.round((placed / total) * 100) : 0;

      // Weighted cohort health score (0-100)
      // placement rate contributes 60%, low at-risk ratio 40%
      const atRiskRatio = total > 0 ? at_risk / total : 0;
      const healthScore = Math.round(placementRate * 0.6 + (1 - atRiskRatio) * 100 * 0.4);

      return {
        total,
        placed,
        at_risk,
        active,
        dropped,
        placement_rate: placementRate,
        health_score: healthScore,
        health_label:
          healthScore >= 75 ? 'Good' : healthScore >= 50 ? 'Fair' : 'Needs Attention',
      };
    }),
});

// ─── Main Dashboard Router ────────────────────────────────────────────────────

export const dashboardRouter = router({
  /**
   * Feature 2.1.1: Top-level KPI stats for the officer dashboard header
   */
  cohortStats: officerProcedure
    .input(
      z.object({
        cohort_id: z.string().uuid().optional(),
        district: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let query = supabase.from('learners').select('status, risk_score');
      if (input.cohort_id) query = query.eq('cohort_id', input.cohort_id);
      if (input.district) query = query.eq('district', input.district);

      const { data, error } = await query;
      if (error) handleSupabaseError(error, 'dashboard.cohortStats');

      const learners = (data ?? []) as Pick<LearnerRow, 'status' | 'risk_score'>[];
      const total = learners.length;
      const placed = learners.filter((l) => l.status === 'placed').length;
      const at_risk = learners.filter((l) => l.status === 'at_risk').length;
      const active = learners.filter((l) => l.status === 'active').length;
      const dropped = learners.filter((l) => l.status === 'dropped').length;

      return {
        total,
        placed,
        at_risk,
        active,
        dropped,
        placement_rate: total > 0 ? Math.round((placed / total) * 100) : 0,
      };
    }),

  /**
   * Feature 2.1.2: Priority action inbox — learners ranked by risk score
   * who need officer attention today.
   */
  priorityInbox: officerProcedure
    .input(
      z.object({
        cohort_id: z.string().uuid().optional(),
        district: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      let query = supabase
        .from('learners')
        .select('id, full_name, phone, status, risk_score, trade, district, updated_at, cohort_id, cohorts(name)')
        .not('status', 'eq', 'placed')
        .not('status', 'eq', 'dropped')
        .order('risk_score', { ascending: false })
        .limit(input.limit);

      if (input.cohort_id) query = query.eq('cohort_id', input.cohort_id);
      if (input.district) query = query.eq('district', input.district);

      const { data, error } = await query;
      if (error) handleSupabaseError(error, 'dashboard.priorityInbox');

      const now = Date.now();

      return (data ?? []).map((learner: any) => {
        const daysSinceUpdate = Math.floor(
          (now - new Date(learner.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Generate reason string
        let reason = '';
        if (learner.status === 'at_risk') {
          reason = `Marked at-risk${daysSinceUpdate > 0 ? ` — ${daysSinceUpdate} days ago` : ''}`;
        } else if (daysSinceUpdate > 14) {
          reason = `${daysSinceUpdate} days since last update`;
        } else if (learner.risk_score > 70) {
          reason = 'High risk score — needs immediate attention';
        } else {
          reason = 'Follow-up recommended';
        }

        // Urgency tag
        const urgency: 'critical' | 'follow_up' | 'check_in' =
          learner.risk_score > 70 || learner.status === 'at_risk'
            ? 'critical'
            : learner.risk_score > 40 || daysSinceUpdate > 7
              ? 'follow_up'
              : 'check_in';

        return {
          id: learner.id,
          full_name: learner.full_name,
          phone: learner.phone,
          status: learner.status,
          risk_score: learner.risk_score,
          trade: learner.trade,
          district: learner.district,
          cohort: learner.cohorts?.name ?? 'Unknown',
          cohort_id: learner.cohort_id,
          days_since_update: daysSinceUpdate,
          reason,
          urgency,
        };
      });
    }),

  /**
   * Feature 2.1.3: Cohort timeline — all learners with their journey stage
   */
  cohortTimeline: officerProcedure
    .input(
      z.object({
        cohort_id: z.string().uuid().optional(),
        district: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let query = supabase
        .from('learners')
        .select('id, full_name, phone, status, risk_score, trade, created_at, updated_at, cohort_id, cohorts(name), district')
        .order('created_at', { ascending: true });

      if (input.cohort_id) query = query.eq('cohort_id', input.cohort_id);
      if (input.district) query = query.eq('district', input.district);

      const { data: learners, error } = await query;
      if (error) handleSupabaseError(error, 'dashboard.cohortTimeline');

      // Get applications for stage mapping
      const learnerIds = (learners ?? []).map((l: any) => l.id);
      const { data: applications } = await supabase
        .from('applications')
        .select('learner_id, status, applied_at')
        .in('learner_id', learnerIds.length > 0 ? learnerIds : ['__none__']);

      const { data: placements } = await supabase
        .from('placements')
        .select('learner_id, placement_date')
        .in('learner_id', learnerIds.length > 0 ? learnerIds : ['__none__']);

      const appsByLearner = new Map<string, typeof applications>();
      for (const app of applications ?? []) {
        if (!appsByLearner.has(app.learner_id)) appsByLearner.set(app.learner_id, []);
        appsByLearner.get(app.learner_id)!.push(app);
      }

      const placementsByLearner = new Map<string, string>();
      for (const p of placements ?? []) {
        placementsByLearner.set(p.learner_id, p.placement_date);
      }

      // Map each learner to their current journey stage
      const stageMap: Record<string, number> = {
        onboarded: 1,
        verified: 2,
        first_match_sent: 3,
        interest_expressed: 4,
        interview_confirmed: 5,
        placed: 6,
      };

      return (learners ?? []).map((learner: any) => {
        const apps = appsByLearner.get(learner.id) ?? [];
        const hasInterest = apps.some((a: any) => ['shortlisted', 'interviewed', 'hired'].includes(a.status));
        const hasInterview = apps.some((a: any) => ['interviewed', 'hired'].includes(a.status));
        const isPlaced = learner.status === 'placed';

        const stage = isPlaced
          ? 'placed'
          : hasInterview
            ? 'interview_confirmed'
            : hasInterest
              ? 'interest_expressed'
              : apps.length > 0
                ? 'first_match_sent'
                : 'onboarded';

        return {
          id: learner.id,
          full_name: learner.full_name,
          phone: learner.phone,
          status: learner.status,
          risk_score: learner.risk_score,
          trade: learner.trade,
          cohort: learner.cohorts?.name ?? 'Unknown',
          cohort_id: learner.cohort_id,
          district: learner.district,
          created_at: learner.created_at,
          stage,
          stage_index: stageMap[stage] ?? 1,
          placement_date: placementsByLearner.get(learner.id) ?? null,
          applications_count: apps.length,
        };
      });
    }),

  // Mount sub-routers
  learner: learnerRouter,
  placements: placementsRouter,
  employers: employersRouter,
  cohort: cohortRouter,
  reports: reportsRouter,
});
