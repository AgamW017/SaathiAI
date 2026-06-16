import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { PlacementTrackerService } from '../../src/services/placementTrackerService.js';

/**
 * Property 1: Salary and Retention Scheduling Correctness
 *
 * For any placement with a confirmed date, the salary capture nudge SHALL be
 * scheduled exactly 7 days after placement, and retention checks SHALL be
 * scheduled at exactly 30, 60, and 90 days after placement.
 *
 * **Validates: Requirements 1.1, 2.1**
 */
describe('Property: Salary and Retention Scheduling Correctness', () => {
  let insertedDays;
  let mockStore;
  let service;

  beforeEach(() => {
    insertedDays = [];
    mockStore = {
      query: vi.fn().mockImplementation((sql, params) => {
        if (sql.includes('INSERT INTO retention_checks')) {
          // check_day is the 3rd parameter ($3)
          insertedDays.push(params[2]);
          return [{ id: 'test-id', placement_id: params[0], learner_id: params[1], check_day: params[2], status: 'pending' }];
        }
        return [];
      }),
      queryOne: vi.fn().mockResolvedValue({ id: 'placement-123' })
    };

    service = new PlacementTrackerService({ store: mockStore, gemini: null, sendMessage: vi.fn() });
  });

  it('schedules exactly days 7, 30, 60, 90 for any valid placement date', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date('2023-01-01'), max: new Date('2025-12-31') }),
        async (placementDate) => {
          insertedDays.length = 0;

          await service.scheduleSalaryCapture('learner-1', placementDate);
          await service.scheduleRetentionChecks('learner-1', placementDate);

          const sorted = [...insertedDays].sort((a, b) => a - b);
          expect(sorted).toEqual([7, 30, 60, 90]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('scheduleSalaryCapture always creates a record with check_day=7', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date('2023-01-01'), max: new Date('2025-12-31') }),
        async (placementDate) => {
          insertedDays.length = 0;

          await service.scheduleSalaryCapture('learner-1', placementDate);

          expect(insertedDays).toEqual([7]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('scheduleRetentionChecks always creates records with check_days=[30, 60, 90]', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date('2023-01-01'), max: new Date('2025-12-31') }),
        async (placementDate) => {
          insertedDays.length = 0;

          await service.scheduleRetentionChecks('learner-1', placementDate);

          const sorted = [...insertedDays].sort((a, b) => a - b);
          expect(sorted).toEqual([30, 60, 90]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
