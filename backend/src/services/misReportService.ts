import { supabase } from '../db/client.js';
import { logger } from '../config/logger.js';
import type { LearnerRow } from '../db/types.js';

// --- Types ---

export interface ReportParams {
  officerId: string;
  cohort?: string;
  periodFrom: string; // ISO date (YYYY-MM-DD)
  periodTo: string;   // ISO date (YYYY-MM-DD)
}

export interface ReportSummary {
  total: number;
  placed: number;
  active: number;
  at_risk: number;
  dropped: number;
}

export interface RetentionRates {
  day30: number | null;
  day60: number | null;
  day90: number | null;
}

export interface EmployerBreakdownEntry {
  employer: string;
  count: number;
}

export interface TradeDistributionEntry {
  trade: string;
  count: number;
}

export interface ReportData {
  summary: ReportSummary;
  placementRate: number;
  averageSalary: number | null;
  retentionRates: RetentionRates;
  employerBreakdown: EmployerBreakdownEntry[];
  tradeDistribution: TradeDistributionEntry[];
  generatedAt: string;
  filters: ReportParams;
}

export interface ReportResult {
  hasData: boolean;
  data: ReportData | null;
}

// --- Errors ---

export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportValidationError';
  }
}

export class ReportTimeoutError extends Error {
  constructor() {
    super('Report generation exceeded 30-second timeout');
    this.name = 'ReportTimeoutError';
  }
}

// --- Constants ---

const REPORT_TIMEOUT_MS = 30_000;

// --- Service ---

export class MISReportService {
  /**
   * Generate MIS report data with aggregated placement, retention,
   * and distribution statistics.
   *
   * Validates officer role, date range, and enforces a 30-second timeout.
   * Returns null data with hasData=false when no learners match filters.
   */
  async generateReport(params: ReportParams): Promise<ReportResult> {
    // Validate date range
    if (params.periodFrom > params.periodTo) {
      throw new ReportValidationError(
        'Invalid date range: start date must be on or before end date'
      );
    }

    // Validate officer role
    await this.validateOfficerRole(params.officerId);

    // Wrap the aggregation in a timeout race
    const reportPromise = this.aggregateReportData(params);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new ReportTimeoutError()), REPORT_TIMEOUT_MS);
    });

    try {
      const result = await Promise.race([reportPromise, timeoutPromise]);
      return result;
    } catch (error) {
      if (error instanceof ReportTimeoutError) {
        logger.error({ params }, 'MIS report generation timed out');
      }
      throw error;
    }
  }

  /**
   * Validate that the given user ID belongs to an officer (or dssdo/admin).
   */
  private async validateOfficerRole(officerId: string): Promise<void> {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', officerId)
      .limit(1) as unknown as { data: Array<{ id: string; role: string }> | null; error: Error | null };

    if (error || !users || users.length === 0) {
      throw new ReportValidationError('Officer not found');
    }

    const user = users[0];
    const allowedRoles: string[] = ['officer', 'dssdo', 'admin'];
    if (!allowedRoles.includes(user.role)) {
      throw new ReportValidationError(
        'Insufficient permissions: officer role required'
      );
    }
  }

  /**
   * Core aggregation logic: queries learners, placements, retention checks,
   * and computes all report metrics.
   */
  private async aggregateReportData(params: ReportParams): Promise<ReportResult> {
    // 1. Fetch learners matching filters
    const learners = await this.fetchFilteredLearners(params);

    // Handle no-data case
    if (learners.length === 0) {
      return { hasData: false, data: null };
    }

    // 2. Compute status summary
    const summary = this.computeStatusSummary(learners);

    // 3. Calculate placement rate (percentage)
    const placementRate =
      summary.total > 0
        ? Math.round((summary.placed / summary.total) * 10000) / 100
        : 0;

    // 4. Get placed learner IDs for salary and retention queries
    const placedLearnerIds = learners
      .filter((l) => l.status === 'placed')
      .map((l) => l.id);

    // 5. Calculate average salary
    const averageSalary = await this.computeAverageSalary(
      placedLearnerIds, params
    );

    // 6. Compute retention rates
    const retentionRates = await this.computeRetentionRates(placedLearnerIds);

    // 7. Compute employer-wise breakdown
    const employerBreakdown = await this.computeEmployerBreakdown(
      placedLearnerIds, params
    );

    // 8. Compute trade-wise distribution
    const tradeDistribution = this.computeTradeDistribution(learners);

    const reportData: ReportData = {
      summary,
      placementRate,
      averageSalary,
      retentionRates,
      employerBreakdown,
      tradeDistribution,
      generatedAt: new Date().toISOString(),
      filters: params,
    };

    return { hasData: true, data: reportData };
  }

  /**
   * Fetch learners that match the report filters (cohort).
   * All learners in the cohort are returned to compute total counts.
   */
  private async fetchFilteredLearners(
    params: ReportParams
  ): Promise<LearnerRow[]> {
    let query = supabase.from('learners').select('*');

    // Filter by cohort if specified
    if (params.cohort) {
      query = query.eq('cohort', params.cohort);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch learners: ${error.message}`);
    }

    return (data ?? []) as LearnerRow[];
  }

  /**
   * Compute status summary from learner list.
   * The sum of all status groups equals the total.
   */
  private computeStatusSummary(learners: LearnerRow[]): ReportSummary {
    const total = learners.length;
    const placed = learners.filter((l) => l.status === 'placed').length;
    const active = learners.filter((l) => l.status === 'active').length;
    const at_risk = learners.filter((l) => l.status === 'at_risk').length;
    const dropped = learners.filter((l) => l.status === 'dropped').length;

    return { total, placed, active, at_risk, dropped };
  }

  /**
   * Calculate mean salary from non-null salaries among placed learners
   * whose placement_date falls within the reporting period.
   *
   * Uses COALESCE priority: current_salary (90-day update from bot) >
   * salary_reported (7-day capture from bot) > salary (officer-confirmed at placement).
   * This ensures bot-captured salary data is used when available.
   */
  private async computeAverageSalary(
    placedLearnerIds: string[],
    params: ReportParams
  ): Promise<number | null> {
    if (placedLearnerIds.length === 0) return null;

    let query = supabase
      .from('placements')
      .select('salary, salary_reported, current_salary')
      .in('learner_id', placedLearnerIds);

    // Filter placements by date range
    query = query.gte('placement_date', params.periodFrom);
    query = query.lte('placement_date', params.periodTo);

    const { data, error } = await query;
    if (error) {
      logger.warn({ error }, 'Failed to fetch salaries for average');
      return null;
    }

    const placements = (data ?? []) as Array<{
      salary: number | null;
      salary_reported: number | null;
      current_salary: number | null;
    }>;
    // Prefer bot-captured salary (most recent first) over officer-confirmed salary
    const salaries = placements
      .map((p) => p.current_salary ?? p.salary_reported ?? p.salary)
      .filter((s): s is number => s !== null && s > 0);

    if (salaries.length === 0) return null;

    const sum = salaries.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / salaries.length) * 100) / 100;
  }

  /**
   * Compute retention rates at 30, 60, and 90 days.
   * Rate = count(retained) / count(total checks performed) for each day.
   */
  private async computeRetentionRates(
    placedLearnerIds: string[]
  ): Promise<RetentionRates> {
    if (placedLearnerIds.length === 0) {
      return { day30: null, day60: null, day90: null };
    }

    const { data, error } = await supabase
      .from('retention_checks')
      .select('check_day, status')
      .in('learner_id', placedLearnerIds)
      .neq('status', 'pending');

    if (error) {
      logger.warn({ error }, 'Failed to fetch retention checks');
      return { day30: null, day60: null, day90: null };
    }

    const checks = (data ?? []) as Array<{
      check_day: number;
      status: string;
    }>;

    const computeRate = (day: number): number | null => {
      const dayChecks = checks.filter((c) => c.check_day === day);
      if (dayChecks.length === 0) return null;
      const retained = dayChecks.filter(
        (c) => c.status === 'retained'
      ).length;
      return Math.round((retained / dayChecks.length) * 10000) / 100;
    };

    return {
      day30: computeRate(30),
      day60: computeRate(60),
      day90: computeRate(90),
    };
  }

  /**
   * Compute employer-wise placement breakdown.
   * Each placed learner appears in exactly one employer group.
   */
  private async computeEmployerBreakdown(
    placedLearnerIds: string[],
    params: ReportParams
  ): Promise<EmployerBreakdownEntry[]> {
    if (placedLearnerIds.length === 0) return [];

    // Fetch placements within the period
    let query = supabase
      .from('placements')
      .select('learner_id, job_id')
      .in('learner_id', placedLearnerIds);

    query = query.gte('placement_date', params.periodFrom);
    query = query.lte('placement_date', params.periodTo);

    const { data: placements, error: placementError } = await query;
    if (placementError || !placements) {
      logger.warn(
        { error: placementError },
        'Failed to fetch placements for employer breakdown'
      );
      return [];
    }

    const typedPlacements = placements as Array<{
      learner_id: string;
      job_id: string;
    }>;

    if (typedPlacements.length === 0) return [];

    // Fetch jobs to get company names
    const jobIds = [...new Set(typedPlacements.map((p) => p.job_id))];
    const { data: jobs, error: jobError } = await supabase
      .from('jobs')
      .select('id, company')
      .in('id', jobIds);

    if (jobError || !jobs) {
      logger.warn(
        { error: jobError },
        'Failed to fetch jobs for employer breakdown'
      );
      return [];
    }

    const jobMap = new Map<string, string>();
    for (const job of jobs as Array<{ id: string; company: string }>) {
      jobMap.set(job.id, job.company);
    }

    // Group placed learners by employer (company)
    // Use a Set to ensure each learner appears in exactly one group
    const seen = new Set<string>();
    const employerCounts = new Map<string, number>();

    for (const placement of typedPlacements) {
      if (seen.has(placement.learner_id)) continue;
      seen.add(placement.learner_id);

      const company = jobMap.get(placement.job_id) ?? 'Unknown';
      employerCounts.set(company, (employerCounts.get(company) ?? 0) + 1);
    }

    return [...employerCounts.entries()]
      .map(([employer, count]) => ({ employer, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Compute trade-wise distribution.
   * Each learner appears in exactly one trade group.
   */
  private computeTradeDistribution(
    learners: LearnerRow[]
  ): TradeDistributionEntry[] {
    const tradeCounts = new Map<string, number>();

    for (const learner of learners) {
      const trade = learner.trade ?? 'Unknown';
      tradeCounts.set(trade, (tradeCounts.get(trade) ?? 0) + 1);
    }

    return [...tradeCounts.entries()]
      .map(([trade, count]) => ({ trade, count }))
      .sort((a, b) => b.count - a.count);
  }
}

// --- Singleton export ---

export const misReportService = new MISReportService();
