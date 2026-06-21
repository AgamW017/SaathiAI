import { z } from 'zod';
import { router, officerProcedure } from '../trpc.js';
import { supabase as _supabase } from '../../db/client.js';
import { handleSupabaseError } from '../errors.js';
import { llmService } from '../../services/llmService.js';

const supabase = _supabase as any;

/**
 * Surface 4 — District Console (DSSDO).
 *   demandSignals — MSME demand-signal map (feature 4.1.2)
 *   dropoutRisk   — dropout-risk early warning (feature 4.1.3)
 *   labourMarket  — labour-market intelligence feed (feature 5.1.3)
 *
 * All aggregates are computed in JS over the relevant rows to avoid relying on
 * Postgres RPC/group-by through the Supabase client.
 */
export const districtRouter = router({
  /** Active vacancies grouped by district + trade → demand intensity. */
  demandSignals: officerProcedure
    .input(z.object({ state: z.string().optional() }).default({}))
    .query(async ({ input }) => {
      let query = supabase
        .from('vacancies')
        .select('district, trade_required, openings, salary_min, salary_max, state')
        .eq('status', 'active');
      if (input.state) query = query.eq('state', input.state);

      const { data, error } = await query;
      if (error) handleSupabaseError(error, 'district.demandSignals');

      const groups = new Map<
        string,
        { district: string; trade: string; openings_total: number; vacancy_count: number; salary_min_sum: number; salary_max_sum: number; salary_n: number }
      >();

      for (const v of (data ?? []) as any[]) {
        const district = v.district ?? 'Unknown';
        const trade = v.trade_required ?? 'Unknown';
        const key = `${district}||${trade}`;
        let g = groups.get(key);
        if (!g) {
          g = { district, trade, openings_total: 0, vacancy_count: 0, salary_min_sum: 0, salary_max_sum: 0, salary_n: 0 };
          groups.set(key, g);
        }
        g.openings_total += v.openings ?? 1;
        g.vacancy_count += 1;
        if (v.salary_min != null && v.salary_max != null) {
          g.salary_min_sum += Number(v.salary_min);
          g.salary_max_sum += Number(v.salary_max);
          g.salary_n += 1;
        }
      }

      return [...groups.values()]
        .map((g) => ({
          district: g.district,
          trade: g.trade,
          openings_total: g.openings_total,
          vacancy_count: g.vacancy_count,
          avg_salary_min: g.salary_n ? Math.round(g.salary_min_sum / g.salary_n) : null,
          avg_salary_max: g.salary_n ? Math.round(g.salary_max_sum / g.salary_n) : null,
        }))
        .sort((a, b) => b.openings_total - a.openings_total);
    }),

  /** Learners at high dropout risk that need early intervention. */
  dropoutRisk: officerProcedure
    .input(z.object({ threshold: z.number().int().min(0).max(100).default(60) }).default({}))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('learners')
        .select('id, full_name, phone, trade, district, risk_score, status, updated_at')
        .gte('risk_score', input.threshold)
        .not('status', 'in', '(placed,dropped)')
        .order('risk_score', { ascending: false })
        .limit(100);

      if (error) handleSupabaseError(error, 'district.dropoutRisk');

      const now = Date.now();
      return (data ?? []).map((l: any) => ({
        ...l,
        days_since_update: Math.floor((now - new Date(l.updated_at).getTime()) / 86_400_000),
      }));
    }),

  /** District-level KPI snapshot for DSSDO dashboard. */
  snapshot: officerProcedure.query(async () => {
    const [{ data: learners, error: lErr }, { data: placements, error: pErr }] = await Promise.all([
      supabase.from('learners').select('id, status, trade, created_at'),
      supabase.from('placements').select('learner_id, placement_date, created_at, salary'),
    ]);
    if (lErr) handleSupabaseError(lErr, 'district.snapshot.learners');
    if (pErr) handleSupabaseError(pErr, 'district.snapshot.placements');

    const learnerList = (learners ?? []) as any[];
    const placementList = (placements ?? []) as any[];

    const enrolled = learnerList.length;
    const placed = learnerList.filter((l) => l.status === 'placed').length;
    const active = learnerList.filter((l) => l.status === 'active').length;
    const dropped = learnerList.filter((l) => l.status === 'dropped').length;
    const placement_rate = enrolled ? Math.round((placed / enrolled) * 100) : 0;

    const learnerById = new Map<string, any>();
    for (const l of learnerList) learnerById.set(l.id, l);

    const days: number[] = [];
    for (const p of placementList) {
      const learner = learnerById.get(p.learner_id);
      if (!learner) continue;
      const d = (new Date(p.placement_date).getTime() - new Date(learner.created_at).getTime()) / 86400000;
      if (d >= 0) days.push(d);
    }
    const avg_time_to_placement_days = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;

    const now = Date.now();
    const cur30Start = now - 30 * 86400000;
    const prior30Start = now - 60 * 86400000;

    const enrolledCur = learnerList.filter((l) => new Date(l.created_at).getTime() >= cur30Start).length;
    const enrolledPrior = learnerList.filter((l) => {
      const t = new Date(l.created_at).getTime();
      return t >= prior30Start && t < cur30Start;
    }).length;
    const placedCur = placementList.filter((p) => new Date(p.placement_date).getTime() >= cur30Start).length;
    const placedPrior = placementList.filter((p) => {
      const t = new Date(p.placement_date).getTime();
      return t >= prior30Start && t < cur30Start;
    }).length;

    const enrolled_delta_pct = enrolledPrior === 0 ? 0 : Math.round(((enrolledCur - enrolledPrior) / enrolledPrior) * 100);
    const placed_delta_pct = placedPrior === 0 ? 0 : Math.round(((placedCur - placedPrior) / placedPrior) * 100);

    return { enrolled, placed, active, dropped, placement_rate, avg_time_to_placement_days, enrolled_delta_pct, placed_delta_pct };
  }),

  /** Per-cohort (training centre) leaderboard by placement rate. */
  centreLeaderboard: officerProcedure.query(async () => {
    const [{ data: learners, error }, { data: cohorts, error: cErr }] = await Promise.all([
      supabase.from('learners').select('id, status, cohort_id, risk_score'),
      supabase.from('cohorts').select('id, name'),
    ]);
    if (error) handleSupabaseError(error, 'district.centreLeaderboard');
    if (cErr) handleSupabaseError(cErr, 'district.centreLeaderboard.cohorts');

    const cohortName = new Map<string, string>();
    for (const c of (cohorts ?? []) as any[]) cohortName.set(c.id, c.name);

    const groups = new Map<string, { enrolled: number; placed: number; active: number; dropped: number; riskSum: number; riskN: number }>();
    for (const l of (learners ?? []) as any[]) {
      const centre = (l.cohort_id && cohortName.get(l.cohort_id)) || 'Unassigned';
      let g = groups.get(centre);
      if (!g) { g = { enrolled: 0, placed: 0, active: 0, dropped: 0, riskSum: 0, riskN: 0 }; groups.set(centre, g); }
      g.enrolled += 1;
      if (l.status === 'placed') g.placed += 1;
      if (l.status === 'active') g.active += 1;
      if (l.status === 'dropped') g.dropped += 1;
      if (l.risk_score != null) { g.riskSum += Number(l.risk_score); g.riskN += 1; }
    }

    return [...groups.entries()]
      .map(([centre, g]) => ({
        centre,
        enrolled: g.enrolled,
        placed: g.placed,
        active: g.active,
        dropped: g.dropped,
        placement_rate: g.enrolled ? Math.round((g.placed / g.enrolled) * 100) : 0,
        avg_risk_score: g.riskN ? Math.round(g.riskSum / g.riskN) : null,
      }))
      .sort((a, b) => b.placement_rate - a.placement_rate || b.enrolled - a.enrolled);
  }),

  /** Per-trade placement performance with avg days-to-placement. */
  tradePerformance: officerProcedure.query(async () => {
    const [{ data: learners, error: lErr }, { data: placements, error: pErr }] = await Promise.all([
      supabase.from('learners').select('id, status, trade, created_at'),
      supabase.from('placements').select('learner_id, placement_date'),
    ]);
    if (lErr) handleSupabaseError(lErr, 'district.tradePerformance.learners');
    if (pErr) handleSupabaseError(pErr, 'district.tradePerformance.placements');

    const norm = (t: string) => (t ?? '').trim().toLowerCase().split(',')[0].trim();

    const learnerList = (learners ?? []) as any[];
    const placementList = (placements ?? []) as any[];

    const learnerById = new Map<string, any>();
    for (const l of learnerList) learnerById.set(l.id, l);

    type TradeGroup = { label: string; enrolled: number; placed: number; days: number[] };
    const groups = new Map<string, TradeGroup>();

    for (const l of learnerList) {
      const k = norm(l.trade ?? '');
      if (!k) continue;
      let g = groups.get(k);
      if (!g) { g = { label: (l.trade ?? '').trim(), enrolled: 0, placed: 0, days: [] }; groups.set(k, g); }
      g.enrolled += 1;
      if (l.status === 'placed') g.placed += 1;
    }

    for (const p of placementList) {
      const learner = learnerById.get(p.learner_id);
      if (!learner) continue;
      const k = norm(learner.trade ?? '');
      if (!k) continue;
      const g = groups.get(k);
      if (!g) continue;
      const d = (new Date(p.placement_date).getTime() - new Date(learner.created_at).getTime()) / 86400000;
      if (d >= 0) g.days.push(d);
    }

    return [...groups.values()]
      .map((g) => ({
        trade: g.label,
        enrolled: g.enrolled,
        placed: g.placed,
        placement_rate: g.enrolled ? Math.round((g.placed / g.enrolled) * 100) : 0,
        avg_time_to_placement_days: g.days.length ? Math.round(g.days.reduce((a, b) => a + b, 0) / g.days.length) : null,
      }))
      .sort((a, b) => b.placement_rate - a.placement_rate);
  }),

  /** AI-generated monthly briefing for DSSDO. */
  monthlySummary: officerProcedure.query(async () => {
    const [{ data: learners, error: lErr }, { data: placements, error: pErr }, { data: vacancies, error: vErr }, { data: cohorts, error: cErr }] = await Promise.all([
      supabase.from('learners').select('id, status, cohort_id, trade, created_at, risk_score'),
      supabase.from('placements').select('learner_id, placement_date'),
      supabase.from('vacancies').select('trade_required, openings, status'),
      supabase.from('cohorts').select('id, name'),
    ]);
    if (lErr) handleSupabaseError(lErr, 'district.monthlySummary.learners');
    if (pErr) handleSupabaseError(pErr, 'district.monthlySummary.placements');
    if (vErr) handleSupabaseError(vErr, 'district.monthlySummary.vacancies');
    if (cErr) handleSupabaseError(cErr, 'district.monthlySummary.cohorts');

    const learnerList = (learners ?? []) as any[];
    const placementList = (placements ?? []) as any[];
    const vacancyList = (vacancies ?? []) as any[];
    const cohortName = new Map<string, string>();
    for (const c of (cohorts ?? []) as any[]) cohortName.set(c.id, c.name);

    const enrolled = learnerList.length;
    const placed = learnerList.filter((l) => l.status === 'placed').length;
    const active = learnerList.filter((l) => l.status === 'active').length;
    const dropped = learnerList.filter((l) => l.status === 'dropped').length;
    const placement_rate = enrolled ? Math.round((placed / enrolled) * 100) : 0;

    // centre groups
    const centreMap = new Map<string, { enrolled: number; placed: number }>();
    for (const l of learnerList) {
      const centre = (l.cohort_id && cohortName.get(l.cohort_id)) || 'Unassigned';
      let g = centreMap.get(centre);
      if (!g) { g = { enrolled: 0, placed: 0 }; centreMap.set(centre, g); }
      g.enrolled += 1;
      if (l.status === 'placed') g.placed += 1;
    }
    const centreArr = [...centreMap.entries()]
      .map(([centre, g]) => ({ centre, enrolled: g.enrolled, placed: g.placed, placement_rate: g.enrolled ? Math.round((g.placed / g.enrolled) * 100) : 0 }))
      .filter((c) => c.enrolled >= 1)
      .sort((a, b) => b.placement_rate - a.placement_rate);
    const top3Centres = centreArr.slice(0, 3);
    const bottom3Centres = centreArr.slice(-3).reverse();

    // trade gap
    const norm = (t: string) => (t ?? '').trim().toLowerCase().split(',')[0].trim();
    const supplyMap = new Map<string, number>();
    const labelMap = new Map<string, string>();
    for (const l of learnerList.filter((l) => l.status === 'active')) {
      const k = norm(l.trade ?? '');
      if (!k) continue;
      supplyMap.set(k, (supplyMap.get(k) ?? 0) + 1);
      if (!labelMap.has(k)) labelMap.set(k, (l.trade ?? '').trim());
    }
    const demandMap = new Map<string, number>();
    for (const v of vacancyList.filter((v) => v.status === 'active')) {
      const k = norm(v.trade_required ?? '');
      if (!k) continue;
      demandMap.set(k, (demandMap.get(k) ?? 0) + (v.openings ?? 1));
      if (!labelMap.has(k)) labelMap.set(k, (v.trade_required ?? '').trim());
    }
    const allTrades = new Set<string>([...supplyMap.keys(), ...demandMap.keys()]);
    const topGapTrades = [...allTrades]
      .map((k) => ({ trade: labelMap.get(k) ?? k, supply: supplyMap.get(k) ?? 0, demand: demandMap.get(k) ?? 0, gap: (demandMap.get(k) ?? 0) - (supplyMap.get(k) ?? 0) }))
      .filter((t) => t.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 3);

    const data = { snapshot: { enrolled, placed, active, dropped, placement_rate }, top3Centres, bottom3Centres, topGapTrades };
    const prompt = 'You are a policy analyst writing a monthly briefing for a District Skill Development Officer (DSSDO) in India. Using ONLY the data below, write a concise plain-language summary (4-6 sentences) interpreting district placement health, then a line \'Recommended actions:\' followed by exactly 3 short, concrete, numbered action items for this month. Reference actual centre names, trades and numbers. Do not invent data. DATA: ' + JSON.stringify(data);

    try {
      const summary = await llmService.generateContent(prompt);
      return { summary, generated_at: new Date().toISOString() };
    } catch {
      return { summary: 'AI summary is temporarily unavailable. Please review the metrics above.', generated_at: new Date().toISOString() };
    }
  }),

  /** Geo-distribution of learners by district, with officer's own district/state context. */
  geoDistribution: officerProcedure.query(async ({ ctx }) => {
    const { data: me } = await supabase
      .from('users')
      .select('district')
      .eq('id', ctx.user.sub)
      .single();

    const officer_district: string | null = me?.district ?? null;

    const { data, error } = await supabase
      .from('learners')
      .select('district, state, status');
    if (error) handleSupabaseError(error, 'district.geoDistribution');

    const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

    type DistrictGroup = {
      label: string;
      stateFreq: Map<string, number>;
      count: number;
      placed: number;
    };

    const groups = new Map<string, DistrictGroup>();
    let total = 0;

    for (const l of (data ?? []) as any[]) {
      const normDistrict = norm(l.district);
      if (!normDistrict) continue;
      total += 1;

      let g = groups.get(normDistrict);
      if (!g) {
        g = { label: (l.district ?? '').trim(), stateFreq: new Map(), count: 0, placed: 0 };
        groups.set(normDistrict, g);
      }
      g.count += 1;
      if (l.status === 'placed') g.placed += 1;

      const normState = norm(l.state);
      if (normState) {
        g.stateFreq.set(l.state, (g.stateFreq.get(l.state) ?? 0) + 1);
      }
    }

    // Determine officer_state: most frequent non-empty state among learners in officer's district
    let officer_state: string | null = null;
    const officerDistrictNorm = norm(officer_district);
    if (officerDistrictNorm) {
      const og = groups.get(officerDistrictNorm);
      if (og && og.stateFreq.size > 0) {
        let bestState: string | null = null;
        let bestCount = 0;
        for (const [state, cnt] of og.stateFreq) {
          if (cnt > bestCount) { bestCount = cnt; bestState = state; }
        }
        officer_state = bestState;
      }
    }

    const byDistrict = [...groups.values()]
      .map((g) => {
        let topState: string | null = null;
        let topCount = 0;
        for (const [state, cnt] of g.stateFreq) {
          if (cnt > topCount) { topCount = cnt; topState = state; }
        }
        return {
          district: g.label,
          state: topState,
          count: g.count,
          placed: g.placed,
        };
      })
      .sort((a, b) => b.count - a.count);

    return { officer_district, officer_state, total, byDistrict };
  }),

  /** Trade-level supply (learners) vs demand (vacancy openings) + avg wage. */
  labourMarket: officerProcedure.query(async () => {
    const [{ data: learners, error: lErr }, { data: vacancies, error: vErr }] = await Promise.all([
      supabase.from('learners').select('trade').eq('status', 'active'),
      supabase.from('vacancies').select('trade_required, openings, salary_min, salary_max').eq('status', 'active'),
    ]);
    if (lErr) handleSupabaseError(lErr, 'district.labourMarket.learners');
    if (vErr) handleSupabaseError(vErr, 'district.labourMarket.vacancies');

    const norm = (t: string) => (t ?? '').trim().toLowerCase().split(',')[0].trim();

    const supply = new Map<string, number>();
    for (const l of (learners ?? []) as any[]) {
      const k = norm(l.trade);
      if (!k) continue;
      supply.set(k, (supply.get(k) ?? 0) + 1);
    }

    const demand = new Map<string, { openings: number; salarySum: number; salaryN: number; label: string }>();
    for (const v of (vacancies ?? []) as any[]) {
      const k = norm(v.trade_required);
      if (!k) continue;
      let d = demand.get(k);
      if (!d) { d = { openings: 0, salarySum: 0, salaryN: 0, label: (v.trade_required ?? '').trim() }; demand.set(k, d); }
      d.openings += v.openings ?? 1;
      if (v.salary_min != null && v.salary_max != null) {
        d.salarySum += (Number(v.salary_min) + Number(v.salary_max)) / 2;
        d.salaryN += 1;
      }
    }

    const trades = new Set<string>([...supply.keys(), ...demand.keys()]);
    return [...trades]
      .map((k) => {
        const s = supply.get(k) ?? 0;
        const d = demand.get(k);
        return {
          trade: d?.label || k,
          supply: s,
          demand: d?.openings ?? 0,
          gap: (d?.openings ?? 0) - s,
          avg_salary: d && d.salaryN ? Math.round(d.salarySum / d.salaryN) : null,
        };
      })
      .sort((a, b) => b.gap - a.gap);
  }),
});
