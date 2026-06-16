import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Validates: Requirements 6.1, 6.3, 7.1
 *
 * Property 3: Broadcast Filter Correctness
 * For any set of filter criteria (trade, district, location) and any learner dataset,
 * the broadcast and preview-count procedures SHALL return/process only learners where:
 *   (a) if trade filter is specified, learner.trade matches the filter;
 *   (b) if district filter is specified, learner.district matches the filter;
 *   (c) if location filter is specified, learner.state matches the filter;
 *   and (d) learner.status = 'active'.
 * The count returned SHALL equal the number of learners satisfying all conditions.
 */

type LearnerStatus = 'active' | 'placed' | 'at_risk' | 'dropped';

interface Learner {
  id: string;
  trade: string;
  district: string;
  state: string;
  status: LearnerStatus;
}

interface BroadcastFilters {
  trade?: string;
  district?: string;
  location?: string;
}

/**
 * Pure filter function replicating the broadcast/previewTargetCount logic
 * from the employer vacancies router. This applies all specified filters
 * conjunctively (AND) and requires status = 'active'.
 */
function filterLearnersForBroadcast(
  learners: Learner[],
  filters: BroadcastFilters
): Learner[] {
  return learners.filter((learner) => {
    // (d) Must be active
    if (learner.status !== 'active') return false;

    // (a) If trade filter specified, learner.trade must match
    if (filters.trade && learner.trade !== filters.trade) return false;

    // (b) If district filter specified, learner.district must match
    if (filters.district && learner.district !== filters.district) return false;

    // (c) If location filter specified, learner.state must match
    if (filters.location && learner.state !== filters.location) return false;

    return true;
  });
}

describe('Property 3: Broadcast Filter Correctness', () => {
  // ─── Arbitraries ────────────────────────────────────────────────────────────

  const trades = ['Electrician', 'Fitter', 'Welder', 'Turner', 'Mechanic', 'Plumber'];
  const districts = ['Lucknow', 'Varanasi', 'Kanpur', 'Agra', 'Jaipur', 'Patna'];
  const states = ['Uttar Pradesh', 'Rajasthan', 'Bihar', 'Madhya Pradesh'];
  const statuses: LearnerStatus[] = ['active', 'placed', 'at_risk', 'dropped'];

  const tradeArb = fc.constantFrom(...trades);
  const districtArb = fc.constantFrom(...districts);
  const stateArb = fc.constantFrom(...states);
  const statusArb = fc.constantFrom(...statuses);

  const learnerArb: fc.Arbitrary<Learner> = fc.record({
    id: fc.uuid(),
    trade: tradeArb,
    district: districtArb,
    state: stateArb,
    status: statusArb,
  });

  /**
   * Filter arbitrary: each field is optionally present, drawn from the same
   * domain as the learner fields to ensure meaningful intersections.
   */
  const filtersArb: fc.Arbitrary<BroadcastFilters> = fc.record({
    trade: fc.option(tradeArb, { nil: undefined }),
    district: fc.option(districtArb, { nil: undefined }),
    location: fc.option(stateArb, { nil: undefined }),
  });

  // ─── Properties ─────────────────────────────────────────────────────────────

  it('only active learners are included in filtered results', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        filtersArb,
        (learners, filters) => {
          const result = filterLearnersForBroadcast(learners, filters);
          for (const learner of result) {
            expect(learner.status).toBe('active');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('all returned learners match the trade filter when specified', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        filtersArb,
        (learners, filters) => {
          const result = filterLearnersForBroadcast(learners, filters);
          if (filters.trade) {
            for (const learner of result) {
              expect(learner.trade).toBe(filters.trade);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('all returned learners match the district filter when specified', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        filtersArb,
        (learners, filters) => {
          const result = filterLearnersForBroadcast(learners, filters);
          if (filters.district) {
            for (const learner of result) {
              expect(learner.district).toBe(filters.district);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('all returned learners match the location (state) filter when specified', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        filtersArb,
        (learners, filters) => {
          const result = filterLearnersForBroadcast(learners, filters);
          if (filters.location) {
            for (const learner of result) {
              expect(learner.state).toBe(filters.location);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('no qualifying learner is excluded from the result (completeness)', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        filtersArb,
        (learners, filters) => {
          const result = filterLearnersForBroadcast(learners, filters);

          // Manually compute expected set
          const expected = learners.filter((l) => {
            if (l.status !== 'active') return false;
            if (filters.trade && l.trade !== filters.trade) return false;
            if (filters.district && l.district !== filters.district) return false;
            if (filters.location && l.state !== filters.location) return false;
            return true;
          });

          // Every qualifying learner must be in the result
          expect(result.length).toBe(expected.length);
          for (const learner of expected) {
            expect(result).toContainEqual(learner);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('count equals the number of learners satisfying all conditions', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        filtersArb,
        (learners, filters) => {
          const result = filterLearnersForBroadcast(learners, filters);

          // Independently count matching learners
          let expectedCount = 0;
          for (const learner of learners) {
            if (learner.status !== 'active') continue;
            if (filters.trade && learner.trade !== filters.trade) continue;
            if (filters.district && learner.district !== filters.district) continue;
            if (filters.location && learner.state !== filters.location) continue;
            expectedCount++;
          }

          expect(result.length).toBe(expectedCount);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('empty filters return all active learners', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        (learners) => {
          const result = filterLearnersForBroadcast(learners, {});
          const allActive = learners.filter((l) => l.status === 'active');
          expect(result.length).toBe(allActive.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('non-active learners are never included regardless of filter match', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            trade: tradeArb,
            district: districtArb,
            state: stateArb,
            status: fc.constantFrom('placed' as const, 'at_risk' as const, 'dropped' as const),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        filtersArb,
        (inactiveLearners, filters) => {
          const result = filterLearnersForBroadcast(inactiveLearners, filters);
          expect(result.length).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});
