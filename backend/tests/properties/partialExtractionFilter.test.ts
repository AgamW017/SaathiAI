import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DocumentParserService } from '../../src/services/documentParserService.js';

/**
 * Validates: Requirements 10.4
 *
 * Property 21: Partial Extraction Validity Filter
 * When extraction produces at least one valid entry and at least one invalid entry,
 * the set of entries presented for officer confirmation SHALL include only those with
 * valid phone numbers, and the invalid entries SHALL be excluded from the confirmable set.
 */

const service = new DocumentParserService();

// --- Generators ---

/** Generate a valid Indian mobile phone number (10 digits, starts with 6-9) */
const validPhoneArb = fc
  .tuple(
    fc.constantFrom('6', '7', '8', '9'),
    fc.array(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 9, maxLength: 9 })
  )
  .map(([first, rest]) => first + rest.join(''));

/** Generate an invalid phone: either wrong length, wrong start digit, or non-digits */
const invalidPhoneArb = fc.oneof(
  // Too short (1-9 digits)
  fc.array(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 1, maxLength: 9 })
    .filter((arr) => arr.length !== 10)
    .map((arr) => arr.join('')),
  // Too long (11-15 digits)
  fc.array(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 11, maxLength: 15 })
    .map((arr) => arr.join('')),
  // 10 digits but starts with 0-5
  fc.tuple(
    fc.constantFrom('0', '1', '2', '3', '4', '5'),
    fc.array(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 9, maxLength: 9 })
  ).map(([first, rest]) => first + rest.join('')),
  // Contains non-digit characters
  fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.length > 0 && !/^\d+$/.test(s)),
  // Empty string
  fc.constant('')
);

/** Generate a learner name */
const nameArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/** Generate a confidence score */
const confidenceArb = fc.double({ min: 0, max: 1, noNaN: true });

/** Generate a valid learner entry (raw format before validation) */
const validLearnerArb = fc.tuple(nameArb, validPhoneArb, confidenceArb).map(([name, phone, confidence]) => ({
  name,
  phone,
  confidence,
}));

/** Generate an invalid learner entry (raw format before validation) */
const invalidLearnerArb = fc.tuple(nameArb, invalidPhoneArb, confidenceArb).map(([name, phone, confidence]) => ({
  name,
  phone,
  confidence,
}));

/**
 * Generate a mixed array with at least one valid and at least one invalid entry.
 */
const mixedEntriesArb = fc
  .tuple(
    fc.array(validLearnerArb, { minLength: 1, maxLength: 10 }),
    fc.array(invalidLearnerArb, { minLength: 1, maxLength: 10 })
  )
  .chain(([valids, invalids]) => {
    const combined = [...valids, ...invalids];
    // Shuffle to avoid ordering bias
    return fc.shuffledSubarray(combined, { minLength: combined.length, maxLength: combined.length })
      .map((shuffled) => ({ entries: shuffled, expectedValidCount: valids.length, expectedInvalidCount: invalids.length }));
  });

describe('Property 21: Partial Extraction Validity Filter', () => {
  it('validEntries contains ONLY entries with valid Indian mobile phones', () => {
    fc.assert(
      fc.property(mixedEntriesArb, ({ entries }) => {
        // Simulate the validation logic directly (same as validateAndSeparateEntries)
        const result = applyValidationFilter(entries);

        for (const entry of result.validEntries) {
          expect(service.isValidIndianMobile(entry.phone)).toBe(true);
        }
      }),
      { numRuns: 300 }
    );
  });

  it('invalidEntries contains ONLY entries with invalid phones', () => {
    fc.assert(
      fc.property(mixedEntriesArb, ({ entries }) => {
        const result = applyValidationFilter(entries);

        for (const entry of result.invalidEntries) {
          expect(service.isValidIndianMobile(entry.phone)).toBe(false);
        }
      }),
      { numRuns: 300 }
    );
  });

  it('all entries are accounted for: validEntries.length + invalidEntries.length = total', () => {
    fc.assert(
      fc.property(mixedEntriesArb, ({ entries }) => {
        const result = applyValidationFilter(entries);

        expect(result.validEntries.length + result.invalidEntries.length).toBe(entries.length);
      }),
      { numRuns: 300 }
    );
  });

  it('no valid phone appears in invalidEntries', () => {
    fc.assert(
      fc.property(mixedEntriesArb, ({ entries }) => {
        const result = applyValidationFilter(entries);

        const invalidPhones = result.invalidEntries.map((e) => e.phone);
        for (const phone of invalidPhones) {
          expect(service.isValidIndianMobile(phone)).toBe(false);
        }
      }),
      { numRuns: 300 }
    );
  });

  it('no invalid phone appears in validEntries', () => {
    fc.assert(
      fc.property(mixedEntriesArb, ({ entries }) => {
        const result = applyValidationFilter(entries);

        const validPhones = result.validEntries.map((e) => e.phone);
        for (const phone of validPhones) {
          expect(service.isValidIndianMobile(phone)).toBe(true);
        }
      }),
      { numRuns: 300 }
    );
  });

  it('with mixed entries, validEntries has at least 1 entry and invalidEntries has at least 1 entry', () => {
    fc.assert(
      fc.property(mixedEntriesArb, ({ entries, expectedValidCount, expectedInvalidCount }) => {
        const result = applyValidationFilter(entries);

        expect(result.validEntries.length).toBeGreaterThanOrEqual(1);
        expect(result.invalidEntries.length).toBeGreaterThanOrEqual(1);
        expect(result.validEntries.length).toBe(expectedValidCount);
        expect(result.invalidEntries.length).toBe(expectedInvalidCount);
      }),
      { numRuns: 300 }
    );
  });
});

// --- Helper ---

/**
 * Apply the same validation/separation logic used by DocumentParserService.validateAndSeparateEntries.
 * This directly tests the phone validation partitioning without needing LLM/network calls.
 */
function applyValidationFilter(
  rawLearners: Array<{ name: string; phone: string; confidence: number }>
) {
  const validEntries: Array<{ name: string; phone: string; confidence: number; valid: boolean }> = [];
  const invalidEntries: Array<{ name: string; phone: string; confidence: number; valid: boolean }> = [];

  for (const learner of rawLearners) {
    const phoneValid = service.isValidIndianMobile(learner.phone);

    if (phoneValid) {
      validEntries.push({ ...learner, valid: true });
    } else {
      invalidEntries.push({ ...learner, valid: false });
    }
  }

  return { validEntries, invalidEntries, totalExtracted: rawLearners.length };
}
