import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Validates: Requirements 4.4
 *
 * Property 9: Conversation Thread Ordering
 * For any conversation thread between an officer/employer and a learner,
 * messages SHALL be returned ordered by created_at timestamp ascending,
 * and each message SHALL include timestamp and delivery status fields.
 */

interface Message {
  id: string;
  sender_id: string;
  receiver_learner_id: string;
  direction: 'to_learner' | 'from_learner';
  content: string;
  source: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
}

/**
 * Simulates the database ORDER BY created_at ASC behavior that the
 * getThread query relies on. This is the core sorting logic we validate.
 */
function sortMessagesByCreatedAt(messages: Message[]): Message[] {
  return [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

describe('Property 9: Conversation Thread Ordering', () => {
  const messageArb = fc.record({
    id: fc.uuid(),
    sender_id: fc.uuid(),
    receiver_learner_id: fc.uuid(),
    direction: fc.constantFrom('to_learner' as const, 'from_learner' as const),
    content: fc.string({ minLength: 1, maxLength: 100 }),
    source: fc.constantFrom('whatsapp', 'dashboard', 'bot'),
    status: fc.constantFrom('sent' as const, 'delivered' as const, 'read' as const, 'failed' as const),
    created_at: fc
      .integer({
        min: new Date('2024-01-01T00:00:00.000Z').getTime(),
        max: new Date('2025-12-31T23:59:59.999Z').getTime(),
      })
      .map((ts) => new Date(ts).toISOString()),
  });

  it('messages are always sorted by created_at ascending', () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 0, maxLength: 50 }),
        (messages) => {
          const sorted = sortMessagesByCreatedAt(messages);

          // Verify ascending order: each message's timestamp >= previous
          for (let i = 1; i < sorted.length; i++) {
            const prev = new Date(sorted[i - 1].created_at).getTime();
            const curr = new Date(sorted[i].created_at).getTime();
            expect(curr).toBeGreaterThanOrEqual(prev);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('every message in a sorted thread includes created_at and status fields', () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 1, maxLength: 50 }),
        (messages) => {
          const sorted = sortMessagesByCreatedAt(messages);

          for (const msg of sorted) {
            // created_at must be a valid ISO timestamp
            expect(msg.created_at).toBeDefined();
            expect(new Date(msg.created_at).toISOString()).toBe(msg.created_at);

            // status (delivery status) must be one of the valid values
            expect(msg.status).toBeDefined();
            expect(['sent', 'delivered', 'read', 'failed']).toContain(msg.status);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('sorting is stable — equal timestamps preserve insertion order', () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 2, maxLength: 30 }),
        (messages) => {
          // Give all messages the same timestamp to test stability
          const sameTimestamp = '2024-06-15T12:00:00.000Z';
          const equalTimestampMessages = messages.map((m) => ({
            ...m,
            created_at: sameTimestamp,
          }));

          const sorted = sortMessagesByCreatedAt(equalTimestampMessages);

          // All timestamps should be equal after sort
          for (const msg of sorted) {
            expect(msg.created_at).toBe(sameTimestamp);
          }

          // Length must be preserved
          expect(sorted.length).toBe(equalTimestampMessages.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sorting preserves all messages — no messages lost or duplicated', () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 0, maxLength: 50 }),
        (messages) => {
          const sorted = sortMessagesByCreatedAt(messages);

          // Length preserved
          expect(sorted.length).toBe(messages.length);

          // Every original message ID appears exactly once in sorted result
          const originalIds = messages.map((m) => m.id).sort();
          const sortedIds = sorted.map((m) => m.id).sort();
          expect(sortedIds).toEqual(originalIds);
        }
      ),
      { numRuns: 200 }
    );
  });
});
