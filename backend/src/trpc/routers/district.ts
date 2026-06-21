import { z } from 'zod';
import { router, officerProcedure } from '../trpc.js';
import { supabase as _supabase } from '../../db/client.js';
import { handleSupabaseError } from '../errors.js';

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
