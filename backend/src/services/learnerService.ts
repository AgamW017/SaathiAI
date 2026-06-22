import { supabase } from '../db/client.js';
import type { LearnerFilter } from '../schemas/index.js';
import type { LearnerRow } from '../db/types.js';

export interface PaginatedLearners {
  data: LearnerRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Fetch a single learner by ID.
 */
export async function getLearnerById(id: string): Promise<LearnerRow> {
  const { data, error } = await supabase
    .from('learners')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw Object.assign(new Error('Learner not found'), { status: 404 });
  }
  return data;
}

/**
 * Fetch learners with optional filters and pagination.
 */
export async function getLearners(filters: LearnerFilter): Promise<PaginatedLearners> {
  const { status, cohort, risk_score_min, risk_score_max, district, trade, page, limit } = filters;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('learners')
    .select('*', { count: 'exact' })
    .range(from, to)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (cohort) {
    const { data: cohortRow } = await (supabase as any)
      .from('cohorts')
      .select('id')
      .eq('name', cohort)
      .single();
    query = query.eq('cohort_id', cohortRow?.id ?? '__none__');
  }
  if (district) query = query.eq('district', district);
  if (trade) query = query.eq('trade', trade);
  if (risk_score_min !== undefined) query = query.gte('risk_score', risk_score_min);
  if (risk_score_max !== undefined) query = query.lte('risk_score', risk_score_max);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    data: data ?? [],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
