import { supabase } from '../db/client.js';
import type { LearnerRow, JobRow } from '../db/types.js';

export interface DashboardStats {
  total_learners: number;
  active_learners: number;
  placed_learners: number;
  at_risk_learners: number;
  dropped_learners: number;
  total_jobs: number;
  active_jobs: number;
  total_applications: number;
  total_placements: number;
  placement_rate: number;
}

export interface DistrictAnalytics {
  district: string;
  total_learners: number;
  placed: number;
  at_risk: number;
  placement_rate: number;
  top_trades: { trade: string; count: number }[];
}

/**
 * Aggregate stats for the dashboard (officer / dssdo).
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [learnersRes, jobsRes, applicationsRes, placementsRes] = await Promise.all([
    supabase.from('learners').select('*'),
    supabase.from('jobs').select('*'),
    supabase.from('applications').select('id'),
    supabase.from('placements').select('id'),
  ]);

  const learners: LearnerRow[] = (learnersRes.data ?? []) as LearnerRow[];
  const total_learners = learners.length;
  const active_learners = learners.filter((l) => l.status === 'active').length;
  const placed_learners = learners.filter((l) => l.status === 'placed').length;
  const at_risk_learners = learners.filter((l) => l.status === 'at_risk').length;
  const dropped_learners = learners.filter((l) => l.status === 'dropped').length;

  const jobs: JobRow[] = (jobsRes.data ?? []) as JobRow[];
  const total_jobs = jobs.length;
  const active_jobs = jobs.filter((j) => j.is_active).length;

  const total_applications = (applicationsRes.data ?? []).length;
  const total_placements = (placementsRes.data ?? []).length;
  const placement_rate =
    total_learners > 0 ? Math.round((placed_learners / total_learners) * 100) : 0;

  return {
    total_learners,
    active_learners,
    placed_learners,
    at_risk_learners,
    dropped_learners,
    total_jobs,
    active_jobs,
    total_applications,
    total_placements,
    placement_rate,
  };
}

/**
 * District-level analytics for DSSDO.
 */
export async function getDistrictAnalytics(
  district?: string,
  from?: string,
  to?: string
): Promise<DistrictAnalytics[]> {
  let query = supabase.from('learners').select('district, status, trade, created_at');
  if (district) query = query.eq('district', district);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Group by district
  const typedData: LearnerRow[] = (data ?? []) as LearnerRow[];
  const grouped = new Map<string, LearnerRow[]>();
  for (const row of typedData) {
    const d = row.district ?? 'Unknown';
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d)!.push(row);
  }

  const result: DistrictAnalytics[] = [];
  for (const [dist, rows] of grouped) {
    const total = rows.length;
    const placed = rows.filter((r) => r.status === 'placed').length;
    const at_risk = rows.filter((r) => r.status === 'at_risk').length;

    // Count trades
    const tradeCounts = new Map<string, number>();
    for (const row of rows) {
      if (row.trade) tradeCounts.set(row.trade, (tradeCounts.get(row.trade) ?? 0) + 1);
    }
    const top_trades = [...tradeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([trade, count]) => ({ trade, count }));

    result.push({
      district: dist,
      total_learners: total,
      placed,
      at_risk,
      placement_rate: total > 0 ? Math.round((placed / total) * 100) : 0,
      top_trades,
    });
  }

  return result.sort((a, b) => b.total_learners - a.total_learners);
}
