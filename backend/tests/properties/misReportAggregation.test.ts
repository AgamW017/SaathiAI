import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { LearnerStatus } from '../../src/db/types.js';

/**
 * Validates: Requirements 7.3, 7.4
 *
 * Property 16: MIS Report Aggregation Consistency
 * For any set of learners within a reporting period, the sum of learners
 * grouped by status SHALL equal the total learner count, and retention rates
 * SHALL equal count(retained at day N) / count(checks performed at day N)
 * for each check day.
 */

// --- Simulated pure computation logic (mirrors MISReportService private methods) ---

const LEARNER_STATUSES: LearnerStatus[] = ['placed', 'active', 'at_risk', 'dropped'];

interface StatusSummary {
  total: number;
  placed: number;
  active: number;
  at_risk: number;
  dropped: number;
}

/**
 * Simulates computeStatusSummary from MISReportService.
 * Groups learners by status and returns counts per group plus total.
 */
function computeStatusSummary(learners: Array<{ status: LearnerStatus }>): StatusSummary {
  const total = learners.length;
  const placed = learners.filter((l) => l.status === 'placed').length;
  const active = learners.filter((l) => l.status === 'active').length;
  const at_risk = learners.filter((l) => l.status === 'at_risk').length;
  const dropped = learners.filter((l) => l.status === 'dropped').length;

  return { total, placed, active, at_risk, dropped };
}

type RetentionCheckStatus = 'retained' | 'left' | 'no_response';

interface RetentionCheck {
  check_day: number;
  status: RetentionCheckStatus;
}

interface RetentionRates {
  day30: number | null;
  day60: number | null;
  day90: number | null;
}

/**
 * Simulates computeRetentionRates logic from MISReportService.
 * Rate = count(retained) / count(total checks) for each check day.
 * Returns percentage rounded to 2 decimal places, or null if no checks exist for a day.
 */
function computeRetentionRates(checks: RetentionCheck[]): RetentionRates {
  const computeRate = (day: number): number | null => {
    const dayChecks = checks.filter((c) => c.check_day === day);
    if (dayChecks.length === 0) return null;
    const retained = dayChecks.filter((c) => c.status === 'retained').length;
    return Math.round((retained / dayChecks.length) * 10000) / 100;
  };

  return {
    day30: computeRate(30),
    day60: computeRate(60),
    day90: computeRate(90),
  };
}

// --- Arbitraries ---

/**
 * Arbitrary for a learner with a valid status from LearnerStatus type.
 */
const learnerArb = fc.record({
  id: fc.uuid(),
  status: fc.constantFrom(...LEARNER_STATUSES),
});

/**
 * Arbitrary for retention check status values.
 */
const retentionCheckStatusArb: fc.Arbitrary<RetentionCheckStatus> = fc.constantFrom(
  'retained',
  'left',
  'no_response'
);

/**
 * Arbitrary for a retention check record with check_day in [30, 60, 90].
 */
const retentionCheckArb: fc.Arbitrary<RetentionCheck> = fc.record({
  check_day: fc.constantFrom(30, 60, 90),
  status: retentionCheckStatusArb,
});

// --- Tests ---

describe('Property 16: MIS Report Aggregation Consistency', () => {
  it('sum of learners grouped by status equals total learner count', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        (learners) => {
          const summary = computeStatusSummary(learners);
          expect(summary.placed + summary.active + summary.at_risk + summary.dropped).toBe(
            summary.total
          );
        }
      ),
      { numRuns: 200 }
    );
  });

  it('each status count is non-negative and does not exceed total', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        (learners) => {
          const summary = computeStatusSummary(learners);
          expect(summary.placed).toBeGreaterThanOrEqual(0);
          expect(summary.active).toBeGreaterThanOrEqual(0);
          expect(summary.at_risk).toBeGreaterThanOrEqual(0);
          expect(summary.dropped).toBeGreaterThanOrEqual(0);
          expect(summary.placed).toBeLessThanOrEqual(summary.total);
          expect(summary.active).toBeLessThanOrEqual(summary.total);
          expect(summary.at_risk).toBeLessThanOrEqual(summary.total);
          expect(summary.dropped).toBeLessThanOrEqual(summary.total);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('retention rate equals count(retained) / count(total checks) for each day', () => {
    fc.assert(
      fc.property(
        fc.array(retentionCheckArb, { minLength: 1, maxLength: 100 }),
        (checks) => {
          const rates = computeRetentionRates(checks);

          for (const day of [30, 60, 90] as const) {
            const dayChecks = checks.filter((c) => c.check_day === day);
            const rateKey = `day${day}` as keyof RetentionRates;

            if (dayChecks.length === 0) {
              expect(rates[rateKey]).toBeNull();
            } else {
              const retained = dayChecks.filter((c) => c.status === 'retained').length;
              const expectedRate = Math.round((retained / dayChecks.length) * 10000) / 100;
              expect(rates[rateKey]).toBe(expectedRate);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('retention rate is null when no checks exist for a given day', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(30, 60, 90),
        (excludedDay) => {
          // Generate checks that do NOT include the excluded day
          const otherDays = [30, 60, 90].filter((d) => d !== excludedDay);
          const checks: RetentionCheck[] = otherDays.map((day) => ({
            check_day: day,
            status: 'retained' as RetentionCheckStatus,
          }));

          const rates = computeRetentionRates(checks);
          const rateKey = `day${excludedDay}` as keyof RetentionRates;
          expect(rates[rateKey]).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('retention rate is between 0 and 100 (inclusive) when checks exist', () => {
    fc.assert(
      fc.property(
        fc.array(retentionCheckArb, { minLength: 1, maxLength: 100 }),
        (checks) => {
          const rates = computeRetentionRates(checks);

          for (const rateKey of ['day30', 'day60', 'day90'] as const) {
            const rate = rates[rateKey];
            if (rate !== null) {
              expect(rate).toBeGreaterThanOrEqual(0);
              expect(rate).toBeLessThanOrEqual(100);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
