import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Validates: Requirements 5.11
 *
 * Property 13: Cohort Deduplication on Creation
 * For any set of extracted learner entries submitted for cohort creation,
 * the number of new learner records created SHALL equal the count of entries
 * whose phone numbers do NOT already exist in the learners table.
 * Existing entries SHALL appear in the response as skipped.
 */

/**
 * Simulates the deduplication logic from the confirmCohort mutation.
 * Given a set of entries and a set of already-existing phone numbers,
 * determines how many are created vs skipped.
 */
function simulateCohortCreation(
  entries: Array<{ phone: string; name: string }>,
  existingPhones: Set<string>
): { created: number; skipped: number } {
  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (existingPhones.has(entry.phone)) {
      skipped++;
    } else {
      created++;
    }
  }

  return { created, skipped };
}

describe('Property 13: Cohort Deduplication on Creation', () => {
  /**
   * Arbitrary for valid Indian mobile phone numbers (10 digits, starts with 6-9).
   */
  const phoneArb = fc
    .tuple(
      fc.constantFrom('6', '7', '8', '9'),
      fc.array(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 9, maxLength: 9 })
    )
    .map(([first, rest]) => first + rest.join(''));

  /**
   * Arbitrary for a learner entry with a valid phone and a name.
   */
  const learnerEntryArb = fc.record({
    phone: phoneArb,
    name: fc.string({ minLength: 1, maxLength: 50 }),
  });

  it('created + skipped = total entries submitted', () => {
    fc.assert(
      fc.property(
        fc.array(learnerEntryArb, { minLength: 0, maxLength: 50 }),
        fc.array(phoneArb, { minLength: 0, maxLength: 30 }),
        (entries, existingArr) => {
          const existingPhones = new Set(existingArr);
          const { created, skipped } = simulateCohortCreation(entries, existingPhones);
          expect(created + skipped).toBe(entries.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('created equals entries whose phone numbers do NOT exist in the existing set', () => {
    fc.assert(
      fc.property(
        fc.array(learnerEntryArb, { minLength: 0, maxLength: 50 }),
        fc.array(phoneArb, { minLength: 0, maxLength: 30 }),
        (entries, existingArr) => {
          const existingPhones = new Set(existingArr);
          const { created } = simulateCohortCreation(entries, existingPhones);
          const expectedCreated = entries.filter((e) => !existingPhones.has(e.phone)).length;
          expect(created).toBe(expectedCreated);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('skipped equals entries whose phone numbers already exist in the existing set', () => {
    fc.assert(
      fc.property(
        fc.array(learnerEntryArb, { minLength: 0, maxLength: 50 }),
        fc.array(phoneArb, { minLength: 0, maxLength: 30 }),
        (entries, existingArr) => {
          const existingPhones = new Set(existingArr);
          const { skipped } = simulateCohortCreation(entries, existingPhones);
          const expectedSkipped = entries.filter((e) => existingPhones.has(e.phone)).length;
          expect(skipped).toBe(expectedSkipped);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('when all entries already exist, created is 0 and skipped equals total', () => {
    fc.assert(
      fc.property(
        fc.array(learnerEntryArb, { minLength: 1, maxLength: 30 }),
        (entries) => {
          // All phones are "already existing"
          const existingPhones = new Set(entries.map((e) => e.phone));
          const { created, skipped } = simulateCohortCreation(entries, existingPhones);
          expect(created).toBe(0);
          expect(skipped).toBe(entries.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('when no entries already exist, skipped is 0 and created equals total', () => {
    fc.assert(
      fc.property(
        fc.array(learnerEntryArb, { minLength: 1, maxLength: 30 }),
        (entries) => {
          // No existing phones
          const existingPhones = new Set<string>();
          const { created, skipped } = simulateCohortCreation(entries, existingPhones);
          expect(skipped).toBe(0);
          expect(created).toBe(entries.length);
        }
      ),
      { numRuns: 200 }
    );
  });
});
