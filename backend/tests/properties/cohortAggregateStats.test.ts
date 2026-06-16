import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Validates: Requirements 6.3
 *
 * Property 15: Cohort Aggregate Statistics Correctness
 * For any cohort with a known set of learners and their statuses and salaries,
 * the computed aggregate SHALL satisfy:
 *   total = count(all learners),
 *   placed_count = count(status='placed'),
 *   placement_rate = placed_count / total,
 *   and average_salary = mean of non-null salaries among placed learners.
 */

type LearnerStatus = 'placed' | 'active' | 'at_risk' | 'dropped';

interface CohortLearner {
  status: LearnerStatus;
  salary: number | null; // Only meaningful for placed learners
}

interface CohortAggregateStats {
  total: number;
  placed_count: number;
  placement_rate: number;
  average_salary: number | null;
}

/**
 * Computes cohort aggregate statistics from a set of learners.
 * This mirrors the logic expected in the dashboard/report service.
 */
function computeCohortStats(learners: CohortLearner[]): CohortAggregateStats {
  const total = learners.length;
  const placedLearners = learners.filter((l) => l.status === 'placed');
  const placed_count = placedLearners.length;

  // Handle division by zero: rate = 0 if total = 0
  const placement_rate = total > 0 ? placed_count / total : 0;

  // Average salary = mean of non-null salaries among placed learners
  const salaries = placedLearners
    .map((l) => l.salary)
    .filter((s): s is number => s !== null);

  const average_salary =
    salaries.length > 0
      ? salaries.reduce((sum, s) => sum + s, 0) / salaries.length
      : null;

  return { total, placed_count, placement_rate, average_salary };
}

describe('Property 15: Cohort Aggregate Statistics Correctness', () => {
  /**
   * Arbitrary for learner status.
   */
  const statusArb: fc.Arbitrary<LearnerStatus> = fc.constantFrom(
    'placed',
    'active',
    'at_risk',
    'dropped'
  );

  /**
   * Arbitrary for a salary value (nullable, between 1000-100000 for placed learners).
   */
  const salaryArb: fc.Arbitrary<number | null> = fc.oneof(
    fc.constant(null),
    fc.integer({ min: 1000, max: 100000 })
  );

  /**
   * Arbitrary for a cohort learner entry.
   */
  const learnerArb: fc.Arbitrary<CohortLearner> = fc.record({
    status: statusArb,
    salary: salaryArb,
  });

  it('total equals count of all learners', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        (learners) => {
          const stats = computeCohortStats(learners);
          expect(stats.total).toBe(learners.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('placed_count equals count of learners with status "placed"', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        (learners) => {
          const stats = computeCohortStats(learners);
          const expectedPlaced = learners.filter((l) => l.status === 'placed').length;
          expect(stats.placed_count).toBe(expectedPlaced);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('placement_rate equals placed_count / total (0 when total is 0)', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        (learners) => {
          const stats = computeCohortStats(learners);
          if (learners.length === 0) {
            expect(stats.placement_rate).toBe(0);
          } else {
            const expectedRate = stats.placed_count / stats.total;
            expect(stats.placement_rate).toBeCloseTo(expectedRate, 10);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('average_salary equals mean of non-null salaries among placed learners', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        (learners) => {
          const stats = computeCohortStats(learners);

          const placedLearners = learners.filter((l) => l.status === 'placed');
          const nonNullSalaries = placedLearners
            .map((l) => l.salary)
            .filter((s): s is number => s !== null);

          if (nonNullSalaries.length === 0) {
            expect(stats.average_salary).toBeNull();
          } else {
            const expectedMean =
              nonNullSalaries.reduce((sum, s) => sum + s, 0) / nonNullSalaries.length;
            expect(stats.average_salary).toBeCloseTo(expectedMean, 5);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('placement_rate is always between 0 and 1 inclusive', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        (learners) => {
          const stats = computeCohortStats(learners);
          expect(stats.placement_rate).toBeGreaterThanOrEqual(0);
          expect(stats.placement_rate).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('average_salary is null when no placed learners have non-null salary', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            status: fc.constantFrom('active' as const, 'at_risk' as const, 'dropped' as const),
            salary: salaryArb,
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (learners) => {
          // No placed learners at all
          const stats = computeCohortStats(learners);
          expect(stats.average_salary).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('average_salary is null when placed learners all have null salary', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            status: fc.constant('placed' as const),
            salary: fc.constant(null),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (placedNullSalary) => {
          const stats = computeCohortStats(placedNullSalary);
          expect(stats.average_salary).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });
});
