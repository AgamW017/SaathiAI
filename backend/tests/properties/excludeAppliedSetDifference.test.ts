import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Validates: Requirements 6.2, 8.1, 8.2, 8.4
 *
 * Feature: vacancy-actions-menu, Property 4: Exclude-Applied Set Difference
 *
 * For any set of active learners matching the trade filter and for any subset
 * of those learners who already have a match record for the given vacancy_id,
 * invoking the broadcast mutation with `exclude_applied: true` shall notify
 * exactly the set difference (matching learners minus already-matched learners),
 * create new match records only for those notified learners, and return a count
 * equal to the size of that set difference.
 */

type LearnerStatus = 'active' | 'placed' | 'at_risk' | 'dropped';

interface Learner {
  id: string;
  phone: string;
  full_name: string;
  trade: string;
  status: LearnerStatus;
}

interface BroadcastFilters {
  trade?: string;
  district?: string;
  location?: string;
}

/**
 * Pure function replicating the broadcast logic with exclude_applied: true.
 * 
 * Steps (mirroring backend logic):
 * 1. Filter learners by status='active' and matching filters
 * 2. Query existing match records for the vacancy_id
 * 3. Compute set difference: matching learners - already-matched learner IDs
 * 4. Return the filtered set and its count
 */
function broadcastWithExcludeApplied(
  allLearners: Learner[],
  filters: BroadcastFilters,
  existingMatchLearnerIds: Set<string>
): { recipients: Learner[]; count: number } {
  // Step 1: Filter learners matching criteria
  const matchingLearners = allLearners.filter((learner) => {
    if (learner.status !== 'active') return false;
    if (filters.trade && learner.trade !== filters.trade) return false;
    return true;
  });

  // Step 2 & 3: Exclude learners with existing match records
  const recipients = matchingLearners.filter(
    (learner) => !existingMatchLearnerIds.has(learner.id)
  );

  return { recipients, count: recipients.length };
}

describe('Feature: vacancy-actions-menu, Property 4: Exclude-Applied Set Difference', () => {
  // ─── Arbitraries ────────────────────────────────────────────────────────────

  const trades = ['Electrician', 'Fitter', 'Welder', 'Turner', 'Mechanic', 'Plumber'];
  const statuses: LearnerStatus[] = ['active', 'placed', 'at_risk', 'dropped'];

  const tradeArb = fc.constantFrom(...trades);
  const statusArb = fc.constantFrom(...statuses);

  const learnerArb: fc.Arbitrary<Learner> = fc.record({
    id: fc.uuid(),
    phone: fc.stringMatching(/^91[6-9]\d{9}$/),
    full_name: fc.string({ minLength: 2, maxLength: 30 }),
    trade: tradeArb,
    status: statusArb,
  });

  // ─── Properties ─────────────────────────────────────────────────────────────

  it('returns exactly the set difference: matching learners minus already-matched', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 1, maxLength: 80 }),
        tradeArb,
        (learners, filterTrade) => {
          // Determine matching active learners
          const matchingLearners = learners.filter(
            (l) => l.status === 'active' && l.trade === filterTrade
          );

          // Generate a random subset as "already matched" (use subset of matching IDs)
          const matchingIds = matchingLearners.map((l) => l.id);
          // Pick roughly half as already matched
          const alreadyMatchedIds = new Set(
            matchingIds.filter((_, idx) => idx % 2 === 0)
          );

          const result = broadcastWithExcludeApplied(
            learners,
            { trade: filterTrade },
            alreadyMatchedIds
          );

          // Expected: matching learners whose IDs are NOT in alreadyMatchedIds
          const expectedRecipients = matchingLearners.filter(
            (l) => !alreadyMatchedIds.has(l.id)
          );

          expect(result.count).toBe(expectedRecipients.length);
          expect(result.recipients).toHaveLength(expectedRecipients.length);

          // Every recipient must be in the expected set
          for (const recipient of result.recipients) {
            expect(expectedRecipients).toContainEqual(recipient);
          }
        }
      ),
      { numRuns: 150 }
    );
  });

  it('no already-matched learner appears in recipients', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 1, maxLength: 80 }),
        tradeArb,
        fc.float({ min: 0, max: 1 }),
        (learners, filterTrade, exclusionRate) => {
          const matchingLearners = learners.filter(
            (l) => l.status === 'active' && l.trade === filterTrade
          );

          // Use exclusionRate to determine which learners are already matched
          const alreadyMatchedIds = new Set(
            matchingLearners
              .filter((_, idx) => idx / Math.max(matchingLearners.length, 1) < exclusionRate)
              .map((l) => l.id)
          );

          const result = broadcastWithExcludeApplied(
            learners,
            { trade: filterTrade },
            alreadyMatchedIds
          );

          // No recipient should have an ID in the excluded set
          for (const recipient of result.recipients) {
            expect(alreadyMatchedIds.has(recipient.id)).toBe(false);
          }
        }
      ),
      { numRuns: 150 }
    );
  });

  it('every non-excluded matching learner IS included in recipients (completeness)', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 1, maxLength: 80 }),
        tradeArb,
        (learners, filterTrade) => {
          const matchingLearners = learners.filter(
            (l) => l.status === 'active' && l.trade === filterTrade
          );

          // Exclude the first third
          const cutoff = Math.floor(matchingLearners.length / 3);
          const alreadyMatchedIds = new Set(
            matchingLearners.slice(0, cutoff).map((l) => l.id)
          );

          const result = broadcastWithExcludeApplied(
            learners,
            { trade: filterTrade },
            alreadyMatchedIds
          );

          // Every matching learner NOT in excluded set must be in recipients
          const recipientIds = new Set(result.recipients.map((r) => r.id));
          for (const learner of matchingLearners) {
            if (!alreadyMatchedIds.has(learner.id)) {
              expect(recipientIds.has(learner.id)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 150 }
    );
  });

  it('count equals zero when all matching learners are already matched', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 1, maxLength: 80 }),
        tradeArb,
        (learners, filterTrade) => {
          const matchingLearners = learners.filter(
            (l) => l.status === 'active' && l.trade === filterTrade
          );

          // Exclude ALL matching learners
          const alreadyMatchedIds = new Set(matchingLearners.map((l) => l.id));

          const result = broadcastWithExcludeApplied(
            learners,
            { trade: filterTrade },
            alreadyMatchedIds
          );

          expect(result.count).toBe(0);
          expect(result.recipients).toHaveLength(0);
        }
      ),
      { numRuns: 150 }
    );
  });

  it('count equals all matching learners when none are already matched', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 1, maxLength: 80 }),
        tradeArb,
        (learners, filterTrade) => {
          const matchingLearners = learners.filter(
            (l) => l.status === 'active' && l.trade === filterTrade
          );

          // No existing matches
          const alreadyMatchedIds = new Set<string>();

          const result = broadcastWithExcludeApplied(
            learners,
            { trade: filterTrade },
            alreadyMatchedIds
          );

          expect(result.count).toBe(matchingLearners.length);
          expect(result.recipients).toHaveLength(matchingLearners.length);
        }
      ),
      { numRuns: 150 }
    );
  });

  it('new match records are created only for recipients (not for excluded learners)', () => {
    fc.assert(
      fc.property(
        fc.array(learnerArb, { minLength: 1, maxLength: 80 }),
        tradeArb,
        (learners, filterTrade) => {
          const matchingLearners = learners.filter(
            (l) => l.status === 'active' && l.trade === filterTrade
          );

          // Exclude every other matching learner
          const alreadyMatchedIds = new Set(
            matchingLearners.filter((_, idx) => idx % 2 === 0).map((l) => l.id)
          );

          const result = broadcastWithExcludeApplied(
            learners,
            { trade: filterTrade },
            alreadyMatchedIds
          );

          // Simulate: new match records would be created for recipients only
          const newMatchRecordIds = new Set(result.recipients.map((r) => r.id));

          // No new match record should be for an already-matched learner
          for (const id of alreadyMatchedIds) {
            expect(newMatchRecordIds.has(id)).toBe(false);
          }

          // All new match records should be for qualifying learners
          for (const id of newMatchRecordIds) {
            const learner = matchingLearners.find((l) => l.id === id);
            expect(learner).toBeDefined();
            expect(alreadyMatchedIds.has(id)).toBe(false);
          }
        }
      ),
      { numRuns: 150 }
    );
  });
});
