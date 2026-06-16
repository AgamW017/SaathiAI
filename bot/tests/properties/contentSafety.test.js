import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { checkMessage } from '../../src/services/contentSafetyService.js';

/**
 * Validates: Requirements 8.1, 8.2, 8.3
 *
 * Property 18: Sensitive Content Filtering
 * For any message submitted for relay that contains patterns matching Aadhaar numbers
 * (12-digit numeric), bank account numbers (9-18 consecutive digits), or OTP request phrases,
 * the relay SHALL be rejected. Messages without such patterns and within 1000 characters
 * SHALL be accepted.
 */

// Helper: generate a string of exactly N digits
const digitString = (length) =>
  fc.array(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: length, maxLength: length })
    .map(arr => arr.join(''));

// Helper: generate alphabetic-only string of given length range
const alphaString = (minLength, maxLength) =>
  fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), { minLength, maxLength })
    .map(arr => arr.join(''));

describe('Property 18: Sensitive Content Filtering', () => {
  it('rejects messages containing 12-digit Aadhaar patterns', () => {
    fc.assert(
      fc.property(
        digitString(12),
        (digits) => {
          const msg = `Hello ${digits} world`;
          return checkMessage(msg).safe === false;
        }
      )
    );
  });

  it('rejects messages containing OTP keywords', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('OTP', 'otp', 'one-time password', 'verification code', 'ONE TIME PASSWORD'),
        (keyword) => {
          const msg = `Please share your ${keyword} with me`;
          return checkMessage(msg).safe === false;
        }
      )
    );
  });

  it('rejects messages over 1000 characters', () => {
    fc.assert(
      fc.property(
        alphaString(1001, 2000),
        (msg) => {
          return checkMessage(msg).safe === false;
        }
      )
    );
  });

  it('accepts short alphabetic messages without sensitive patterns', () => {
    fc.assert(
      fc.property(
        alphaString(1, 100).filter(s => s.trim().length > 0),
        (msg) => {
          return checkMessage(msg).safe === true;
        }
      )
    );
  });

  it('accepts messages with exactly 8 digits (not enough for bank account)', () => {
    fc.assert(
      fc.property(
        digitString(8),
        (digits) => {
          const msg = `ref number ${digits} thanks`;
          return checkMessage(msg).safe === true;
        }
      )
    );
  });
});
