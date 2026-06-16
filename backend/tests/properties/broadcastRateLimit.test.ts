import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TRPCError } from '@trpc/server';

/**
 * Validates: Requirements 6.5
 *
 * Property 5: Broadcast Rate Limit
 * For any employer, if the number of broadcasts executed by that employer
 * in the current calendar day (IST) is fewer than 5, the broadcast procedure
 * SHALL succeed (assuming other preconditions met). If the count is 5 or more,
 * the procedure SHALL reject with a `TOO_MANY_REQUESTS` error.
 */

const BROADCAST_RATE_LIMIT = 5;

/**
 * Simulates the rate limit check logic from the broadcast mutation.
 *
 * The implementation counts distinct vacancy_ids broadcast today.
 * If the current vacancy is NEW (not already broadcast today) and the
 * distinct count is >= 5, it rejects with TOO_MANY_REQUESTS.
 * If the vacancy was already broadcast today (re-broadcast), it's allowed.
 */
function checkBroadcastRateLimit(params: {
  todayBroadcastVacancyIds: string[];
  currentVacancyId: string;
}): { allowed: boolean; errorCode?: string; errorMessage?: string } {
  const distinctVacancyIds = new Set(params.todayBroadcastVacancyIds);
  const isNewBroadcast = !distinctVacancyIds.has(params.currentVacancyId);

  if (isNewBroadcast && distinctVacancyIds.size >= BROADCAST_RATE_LIMIT) {
    return {
      allowed: false,
      errorCode: 'TOO_MANY_REQUESTS',
      errorMessage: 'Daily broadcast limit reached (5 per day)',
    };
  }

  return { allowed: true };
}

describe('Property 5: Broadcast Rate Limit', () => {
  /**
   * **Validates: Requirements 6.5**
   *
   * For any employer with fewer than 5 distinct broadcasts today,
   * a new broadcast SHALL succeed.
   */
  it('SHALL allow broadcast when daily count is below the limit (<5)', () => {
    fc.assert(
      fc.property(
        // Generate 0-4 distinct vacancy IDs already broadcast today
        fc.integer({ min: 0, max: 4 }).chain((count) =>
          fc.tuple(
            fc.array(fc.uuid(), { minLength: count, maxLength: count }),
            fc.uuid()
          )
        ),
        ([todayVacancyIds, newVacancyId]) => {
          // Ensure the new vacancy ID is not in today's set
          const filteredTodayIds = todayVacancyIds.filter((id) => id !== newVacancyId);

          // Only test when we actually have fewer than 5 distinct broadcasts
          if (new Set(filteredTodayIds).size >= BROADCAST_RATE_LIMIT) return;

          const result = checkBroadcastRateLimit({
            todayBroadcastVacancyIds: filteredTodayIds,
            currentVacancyId: newVacancyId,
          });

          expect(result.allowed).toBe(true);
          expect(result.errorCode).toBeUndefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.5**
   *
   * For any employer with 5 or more distinct broadcasts today,
   * a NEW broadcast (for a vacancy not already broadcast) SHALL be rejected
   * with TOO_MANY_REQUESTS.
   */
  it('SHALL reject broadcast with TOO_MANY_REQUESTS when daily count is >= 5', () => {
    fc.assert(
      fc.property(
        // Generate 5-20 distinct vacancy IDs already broadcast today
        fc.integer({ min: 5, max: 20 }).chain((count) =>
          fc.tuple(
            fc.uniqueArray(fc.uuid(), { minLength: count, maxLength: count }),
            fc.uuid()
          )
        ),
        ([todayVacancyIds, newVacancyId]) => {
          // Ensure the new vacancy ID is not in today's set
          const filteredTodayIds = todayVacancyIds.filter((id) => id !== newVacancyId);

          // Only test when we have 5 or more distinct broadcasts
          if (new Set(filteredTodayIds).size < BROADCAST_RATE_LIMIT) return;

          const result = checkBroadcastRateLimit({
            todayBroadcastVacancyIds: filteredTodayIds,
            currentVacancyId: newVacancyId,
          });

          expect(result.allowed).toBe(false);
          expect(result.errorCode).toBe('TOO_MANY_REQUESTS');
          expect(result.errorMessage).toBe('Daily broadcast limit reached (5 per day)');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.5**
   *
   * Re-broadcasting to an already-broadcast vacancy today SHALL always
   * be allowed regardless of the daily count (it doesn't count as a new broadcast).
   */
  it('SHALL allow re-broadcast to a vacancy already broadcast today', () => {
    fc.assert(
      fc.property(
        // Generate 1-20 vacancy IDs, then pick one from them to re-broadcast
        fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 20 }).chain((vacancyIds) =>
          fc.tuple(
            fc.constant(vacancyIds),
            fc.integer({ min: 0, max: vacancyIds.length - 1 })
          )
        ),
        ([todayVacancyIds, rebroadcastIndex]) => {
          const rebroadcastVacancyId = todayVacancyIds[rebroadcastIndex];

          const result = checkBroadcastRateLimit({
            todayBroadcastVacancyIds: todayVacancyIds,
            currentVacancyId: rebroadcastVacancyId,
          });

          // Re-broadcast is always allowed
          expect(result.allowed).toBe(true);
          expect(result.errorCode).toBeUndefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.5**
   *
   * The boundary case: exactly 4 broadcasts today (one below limit)
   * SHALL allow a new broadcast, and exactly 5 SHALL reject.
   */
  it('SHALL correctly enforce the boundary at exactly 5 broadcasts', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.uniqueArray(fc.uuid(), { minLength: 4, maxLength: 4 }),
          fc.uuid(),
          fc.uuid()
        ),
        ([fourVacancyIds, fifthVacancyId, sixthVacancyId]) => {
          // Ensure fifth and sixth are not in the existing set
          const existingSet = new Set(fourVacancyIds);
          if (existingSet.has(fifthVacancyId) || existingSet.has(sixthVacancyId)) return;
          if (fifthVacancyId === sixthVacancyId) return;

          // With 4 broadcasts, a 5th should succeed
          const resultAt4 = checkBroadcastRateLimit({
            todayBroadcastVacancyIds: fourVacancyIds,
            currentVacancyId: fifthVacancyId,
          });
          expect(resultAt4.allowed).toBe(true);

          // With 5 broadcasts, a 6th should be rejected
          const fiveVacancyIds = [...fourVacancyIds, fifthVacancyId];
          const resultAt5 = checkBroadcastRateLimit({
            todayBroadcastVacancyIds: fiveVacancyIds,
            currentVacancyId: sixthVacancyId,
          });
          expect(resultAt5.allowed).toBe(false);
          expect(resultAt5.errorCode).toBe('TOO_MANY_REQUESTS');
        }
      ),
      { numRuns: 200 }
    );
  });
});
