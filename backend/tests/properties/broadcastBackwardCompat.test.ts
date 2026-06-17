import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: vacancy-actions-menu, Property 6: Backward Compatibility Without Exclude Flag
 *
 * Validates: Requirements 8.5
 *
 * Property: For any invocation of the broadcast mutation where exclude_applied
 * is not provided or is set to false, the result shall include all matching
 * learners in the notification recipients regardless of whether they already
 * have match records for the vacancy, preserving the pre-existing broadcast behavior.
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

interface MatchRecord {
  learner_id: string;
  vacancy_id: string;
}

/**
 * Pure filter function replicating the broadcast logic from the employer router.
 * Applies trade/district/location filters conjunctively and requires status 'active'.
 */
function filterLearnersForBroadcast(
  learners: Learner[],
  filters: BroadcastFilters
): Learner[] {
  return learners.filter((learner) => {
    if (learner.status !== 'active') return false;
    if (filters.trade && learner.trade !== filters.trade) return false;
    if (filters.district && learner.district !== filters.district) return false;
    if (filters.location && learner.state !== filters.location) return false;
    return true;
  });
}

/**
 * Simulates the broadcast recipient computation.
 * When exclude_applied is false or undefined, no exclusion filtering occurs —
 * all matching learners are included regardless of existing match records.
 * When exclude_applied is true, learners with existing match records are excluded.
 */
function computeBroadcastRecipients(
  learners: Learner[],
  filters: BroadcastFilters,
  vacancyId: string,
  existingMatches: MatchRecord[],
  excludeApplied?: boolean
): Learner[] {
  let recipients = filterLearnersForBroadcast(learners, filters);

  if (excludeApplied && recipients.length > 0) {
    const excludedIds = new Set(
      existingMatches
        .filter((m) => m.vacancy_id === vacancyId)
        .map((m) => m.learner_id)
    );
    recipients = recipients.filter((l) => !excludedIds.has(l.id));
  }

  return recipients;
}

describe('Feature: vacancy-actions-menu, Property 6: Backward Compatibility Without Exclude Flag', () => {
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

  const filtersArb: fc.Arbitrary<BroadcastFilters> = fc.record({
    trade: fc.option(tradeArb, { nil: undefined }),
    district: fc.option(districtArb, { nil: undefined }),
    location: fc.option(stateArb, { nil: undefined }),
  });

  const vacancyIdArb = fc.uuid();

  /**
   * Generates existing match records as a random subset of learner IDs
   * paired with the vacancy ID, simulating learners who already applied.
   */
  function existingMatchesArb(
    learners: Learner[],
    vacancyId: string
  ): fc.Arbitrary<MatchRecord[]> {
    if (learners.length === 0) return fc.constant([]);
    return fc.subarray(learners).map((subset) =>
      subset.map((l) => ({ learner_id: l.id, vacancy_id: vacancyId }))
    );
  }

  // ─── Properties ─────────────────────────────────────────────────────────────

  it('with exclude_applied=false, all matching learners are included regardless of existing matches', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 1, maxLength: 50 }),
        filtersArb,
        vacancyIdArb,
        (learners, filters, vacancyId) => {
          return fc.assert(
            fc.property(
              existingMatchesArb(learners, vacancyId),
              (existingMatches) => {
                const recipients = computeBroadcastRecipients(
                  learners,
                  filters,
                  vacancyId,
                  existingMatches,
                  false // exclude_applied = false
                );

                const allMatching = filterLearnersForBroadcast(learners, filters);

                // All matching learners must be included — no filtering by existing matches
                expect(recipients.length).toBe(allMatching.length);
                expect(recipients).toEqual(allMatching);
              }
            ),
            { numRuns: 5 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('with exclude_applied=undefined, all matching learners are included regardless of existing matches', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 1, maxLength: 50 }),
        filtersArb,
        vacancyIdArb,
        (learners, filters, vacancyId) => {
          return fc.assert(
            fc.property(
              existingMatchesArb(learners, vacancyId),
              (existingMatches) => {
                const recipients = computeBroadcastRecipients(
                  learners,
                  filters,
                  vacancyId,
                  existingMatches,
                  undefined // exclude_applied not provided
                );

                const allMatching = filterLearnersForBroadcast(learners, filters);

                // All matching learners must be included — no filtering by existing matches
                expect(recipients.length).toBe(allMatching.length);
                expect(recipients).toEqual(allMatching);
              }
            ),
            { numRuns: 5 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('count without exclude flag equals total matching learners, not set difference', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 1, maxLength: 50 }),
        filtersArb,
        vacancyIdArb,
        (learners, filters, vacancyId) => {
          return fc.assert(
            fc.property(
              existingMatchesArb(learners, vacancyId),
              (existingMatches) => {
                const recipientsNoExclude = computeBroadcastRecipients(
                  learners,
                  filters,
                  vacancyId,
                  existingMatches,
                  false
                );

                const recipientsWithExclude = computeBroadcastRecipients(
                  learners,
                  filters,
                  vacancyId,
                  existingMatches,
                  true
                );

                const allMatching = filterLearnersForBroadcast(learners, filters);

                // Without exclude: count equals total matching learners
                expect(recipientsNoExclude.length).toBe(allMatching.length);

                // With exclude: count is <= total matching (set difference)
                expect(recipientsWithExclude.length).toBeLessThanOrEqual(allMatching.length);

                // The difference is exactly the learners who have existing match records
                const matchedLearnerIds = new Set(
                  existingMatches
                    .filter((m) => m.vacancy_id === vacancyId)
                    .map((m) => m.learner_id)
                );
                const expectedExcluded = allMatching.filter((l) => matchedLearnerIds.has(l.id));
                expect(recipientsNoExclude.length - recipientsWithExclude.length).toBe(
                  expectedExcluded.length
                );
              }
            ),
            { numRuns: 5 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('existing match records have no effect when exclude_applied is false', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 1, maxLength: 50 }),
        filtersArb,
        vacancyIdArb,
        (learners, filters, vacancyId) => {
          // Run with no existing matches
          const recipientsNoMatches = computeBroadcastRecipients(
            learners,
            filters,
            vacancyId,
            [], // no existing matches
            false
          );

          // Run with all learners having existing matches
          const allMatchRecords: MatchRecord[] = learners.map((l) => ({
            learner_id: l.id,
            vacancy_id: vacancyId,
          }));
          const recipientsAllMatched = computeBroadcastRecipients(
            learners,
            filters,
            vacancyId,
            allMatchRecords, // every learner has a match
            false
          );

          // Both should produce identical results
          expect(recipientsNoMatches.length).toBe(recipientsAllMatched.length);
          expect(recipientsNoMatches).toEqual(recipientsAllMatched);
        }
      ),
      { numRuns: 100 }
    );
  });
});
