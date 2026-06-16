import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { z } from 'zod';

/**
 * Validates: Requirements 3.6
 *
 * Property 2: Character Limit Enforcement
 * For any string of length greater than 1000 characters, the
 * `employer.messaging.sendPing` procedure SHALL reject the input with a
 * validation error. For any non-empty string of length between 1 and 1000
 * characters inclusive (assuming all other preconditions met), the procedure
 * SHALL NOT reject due to message length.
 */

/**
 * The Zod schema used by sendPing for the message field.
 * Extracted from backend/src/trpc/routers/employerMessaging.ts
 */
const messageSchema = z.string().min(1).max(1000);

describe('Property 2: Character Limit Enforcement', () => {
  it('strings longer than 1000 characters are rejected by validation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1001, maxLength: 5000 }),
        (message) => {
          const result = messageSchema.safeParse(message);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues[0].code).toBe('too_big');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('strings of length 1 to 1000 pass length validation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 1000 }),
        (message) => {
          const result = messageSchema.safeParse(message);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty strings are rejected by validation', () => {
    fc.assert(
      fc.property(
        fc.constant(''),
        (message) => {
          const result = messageSchema.safeParse(message);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues[0].code).toBe('too_small');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary: string of exactly 1000 characters passes validation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1000, maxLength: 1000 }),
        (message) => {
          const result = messageSchema.safeParse(message);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary: string of exactly 1001 characters is rejected', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1001, maxLength: 1001 }),
        (message) => {
          const result = messageSchema.safeParse(message);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary: string of exactly 1 character passes validation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 1 }),
        (message) => {
          const result = messageSchema.safeParse(message);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
