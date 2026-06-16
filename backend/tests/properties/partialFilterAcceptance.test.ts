import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Validates: Requirements 7.3
 *
 * Property 6: Partial Filter Acceptance
 * For any subset of the filter fields {trade, district, location} (including the
 * empty set where no filters are provided), the `employer.vacancies.previewTargetCount`
 * procedure SHALL execute without error and return a non-negative integer count.
 */

type LearnerStatus = 'active' | 'placed' | 'at_risk' | 'dropped';

interface Learner {
  id: string;
  trade: string;
  district: string;
  state: string;
  status: LearnerStatus;
}

interface PreviewFilters {
  trade?: string;
  district?: string;
  location?: string;
}

/**
 * Pure filter function replicating the previewTargetCount logic from the
 * employer vacancies router. Applies all provided filters conjunctively (AND)
 * and requires status = 'active'. Returns a non-negative integer count.
 *
 * This mirrors the implementation:
 *   let query = db.from('learners').select('*', { count: 'exact', head: true }).eq('status', 'active');
 *   if (input.trade) query = query.eq('trade', input.trade);
 *   if (input.district) query = query.eq('district', input.district);
 *   if (input.location) query = query.eq('state', input.location);
 *   return { count: count ?? 0 };
 */
function previewTargetCount(learners: Learner[], filters: PreviewFilters): { count: number } {
  const matching = learners.filter((learner) => {
    if (learner.status !== 'active') return false;
    if (filters.trade && learner.trade !== filters.trade) return false;
    if (filters.district && learner.district !== filters.district) return false;
    if (filters.location && learner.state !== filters.location) return false;
    return true;
  });

  return { count: matching.length };
}

describe('Property 6: Partial Filter Acceptance', () => {
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
   * Generate all possible subsets of filter fields: each field is independently
   * present or undefined. This produces 8 possible combinations:
   *   {}, {trade}, {district}, {location}, {trade, district},
   *   {trade, location}, {district, location}, {trade, district, location}
   */
  const partialFiltersArb: fc.Arbitrary<PreviewFilters> = fc.record({
    trade: fc.option(tradeArb, { nil: undefined }),
    district: fc.option(districtArb, { nil: undefined }),
    location: fc.option(stateArb, { nil: undefined }),
  });

  // ─── Properties ─────────────────────────────────────────────────────────────

  /**
   * **Validates: Requirements 7.3**
   *
   * For any subset of filter fields (including empty), previewTargetCount
   * SHALL execute without error (never throws).
   */
  it('SHALL never throw for any subset of filter fields', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        partialFiltersArb,
        (learners, filters) => {
          expect(() => previewTargetCount(learners, filters)).not.toThrow();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   *
   * For any subset of filter fields, previewTargetCount SHALL return
   * a non-negative integer count.
   */
  it('SHALL return a non-negative integer for any filter subset', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        partialFiltersArb,
        (learners, filters) => {
          const result = previewTargetCount(learners, filters);
          expect(result.count).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(result.count)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   *
   * With empty filters (no trade, no district, no location),
   * previewTargetCount SHALL return the count of all active learners.
   */
  it('SHALL return count of all active learners when no filters provided', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        (learners) => {
          const result = previewTargetCount(learners, {});
          const expectedCount = learners.filter((l) => l.status === 'active').length;
          expect(result.count).toBe(expectedCount);
          expect(result.count).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   *
   * With only trade filter provided, previewTargetCount SHALL not throw
   * and SHALL return count <= total active learners.
   */
  it('SHALL accept trade-only filter and return valid count', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        tradeArb,
        (learners, trade) => {
          const result = previewTargetCount(learners, { trade });
          const totalActive = learners.filter((l) => l.status === 'active').length;
          expect(result.count).toBeGreaterThanOrEqual(0);
          expect(result.count).toBeLessThanOrEqual(totalActive);
          expect(Number.isInteger(result.count)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   *
   * With only district filter provided, previewTargetCount SHALL not throw
   * and SHALL return count <= total active learners.
   */
  it('SHALL accept district-only filter and return valid count', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        districtArb,
        (learners, district) => {
          const result = previewTargetCount(learners, { district });
          const totalActive = learners.filter((l) => l.status === 'active').length;
          expect(result.count).toBeGreaterThanOrEqual(0);
          expect(result.count).toBeLessThanOrEqual(totalActive);
          expect(Number.isInteger(result.count)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   *
   * With only location filter provided, previewTargetCount SHALL not throw
   * and SHALL return count <= total active learners.
   */
  it('SHALL accept location-only filter and return valid count', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        stateArb,
        (learners, location) => {
          const result = previewTargetCount(learners, { location });
          const totalActive = learners.filter((l) => l.status === 'active').length;
          expect(result.count).toBeGreaterThanOrEqual(0);
          expect(result.count).toBeLessThanOrEqual(totalActive);
          expect(Number.isInteger(result.count)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   *
   * Adding more filters SHALL never increase the count (monotonicity).
   * count({trade, district, location}) <= count({trade, district}) <= count({trade}) <= count({})
   */
  it('SHALL return count that is monotonically non-increasing as filters are added', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 0, maxLength: 100 }),
        tradeArb,
        districtArb,
        stateArb,
        (learners, trade, district, location) => {
          const countNone = previewTargetCount(learners, {}).count;
          const countTrade = previewTargetCount(learners, { trade }).count;
          const countTradeDistrict = previewTargetCount(learners, { trade, district }).count;
          const countAll = previewTargetCount(learners, { trade, district, location }).count;

          expect(countAll).toBeLessThanOrEqual(countTradeDistrict);
          expect(countTradeDistrict).toBeLessThanOrEqual(countTrade);
          expect(countTrade).toBeLessThanOrEqual(countNone);
        }
      ),
      { numRuns: 200 }
    );
  });
});
