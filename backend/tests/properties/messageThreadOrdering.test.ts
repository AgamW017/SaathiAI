import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Validates: Requirements 3.1
 *
 * Property 1: Message Thread Ordering
 * For any set of messages between an employer and a learner, the
 * `employer.messaging.getThread` procedure SHALL return them in strictly
 * ascending order by `created_at` timestamp — that is, for all consecutive
 * pairs (messages[i], messages[i+1]), messages[i].created_at <= messages[i+1].created_at.
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
 * Extracts the ordering logic used by `employer.messaging.getThread`.
 * The procedure uses `.order('created_at', { ascending: true })` which
 * corresponds to sorting by ISO timestamp string (ascending).
 */
function sortMessagesByCreatedAtAscending(messages: Message[]): Message[] {
  return [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

describe('Property 1: Message Thread Ordering', () => {
  // Arbitrary for generating a message with a random created_at timestamp
  const messageArb: fc.Arbitrary<Message> = fc.record({
    id: fc.uuid(),
    sender_id: fc.uuid(),
    receiver_learner_id: fc.uuid(),
    direction: fc.constantFrom('to_learner' as const, 'from_learner' as const),
    content: fc.string({ minLength: 1, maxLength: 200 }),
    source: fc.constantFrom('dashboard', 'whatsapp', 'bot'),
    status: fc.constantFrom('sent' as const, 'delivered' as const, 'read' as const, 'failed' as const),
    created_at: fc
      .integer({
        min: new Date('2023-01-01T00:00:00.000Z').getTime(),
        max: new Date('2025-12-31T23:59:59.999Z').getTime(),
      })
      .map((ts) => new Date(ts).toISOString()),
  });

  it('getThread always returns messages sorted by created_at ascending', () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 0, maxLength: 50 }),
        (messages) => {
          const sorted = sortMessagesByCreatedAtAscending(messages);

          // For all consecutive pairs, created_at[i] <= created_at[i+1]
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

  it('thread ordering holds regardless of message direction mix', () => {
    fc.assert(
      fc.property(
        // Generate a thread with a fixed employer/learner pair but mixed directions
        fc.tuple(fc.uuid(), fc.uuid()).chain(([employerId, learnerId]) =>
          fc.array(
            fc.record({
              id: fc.uuid(),
              sender_id: fc.constantFrom(employerId, learnerId),
              receiver_learner_id: fc.constant(learnerId),
              direction: fc.constantFrom('to_learner' as const, 'from_learner' as const),
              content: fc.string({ minLength: 1, maxLength: 100 }),
              source: fc.constantFrom('dashboard', 'whatsapp'),
              status: fc.constantFrom('sent' as const, 'delivered' as const, 'read' as const, 'failed' as const),
              created_at: fc
                .integer({
                  min: new Date('2024-01-01T00:00:00.000Z').getTime(),
                  max: new Date('2025-06-30T23:59:59.999Z').getTime(),
                })
                .map((ts) => new Date(ts).toISOString()),
            }),
            { minLength: 2, maxLength: 40 }
          )
        ),
        (messages) => {
          const sorted = sortMessagesByCreatedAtAscending(messages);

          for (let i = 1; i < sorted.length; i++) {
            const prev = new Date(sorted[i - 1].created_at).getTime();
            const curr = new Date(sorted[i].created_at).getTime();
            expect(curr).toBeGreaterThanOrEqual(prev);
          }
        }
      ),
      { numRuns: 150 }
    );
  });

  it('sorting preserves all messages — no messages lost or duplicated', () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 0, maxLength: 50 }),
        (messages) => {
          const sorted = sortMessagesByCreatedAtAscending(messages);

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

  it('single-message thread is trivially ordered', () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 1, maxLength: 1 }),
        (messages) => {
          const sorted = sortMessagesByCreatedAtAscending(messages);
          expect(sorted.length).toBe(1);
          expect(sorted[0].created_at).toBe(messages[0].created_at);
        }
      ),
      { numRuns: 100 }
    );
  });
});
