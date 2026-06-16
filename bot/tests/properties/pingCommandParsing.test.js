import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { EmployerPingService } from '../../src/services/employerPingService.js';

/**
 * Validates: Requirements 3.1
 *
 * Property 5: Employer Ping Command Parsing Round-Trip
 * For any valid employer ping consisting of a target phone number (10-digit Indian mobile
 * starting with 6-9) and a message body (1-1000 chars, non-empty), formatting it as
 * "msg learner:<phone>: <message>" and then parsing it SHALL produce the original
 * phone number and message body.
 */

describe('Property 5: Employer Ping Command Parsing Round-Trip', () => {
  const service = new EmployerPingService({ store: {}, sendMessage: vi.fn() });

  // Generator for valid 10-digit Indian mobile numbers starting with 6-9
  const validPhone = fc.integer({ min: 6000000000, max: 9999999999 }).map(n => String(n));

  // Generator for valid message bodies:
  // - Non-empty, pre-trimmed (no leading/trailing whitespace)
  // - Printable characters including internal spaces
  // - No newlines or carriage returns
  const printableChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*()-_=+[]{}|;,.<>?/~';
  const validMessage = fc
    .array(fc.constantFrom(...printableChars.split('')), { minLength: 1, maxLength: 200 })
    .map(chars => chars.join(''))
    .filter(s => s.trim().length > 0 && s.trim() === s);

  it('round-trips phone and message through format-then-parse', () => {
    fc.assert(
      fc.property(validPhone, validMessage, (phone, message) => {
        const formatted = `msg learner:${phone}: ${message}`;
        const parsed = service.parseEmployerCommand(formatted);

        // Parsing must succeed
        expect(parsed).not.toBeNull();
        // Phone round-trips exactly
        expect(parsed.phone).toBe(phone);
        // Message round-trips exactly (no trimming needed since we generate pre-trimmed messages)
        expect(parsed.message).toBe(message);
      }),
      { numRuns: 500 }
    );
  });

  it('round-trips phone and message with internal whitespace preserved', () => {
    // Messages with internal spaces should preserve through round-trip
    const messageWithSpaces = fc
      .array(
        fc.oneof(
          fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
          fc.constant(' ')
        ),
        { minLength: 2, maxLength: 50 }
      )
      .map(parts => parts.join(''))
      .filter(s => s.trim().length > 0 && s.trim() === s);

    fc.assert(
      fc.property(validPhone, messageWithSpaces, (phone, message) => {
        const formatted = `msg learner:${phone}: ${message}`;
        const parsed = service.parseEmployerCommand(formatted);

        expect(parsed).not.toBeNull();
        expect(parsed.phone).toBe(phone);
        expect(parsed.message).toBe(message);
      }),
      { numRuns: 200 }
    );
  });

  it('round-trips correctly with trimmed comparison for messages with whitespace padding', () => {
    // For messages that may have leading/trailing whitespace, the round-trip
    // should produce the trimmed version
    const anyMessage = fc
      .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz 0123456789'.split('')), { minLength: 1, maxLength: 200 })
      .map(chars => chars.join(''))
      .filter(s => s.trim().length > 0);

    fc.assert(
      fc.property(validPhone, anyMessage, (phone, message) => {
        const formatted = `msg learner:${phone}: ${message}`;
        const parsed = service.parseEmployerCommand(formatted);

        expect(parsed).not.toBeNull();
        expect(parsed.phone).toBe(phone);
        // The parser trims the message, so round-trip produces trimmed version
        expect(parsed.message).toBe(message.trim());
      }),
      { numRuns: 500 }
    );
  });
});
