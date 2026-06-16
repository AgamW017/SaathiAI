import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlacementTrackerService } from '../../src/services/placementTrackerService.js';
import { Steps } from '../../src/constants/steps.js';

/**
 * Unit tests for salary extraction and validation logic.
 * Validates: Requirements 1.3, 1.7, 1.8
 */

describe('PlacementTrackerService — Salary Extraction & Validation', () => {
  let service;
  let mockStore;
  let mockGemini;
  let mockSendMessage;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn().mockResolvedValue({ id: 'placement-id-123' })
    };
    mockGemini = {
      generateJson: vi.fn()
    };
    mockSendMessage = vi.fn().mockResolvedValue(undefined);

    service = new PlacementTrackerService({
      store: mockStore,
      gemini: mockGemini,
      sendMessage: mockSendMessage
    });
  });

  // ─── Salary Extraction from Various Response Formats ──────────────────────

  describe('extraction from various response formats', () => {
    function makeSession(step = Steps.SALARY_CAPTURE) {
      return { learnerId: 'learner-1', step, context: {} };
    }

    it('should extract salary from plain numeric response "15000"', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 15000, confidence: 0.95 });

      const session = makeSession();
      const result = await service.handleSalaryResponse(session, '15000');

      expect(result[0].text).toContain('salary record ho gayi');
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE placements'),
        [15000, 'placement-id-123']
      );
    });

    it('should extract salary from Hinglish "15 hazar"', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 15000, confidence: 0.85 });

      const session = makeSession();
      const result = await service.handleSalaryResponse(session, '15 hazar');

      expect(result[0].text).toContain('salary record ho gayi');
    });

    it('should extract salary from formatted "₹15,000/month"', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 15000, confidence: 0.9 });

      const session = makeSession();
      const result = await service.handleSalaryResponse(session, '₹15,000/month');

      expect(result[0].text).toContain('salary record ho gayi');
    });

    it('should extract salary from Hindi "pandraa hazaar"', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 15000, confidence: 0.8 });

      const session = makeSession();
      const result = await service.handleSalaryResponse(session, 'pandraa hazaar');

      expect(result[0].text).toContain('salary record ho gayi');
    });

    it('should return null extraction when LLM returns salary=0 (unextractable)', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 0, confidence: 0.1 });

      const session = makeSession();
      const result = await service.handleSalaryResponse(session, 'kuch nahi pata');

      // Should ask for clarification (first attempt)
      expect(result[0].text).toContain('Exact monthly salary bata dijiye');
      expect(session.step).toBe(Steps.SALARY_RETRY);
    });

    it('should return null extraction when LLM confidence is below 0.3', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 12000, confidence: 0.2 });

      const session = makeSession();
      const result = await service.handleSalaryResponse(session, 'thoda milta hai');

      // Low confidence → treated as null → clarification
      expect(result[0].text).toContain('Exact monthly salary bata dijiye');
      expect(session.step).toBe(Steps.SALARY_RETRY);
    });
  });

  // ─── Salary Validation Boundary Conditions ────────────────────────────────

  describe('validation boundary conditions', () => {
    function makeSession(step = Steps.SALARY_CAPTURE) {
      return { learnerId: 'learner-1', step, context: {} };
    }

    it('should reject salary of 999 (below minimum 1000)', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 999, confidence: 0.9 });

      const session = makeSession();
      const result = await service.handleSalaryResponse(session, '999');

      expect(result[0].text).toContain('1000 se 100000 ke beech');
      expect(session.step).toBe(Steps.SALARY_RETRY);
    });

    it('should accept salary of 1000 (exactly at minimum boundary)', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 1000, confidence: 0.9 });

      const session = makeSession();
      const result = await service.handleSalaryResponse(session, '1000');

      expect(result[0].text).toContain('salary record ho gayi');
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE placements'),
        [1000, 'placement-id-123']
      );
    });

    it('should accept salary of 100000 (exactly at maximum boundary)', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 100000, confidence: 0.9 });

      const session = makeSession();
      const result = await service.handleSalaryResponse(session, '100000');

      expect(result[0].text).toContain('salary record ho gayi');
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE placements'),
        [100000, 'placement-id-123']
      );
    });

    it('should reject salary of 100001 (above maximum 100000)', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 100001, confidence: 0.9 });

      const session = makeSession();
      const result = await service.handleSalaryResponse(session, '100001');

      expect(result[0].text).toContain('1000 se 100000 ke beech');
      expect(session.step).toBe(Steps.SALARY_RETRY);
    });
  });

  // ─── Retry Logic and Flow Handling ─────────────────────────────────────────

  describe('retry logic and flow handling', () => {
    function makeSession(step = Steps.SALARY_CAPTURE) {
      return { learnerId: 'learner-1', step, context: {} };
    }

    it('should send clarification on first extraction failure (SALARY_CAPTURE step)', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 0, confidence: 0.1 });

      const session = makeSession(Steps.SALARY_CAPTURE);
      const result = await service.handleSalaryResponse(session, 'random text');

      expect(result[0].text).toContain('Exact monthly salary bata dijiye');
      expect(session.step).toBe(Steps.SALARY_RETRY);
    });

    it('should mark for review on second extraction failure (SALARY_RETRY step)', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 0, confidence: 0.1 });

      const session = makeSession(Steps.SALARY_RETRY);
      const result = await service.handleSalaryResponse(session, 'still unclear');

      // Marked for review
      expect(result[0].text).toContain('officer aapse jaldi contact karenge');
      expect(session.step).toBe(Steps.PLACED);
      // Should store raw text in retention_checks notes
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE retention_checks'),
        expect.arrayContaining(['still unclear'])
      );
    });

    it('should ask for re-entry on first out-of-range salary (SALARY_CAPTURE → SALARY_RETRY)', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 500, confidence: 0.9 });

      const session = makeSession(Steps.SALARY_CAPTURE);
      const result = await service.handleSalaryResponse(session, '500');

      expect(result[0].text).toContain('1000 se 100000 ke beech');
      expect(session.step).toBe(Steps.SALARY_RETRY);
    });

    it('should mark for review on second out-of-range salary (SALARY_RETRY step)', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 500, confidence: 0.9 });

      const session = makeSession(Steps.SALARY_RETRY);
      const result = await service.handleSalaryResponse(session, '500');

      // On retry step with out-of-range → mark for review
      expect(result[0].text).toContain('officer aapse jaldi contact karenge');
      expect(session.step).toBe(Steps.PLACED);
    });

    it('should store salary and advance to PLACED on valid extraction', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 20000, confidence: 0.95 });

      const session = makeSession(Steps.SALARY_CAPTURE);
      const result = await service.handleSalaryResponse(session, '20000');

      expect(result[0].text).toContain('salary record ho gayi');
      expect(session.step).toBe(Steps.PLACED);
    });

    it('should store salary on SALARY_RETRY step if valid', async () => {
      mockGemini.generateJson.mockResolvedValue({ salary: 18000, confidence: 0.9 });

      const session = makeSession(Steps.SALARY_RETRY);
      const result = await service.handleSalaryResponse(session, '18000');

      expect(result[0].text).toContain('salary record ho gayi');
      expect(session.step).toBe(Steps.PLACED);
    });
  });

  // ─── Timeout Handling ──────────────────────────────────────────────────────

  describe('timeout handling', () => {
    it('should process timed-out salary captures (48h no response)', async () => {
      // Mock: two records timed out
      mockStore.query
        .mockResolvedValueOnce([
          { id: 'check-1', learner_id: 'learner-1', placement_id: 'placement-1' },
          { id: 'check-2', learner_id: 'learner-2', placement_id: 'placement-2' }
        ])
        .mockResolvedValue([]); // subsequent queries return empty

      await service.checkSalaryTimeouts();

      // First call is the UPDATE retention_checks ... RETURNING
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE retention_checks'),
        [7]
      );
      // Should update placements for each timed-out record
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE placements'),
        ['placement-1']
      );
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE placements'),
        ['placement-2']
      );
    });

    it('should log events for timed-out salary captures', async () => {
      mockStore.query
        .mockResolvedValueOnce([
          { id: 'check-1', learner_id: 'learner-1', placement_id: 'placement-1' }
        ])
        .mockResolvedValue([]);

      await service.checkSalaryTimeouts();

      // Should insert an event for each timed-out record
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        expect.arrayContaining(['learner-1'])
      );
    });

    it('should reset session step from SALARY_CAPTURE back to PLACED on timeout', async () => {
      mockStore.query
        .mockResolvedValueOnce([
          { id: 'check-1', learner_id: 'learner-1', placement_id: 'placement-1' }
        ])
        .mockResolvedValue([]);

      await service.checkSalaryTimeouts();

      // Should update session step
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions'),
        ['learner-1']
      );
    });

    it('should handle empty timed-out results gracefully', async () => {
      mockStore.query.mockResolvedValue([]);

      await service.checkSalaryTimeouts();

      // Only one query executed (the initial check)
      expect(mockStore.query).toHaveBeenCalledTimes(1);
    });
  });

  // ─── LLM Error Handling ────────────────────────────────────────────────────

  describe('LLM error handling', () => {
    function makeSession(step = Steps.SALARY_CAPTURE) {
      return { learnerId: 'learner-1', step, context: {} };
    }

    it('should handle LLM throwing an error gracefully (first attempt → clarification)', async () => {
      mockGemini.generateJson.mockRejectedValue(new Error('LLM API timeout'));

      const session = makeSession(Steps.SALARY_CAPTURE);
      const result = await service.handleSalaryResponse(session, '15000');

      // LLM error → treated as null → send clarification
      expect(result[0].text).toContain('Exact monthly salary bata dijiye');
      expect(session.step).toBe(Steps.SALARY_RETRY);
    });

    it('should handle LLM throwing on retry step → mark for review', async () => {
      mockGemini.generateJson.mockRejectedValue(new Error('LLM rate limited'));

      const session = makeSession(Steps.SALARY_RETRY);
      const result = await service.handleSalaryResponse(session, '15000');

      expect(result[0].text).toContain('officer aapse jaldi contact karenge');
      expect(session.step).toBe(Steps.PLACED);
    });

    it('should handle null gemini client gracefully', async () => {
      const serviceNoGemini = new PlacementTrackerService({
        store: mockStore,
        gemini: null,
        sendMessage: mockSendMessage
      });

      const session = makeSession(Steps.SALARY_CAPTURE);
      const result = await serviceNoGemini.handleSalaryResponse(session, '15000');

      // No gemini → extraction returns null → clarification
      expect(result[0].text).toContain('Exact monthly salary bata dijiye');
      expect(session.step).toBe(Steps.SALARY_RETRY);
    });
  });
});
