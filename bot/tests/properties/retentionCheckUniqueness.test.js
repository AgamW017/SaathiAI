import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { PlacementTrackerService } from '../../src/services/placementTrackerService.js';

/**
 * Property 4: Retention Check Uniqueness
 *
 * For any placement, there SHALL exist at most one retention_check record per
 * check_day value (7, 30, 60, or 90). Attempting to create a duplicate check
 * for the same placement and check_day SHALL be rejected.
 *
 * **Validates: Requirements 2.9**
 */
describe('Property: Retention Check Uniqueness', () => {
  let insertedRecords;
  let mockStore;
  let service;

  beforeEach(() => {
    insertedRecords = new Map(); // key: "placementId-checkDay", value: record

    mockStore = {
      query: vi.fn().mockImplementation((sql, params) => {
        if (sql.includes('INSERT INTO retention_checks')) {
          const placementId = params[0];
          const checkDay = params[2];
          const key = `${placementId}-${checkDay}`;

          if (insertedRecords.has(key)) {
            // ON CONFLICT DO NOTHING — returns empty (no RETURNING row)
            return [];
          }

          const record = {
            id: `id-${key}`,
            placement_id: placementId,
            learner_id: params[1],
            check_day: checkDay,
            status: 'pending'
          };
          insertedRecords.set(key, record);
          return [record];
        }
        return [];
      }),
      queryOne: vi.fn().mockResolvedValue({ id: 'placement-123' })
    };

    service = new PlacementTrackerService({ store: mockStore, gemini: null, sendMessage: vi.fn() });
  });

  it('never creates duplicate checks for the same placement and check_day', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (repeatCount) => {
          insertedRecords.clear();

          for (let i = 0; i < repeatCount; i++) {
            await service.scheduleSalaryCapture('learner-1', new Date());
            await service.scheduleRetentionChecks('learner-1', new Date());
          }

          // Each check_day should appear at most once per placement
          const checkDays = [...insertedRecords.values()].map(r => r.check_day);
          const uniqueDays = new Set(checkDays);

          // Uniqueness: no duplicates
          expect(checkDays.length).toBe(uniqueDays.size);
          // At most 4 distinct check_days (7, 30, 60, 90)
          expect(uniqueDays.size).toBeLessThanOrEqual(4);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('produces exactly 4 distinct check_days regardless of repeat count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (repeatCount) => {
          insertedRecords.clear();

          for (let i = 0; i < repeatCount; i++) {
            await service.scheduleSalaryCapture('learner-1', new Date());
            await service.scheduleRetentionChecks('learner-1', new Date());
          }

          const checkDays = [...insertedRecords.values()].map(r => r.check_day).sort((a, b) => a - b);
          // Exactly 4 unique days inserted: 7, 30, 60, 90
          expect(checkDays).toEqual([7, 30, 60, 90]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('second call to schedule returns null/empty for already-existing check_days', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date('2023-01-01'), max: new Date('2025-12-31') }),
        async (placementDate) => {
          insertedRecords.clear();

          // First call — should create records
          const firstSalary = await service.scheduleSalaryCapture('learner-1', placementDate);
          const firstRetention = await service.scheduleRetentionChecks('learner-1', placementDate);

          expect(firstSalary).not.toBeNull();
          expect(firstRetention.length).toBe(3);

          // Second call — should be rejected (returns null/empty)
          const secondSalary = await service.scheduleSalaryCapture('learner-1', placementDate);
          const secondRetention = await service.scheduleRetentionChecks('learner-1', placementDate);

          expect(secondSalary).toBeNull();
          expect(secondRetention.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
