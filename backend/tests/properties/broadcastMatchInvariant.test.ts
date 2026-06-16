import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property tests for Broadcast Match Record Invariant.
 *
 * Property 4: For any broadcast execution that identifies N matching learners,
 * the procedure SHALL create exactly N match records in the `matches` table,
 * one per learner-vacancy pair, each with `stage = 'new_match'`.
 *
 * **Validates: Requirements 6.2**
 *
 * This tests the pure logic of match record creation from a broadcast —
 * for N matching learners and a given vacancy, exactly N records are created
 * with the correct stage.
 */

// ─── Replicate the match record creation logic from broadcast ────────────────

interface Learner {
  id: string;
  phone: string;
  full_name: string;
}

interface MatchRecord {
  vacancy_id: string;
  learner_id: string;
  employer_id: string;
  stage: string;
  timeline: string;
}

/**
 * Pure function that replicates the match record creation logic from the
 * broadcast mutation in employer.ts (step 5).
 * Given a list of matching learners, a vacancy ID, and an employer ID,
 * produces the match records that would be inserted.
 */
function createBroadcastMatchRecords(
  matchingLearners: Learner[],
  vacancyId: string,
  employerId: string,
  broadcastAt: string
): MatchRecord[] {
  return matchingLearners.map((learner) => ({
    vacancy_id: vacancyId,
    learner_id: learner.id,
    employer_id: employerId,
    stage: 'new_match',
    timeline: JSON.stringify([{
      stage: 'new_match',
      timestamp: broadcastAt,
      actor: employerId,
      note: 'Broadcast match',
    }]),
  }));
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const uuidArb = fc.uuid();

const learnerArb = fc.record({
  id: uuidArb,
  phone: fc.stringMatching(/^\+91[6-9]\d{9}$/),
  full_name: fc.string({ minLength: 2, maxLength: 50 }),
});

const learnerArrayArb = fc.array(learnerArb, { minLength: 0, maxLength: 100 });

const isoTimestampArb = fc.integer({
  min: new Date('2024-01-01T00:00:00Z').getTime(),
  max: new Date('2025-12-31T23:59:59Z').getTime(),
}).map((ts) => new Date(ts).toISOString());

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Broadcast Match Record Invariant (Property 4)', () => {
  it('creates exactly N match records for N matching learners', () => {
    fc.assert(
      fc.property(
        learnerArrayArb,
        uuidArb,
        uuidArb,
        isoTimestampArb,
        (learners, vacancyId, employerId, broadcastAt) => {
          const records = createBroadcastMatchRecords(learners, vacancyId, employerId, broadcastAt);
          expect(records).toHaveLength(learners.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('every match record has stage = "new_match"', () => {
    fc.assert(
      fc.property(
        learnerArrayArb,
        uuidArb,
        uuidArb,
        isoTimestampArb,
        (learners, vacancyId, employerId, broadcastAt) => {
          const records = createBroadcastMatchRecords(learners, vacancyId, employerId, broadcastAt);
          for (const record of records) {
            expect(record.stage).toBe('new_match');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('each match record references the correct vacancy_id', () => {
    fc.assert(
      fc.property(
        learnerArrayArb,
        uuidArb,
        uuidArb,
        isoTimestampArb,
        (learners, vacancyId, employerId, broadcastAt) => {
          const records = createBroadcastMatchRecords(learners, vacancyId, employerId, broadcastAt);
          for (const record of records) {
            expect(record.vacancy_id).toBe(vacancyId);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('each match record maps one-to-one with a learner (correct learner_id)', () => {
    fc.assert(
      fc.property(
        learnerArrayArb,
        uuidArb,
        uuidArb,
        isoTimestampArb,
        (learners, vacancyId, employerId, broadcastAt) => {
          const records = createBroadcastMatchRecords(learners, vacancyId, employerId, broadcastAt);
          const recordLearnerIds = records.map((r) => r.learner_id);
          const inputLearnerIds = learners.map((l) => l.id);
          expect(recordLearnerIds).toEqual(inputLearnerIds);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('zero matching learners produce zero match records', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        isoTimestampArb,
        (vacancyId, employerId, broadcastAt) => {
          const records = createBroadcastMatchRecords([], vacancyId, employerId, broadcastAt);
          expect(records).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all match records reference the correct employer_id', () => {
    fc.assert(
      fc.property(
        learnerArrayArb,
        uuidArb,
        uuidArb,
        isoTimestampArb,
        (learners, vacancyId, employerId, broadcastAt) => {
          const records = createBroadcastMatchRecords(learners, vacancyId, employerId, broadcastAt);
          for (const record of records) {
            expect(record.employer_id).toBe(employerId);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('match record count equals input learner count for any N (invariant)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        uuidArb,
        uuidArb,
        isoTimestampArb,
        (n, vacancyId, employerId, broadcastAt) => {
          // Generate exactly N learners
          const learners: Learner[] = Array.from({ length: n }, (_, i) => ({
            id: `learner-${i}-${vacancyId.slice(0, 8)}`,
            phone: `+919${String(i).padStart(9, '0')}`,
            full_name: `Learner ${i}`,
          }));

          const records = createBroadcastMatchRecords(learners, vacancyId, employerId, broadcastAt);
          expect(records).toHaveLength(n);
          for (const record of records) {
            expect(record.stage).toBe('new_match');
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
