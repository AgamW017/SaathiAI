import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { EmployerPingService } from '../../src/services/employerPingService.js';

/**
 * Validates: Requirements 3.9, 3.10
 *
 * Property 8: Employer Ping Rate Limiting
 * For any employer and learner pair within a single calendar day, the system SHALL
 * accept at most 10 ping messages. The 11th and subsequent pings SHALL be rejected.
 */

describe('Property 8: Employer Ping Rate Limiting', () => {
  it('allows pings when count is below 10', () => {
    fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 9 }), async (currentCount) => {
        const mockStore = {
          queryOne: vi.fn().mockResolvedValue({ count: String(currentCount) }),
          query: vi.fn().mockResolvedValue([])
        };
        const service = new EmployerPingService({ store: mockStore, sendMessage: vi.fn() });
        const result = await service.checkRateLimit('employer-1', 'learner-1');
        return result.allowed === true;
      }),
      { numRuns: 100 }
    );
  });

  it('rejects pings when count is 10 or more', () => {
    fc.assert(
      fc.asyncProperty(fc.integer({ min: 10, max: 100 }), async (currentCount) => {
        const mockStore = {
          queryOne: vi.fn().mockResolvedValue({ count: String(currentCount) }),
          query: vi.fn().mockResolvedValue([])
        };
        const service = new EmployerPingService({ store: mockStore, sendMessage: vi.fn() });
        const result = await service.checkRateLimit('employer-1', 'learner-1');
        return result.allowed === false;
      }),
      { numRuns: 100 }
    );
  });

  it('the 10th ping is accepted but 11th is rejected', async () => {
    // The 10th message means count-before-this = 9
    const mockStore9 = { queryOne: vi.fn().mockResolvedValue({ count: '9' }), query: vi.fn() };
    const service9 = new EmployerPingService({ store: mockStore9, sendMessage: vi.fn() });
    const result9 = await service9.checkRateLimit('e1', 'l1');
    expect(result9.allowed).toBe(true);

    // The 11th message means count-before-this = 10
    const mockStore10 = { queryOne: vi.fn().mockResolvedValue({ count: '10' }), query: vi.fn() };
    const service10 = new EmployerPingService({ store: mockStore10, sendMessage: vi.fn() });
    const result10 = await service10.checkRateLimit('e1', 'l1');
    expect(result10.allowed).toBe(false);
  });
});
