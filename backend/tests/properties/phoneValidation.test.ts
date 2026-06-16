import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DocumentParserService } from '../../src/services/documentParserService.js';

/**
 * Validates: Requirements 5.7
 *
 * Property 12: Phone Number Validation (Indian Mobile Format)
 * For any string extracted as a phone number, the validation function SHALL
 * accept it if and only if it consists of exactly 10 digits and the first
 * digit is 6, 7, 8, or 9.
 */

const service = new DocumentParserService();

/** Arbitrary for a single digit character '0'-'9' */
const digitCharArb = fc.integer({ min: 0, max: 9 }).map(String);

/** Generate a string of exactly N digit characters */
function digitString(length: number) {
  return fc.array(digitCharArb, { minLength: length, maxLength: length }).map((arr) => arr.join(''));
}

/** Generate a digit-only string of a given length range */
function digitStringRange(minLength: number, maxLength: number) {
  return fc.array(digitCharArb, { minLength, maxLength }).map((arr) => arr.join(''));
}

describe('Property 12: Phone Number Validation (Indian Mobile Format)', () => {
  /**
   * Generator for valid Indian mobile numbers:
   * exactly 10 digits, first digit in {6, 7, 8, 9}
   */
  const validPhoneArb = fc
    .tuple(
      fc.constantFrom('6', '7', '8', '9'),
      digitString(9)
    )
    .map(([first, rest]) => first + rest);

  it('any 10-digit string starting with 6-9 is accepted', () => {
    fc.assert(
      fc.property(validPhoneArb, (phone) => {
        expect(service.isValidIndianMobile(phone)).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('any string of length ≠ 10 is rejected', () => {
    // Generate digit-only strings that are NOT 10 characters long
    const wrongLengthArb = digitStringRange(0, 20).filter((s) => s.length !== 10);

    fc.assert(
      fc.property(wrongLengthArb, (phone) => {
        expect(service.isValidIndianMobile(phone)).toBe(false);
      }),
      { numRuns: 500 }
    );
  });

  it('any 10-digit string starting with 0-5 is rejected', () => {
    const invalidStartArb = fc
      .tuple(
        fc.constantFrom('0', '1', '2', '3', '4', '5'),
        digitString(9)
      )
      .map(([first, rest]) => first + rest);

    fc.assert(
      fc.property(invalidStartArb, (phone) => {
        expect(service.isValidIndianMobile(phone)).toBe(false);
      }),
      { numRuns: 500 }
    );
  });

  it('any string containing non-digit characters is rejected', () => {
    // Generate non-digit characters (printable ASCII excluding 0-9)
    const nonDigitCharArb = fc.oneof(
      fc.integer({ min: 32, max: 47 }).map((c) => String.fromCharCode(c)),   // space to /
      fc.integer({ min: 58, max: 126 }).map((c) => String.fromCharCode(c))   // : to ~
    );

    // Build a 10-char string with at least one non-digit injected
    const mixedStringArb = fc
      .tuple(
        digitString(9),                    // 9 valid digits
        nonDigitCharArb,                   // 1 non-digit character
        fc.integer({ min: 0, max: 9 })     // position to insert non-digit
      )
      .map(([digits, badChar, pos]) => {
        const chars = digits.split('');
        chars.splice(pos, 0, badChar);     // Insert non-digit, making length 10
        return chars.join('');
      });

    fc.assert(
      fc.property(mixedStringArb, (phone) => {
        expect(service.isValidIndianMobile(phone)).toBe(false);
      }),
      { numRuns: 500 }
    );
  });
});
