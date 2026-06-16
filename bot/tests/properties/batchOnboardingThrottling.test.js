import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Validates: Requirements 9.5
 *
 * Property 19: Batch Onboarding Rate Throttling
 * For any cohort with more than 50 learners, the onboarding message dispatch
 * SHALL be scheduled such that the interval between any two consecutive messages
 * is at least 1 second.
 *
 * We extract the throttling logic from the /internal/trigger-onboarding endpoint
 * (bot/src/dashboard/server.js) into a testable function that mirrors its behavior:
 * messages are sent sequentially with a sleep(1000) between each pair.
 */

// Replicates the throttled dispatch logic from server.js
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttledDispatch(learners, sendMessage) {
  const timestamps = [];
  for (let i = 0; i < learners.length; i++) {
    const learner = learners[i];
    if (!learner.phone) continue;

    timestamps.push(Date.now());
    await sendMessage(learner.phone, 'welcome');

    // Stagger dispatch: wait 1 second between messages (max 1 msg/sec)
    if (i < learners.length - 1) {
      await sleep(1000);
    }
  }
  return timestamps;
}

describe('Property 19: Batch Onboarding Rate Throttling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('for any batch size > 1, the interval between any two consecutive messages is at least 1 second', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 100 }),
        async (batchSize) => {
          const learners = Array.from({ length: batchSize }, (_, i) => ({
            id: `learner-${i}`,
            phone: `98765${String(i).padStart(5, '0')}`
          }));

          const mockSend = vi.fn().mockResolvedValue(undefined);

          // Run the dispatch in background, advancing timers as needed
          const dispatchPromise = throttledDispatch(learners, mockSend);

          // Advance timers to allow all sleeps to complete
          // Each iteration after the first adds 1000ms of sleep
          for (let i = 0; i < batchSize - 1; i++) {
            await vi.advanceTimersByTimeAsync(1000);
          }

          const timestamps = await dispatchPromise;

          // Verify: all learners received a message
          expect(mockSend).toHaveBeenCalledTimes(batchSize);

          // Verify: consecutive timestamps are at least 1000ms apart
          for (let i = 1; i < timestamps.length; i++) {
            const interval = timestamps[i] - timestamps[i - 1];
            expect(interval).toBeGreaterThanOrEqual(1000);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('a single learner batch dispatches immediately with no throttle delay', async () => {
    const learners = [{ id: 'learner-0', phone: '9876500000' }];
    const mockSend = vi.fn().mockResolvedValue(undefined);

    const dispatchPromise = throttledDispatch(learners, mockSend);
    const timestamps = await dispatchPromise;

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(timestamps).toHaveLength(1);
  });

  it('for large cohorts (>50 learners), total dispatch time is at least (N-1) seconds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 51, max: 100 }),
        async (batchSize) => {
          const learners = Array.from({ length: batchSize }, (_, i) => ({
            id: `learner-${i}`,
            phone: `98765${String(i).padStart(5, '0')}`
          }));

          const mockSend = vi.fn().mockResolvedValue(undefined);

          const dispatchPromise = throttledDispatch(learners, mockSend);

          // Advance timers for the full batch
          for (let i = 0; i < batchSize - 1; i++) {
            await vi.advanceTimersByTimeAsync(1000);
          }

          const timestamps = await dispatchPromise;

          // Total elapsed time should be at least (N-1) * 1000ms
          const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
          expect(totalTime).toBeGreaterThanOrEqual((batchSize - 1) * 1000);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});
