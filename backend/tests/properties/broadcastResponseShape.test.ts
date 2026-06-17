import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: vacancy-actions-menu, Property 5: Response Shape Invariant
 *
 * For any invocation of the broadcast mutation (with or without `exclude_applied`),
 * the response shall always contain a numeric `count` field (≥ 0) and a valid
 * ISO 8601 `broadcast_at` timestamp string.
 *
 * **Validates: Requirements 8.3**
 *
 * This tests the pure response construction logic extracted from the broadcast
 * mutation. Given any set of matching learners (after optional exclusion filtering),
 * the response shape is always { count: number (≥ 0), broadcast_at: valid ISO string }.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface Learner {
  id: string;
  phone: string;
  full_name: string;
}

interface BroadcastResponse {
  count: number;
  broadcast_at: string;
}

// ─── Pure logic replicating broadcast response construction ──────────────────

/**
 * Replicates the broadcast mutation's response construction.
 * After filtering learners (with or without exclude_applied), the mutation
 * always returns { count: <number of recipients>, broadcast_at: <ISO timestamp> }.
 */
function buildBroadcastResponse(
  allMatchingLearners: Learner[],
  existingMatchLearnerIds: string[],
  excludeApplied: boolean
): BroadcastResponse {
  const broadcastAt = new Date().toISOString();

  let recipients = allMatchingLearners;

  if (excludeApplied && allMatchingLearners.length > 0) {
    const excludedIds = new Set(existingMatchLearnerIds);
    recipients = allMatchingLearners.filter((l) => !excludedIds.has(l.id));
  }

  return { count: recipients.length, broadcast_at: broadcastAt };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const uuidArb = fc.uuid();

const learnerArb: fc.Arbitrary<Learner> = fc.record({
  id: uuidArb,
  phone: fc.stringMatching(/^\+91[6-9]\d{9}$/),
  full_name: fc.string({ minLength: 2, maxLength: 50 }),
});

const learnerArrayArb = fc.array(learnerArb, { minLength: 0, maxLength: 100 });

const excludeAppliedArb = fc.boolean();

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: vacancy-actions-menu, Property 5: Response Shape Invariant', () => {
  it('response always contains a numeric count field that is >= 0', () => {
    fc.assert(
      fc.property(
        learnerArrayArb,
        fc.array(uuidArb, { minLength: 0, maxLength: 50 }),
        excludeAppliedArb,
        (learners, existingMatchIds, excludeApplied) => {
          const response = buildBroadcastResponse(learners, existingMatchIds, excludeApplied);

          expect(typeof response.count).toBe('number');
          expect(response.count).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(response.count)).toBe(true);
          expect(Number.isInteger(response.count)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('response always contains a valid ISO 8601 broadcast_at string', () => {
    fc.assert(
      fc.property(
        learnerArrayArb,
        fc.array(uuidArb, { minLength: 0, maxLength: 50 }),
        excludeAppliedArb,
        (learners, existingMatchIds, excludeApplied) => {
          const response = buildBroadcastResponse(learners, existingMatchIds, excludeApplied);

          expect(typeof response.broadcast_at).toBe('string');
          // Must be parseable by Date and not NaN
          const parsed = new Date(response.broadcast_at);
          expect(parsed.getTime()).not.toBeNaN();
          // Must match ISO 8601 format (Date.toISOString() output)
          expect(response.broadcast_at).toBe(parsed.toISOString());
        }
      ),
      { numRuns: 200 }
    );
  });

  it('response shape is consistent regardless of exclude_applied flag value', () => {
    fc.assert(
      fc.property(
        learnerArrayArb,
        fc.array(uuidArb, { minLength: 0, maxLength: 50 }),
        (learners, existingMatchIds) => {
          const responseWithExclude = buildBroadcastResponse(learners, existingMatchIds, true);
          const responseWithoutExclude = buildBroadcastResponse(learners, existingMatchIds, false);

          // Both responses must have the same shape
          expect(Object.keys(responseWithExclude).sort()).toEqual(['broadcast_at', 'count']);
          expect(Object.keys(responseWithoutExclude).sort()).toEqual(['broadcast_at', 'count']);

          // Both counts must be numbers >= 0
          expect(typeof responseWithExclude.count).toBe('number');
          expect(responseWithExclude.count).toBeGreaterThanOrEqual(0);
          expect(typeof responseWithoutExclude.count).toBe('number');
          expect(responseWithoutExclude.count).toBeGreaterThanOrEqual(0);

          // Both broadcast_at must be valid ISO strings
          expect(new Date(responseWithExclude.broadcast_at).getTime()).not.toBeNaN();
          expect(new Date(responseWithoutExclude.broadcast_at).getTime()).not.toBeNaN();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('count never exceeds the total number of matching learners', () => {
    fc.assert(
      fc.property(
        learnerArrayArb,
        fc.array(uuidArb, { minLength: 0, maxLength: 50 }),
        excludeAppliedArb,
        (learners, existingMatchIds, excludeApplied) => {
          const response = buildBroadcastResponse(learners, existingMatchIds, excludeApplied);
          expect(response.count).toBeLessThanOrEqual(learners.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('count equals total learners when exclude_applied is false', () => {
    fc.assert(
      fc.property(
        learnerArrayArb,
        fc.array(uuidArb, { minLength: 0, maxLength: 50 }),
        (learners, existingMatchIds) => {
          const response = buildBroadcastResponse(learners, existingMatchIds, false);
          expect(response.count).toBe(learners.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('count is 0 when there are no matching learners regardless of exclude_applied', () => {
    fc.assert(
      fc.property(
        fc.array(uuidArb, { minLength: 0, maxLength: 50 }),
        excludeAppliedArb,
        (existingMatchIds, excludeApplied) => {
          const response = buildBroadcastResponse([], existingMatchIds, excludeApplied);

          expect(response.count).toBe(0);
          expect(typeof response.broadcast_at).toBe('string');
          expect(new Date(response.broadcast_at).getTime()).not.toBeNaN();
        }
      ),
      { numRuns: 100 }
    );
  });
});
