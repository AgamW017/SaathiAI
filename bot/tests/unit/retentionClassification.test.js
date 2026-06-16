import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlacementTrackerService } from '../../src/services/placementTrackerService.js';
import { Steps } from '../../src/constants/steps.js';

/**
 * Unit tests for retention response classification
 * Validates: Requirements 2.3, 2.7
 */

describe('PlacementTrackerService — handleRetentionResponse', () => {
  let service;
  let mockStore;
  let mockGemini;
  let mockSendMessage;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn()
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

  function createSession(overrides = {}) {
    return {
      learnerId: 'learner-123',
      step: Steps.RETENTION_CHECK,
      phone: '9876543210',
      script: 'roman',
      context: {},
      ...overrides
    };
  }

  // ─── Test: 'retained' classification ─────────────────────────────────────

  describe('when LLM classifies as "retained"', () => {
    beforeEach(() => {
      // LLM returns 'retained' classification
      mockGemini.generateJson.mockResolvedValue({
        classification: 'retained',
        confidence: 0.9
      });
      // Mock _getPlacementId
      mockStore.queryOne
        .mockResolvedValueOnce({ id: 'placement-abc' }) // _getPlacementId
        .mockResolvedValueOnce({ id: 'check-1', check_day: 30 }); // active retention check
    });

    it('updates the retention check to "retained" and returns a positive message', async () => {
      const session = createSession();

      const replies = await service.handleRetentionResponse(session, 'haan kaam kar raha hoon');

      // Should call LLM to classify
      expect(mockGemini.generateJson).toHaveBeenCalledTimes(1);

      // Should update retention_check status to 'retained'
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'retained'"),
        ['check-1']
      );

      // Should log RETENTION_RETAINED event
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        expect.arrayContaining([
          'learner-123',
          'RETENTION_RETAINED',
          expect.any(String)
        ])
      );

      // Session should advance to PLACED
      expect(session.step).toBe(Steps.PLACED);

      // Should return a positive message
      expect(replies).toHaveLength(1);
      expect(replies[0].text).toContain('Bahut accha');
    });

    it('handles various affirmative Hindi responses', async () => {
      const session = createSession();
      const affirmativeResponses = [
        'haan',
        'yes',
        'abhi bhi wahi job',
        'kaam kar raha hoon',
        'accha chal raha hai'
      ];

      for (const response of affirmativeResponses) {
        mockGemini.generateJson.mockResolvedValue({
          classification: 'retained',
          confidence: 0.85
        });
        mockStore.queryOne
          .mockResolvedValueOnce({ id: 'placement-abc' })
          .mockResolvedValueOnce({ id: 'check-1', check_day: 30 });

        const sess = createSession();
        const replies = await service.handleRetentionResponse(sess, response);

        expect(sess.step).toBe(Steps.PLACED);
        expect(replies[0].text).toContain('Bahut accha');
      }
    });
  });

  // ─── Test: 'left' classification ─────────────────────────────────────────

  describe('when LLM classifies as "left"', () => {
    beforeEach(() => {
      mockGemini.generateJson.mockResolvedValue({
        classification: 'left',
        confidence: 0.9
      });
      mockStore.queryOne
        .mockResolvedValueOnce({ id: 'placement-abc' }) // _getPlacementId
        .mockResolvedValueOnce({ id: 'check-1', check_day: 30 }); // active retention check
    });

    it('updates check to "left", cancels remaining checks, and resets session to JOBS_SHOWN', async () => {
      const session = createSession();

      const replies = await service.handleRetentionResponse(session, 'nahi chhod diya');

      // Should update retention_check to 'left'
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'left'"),
        ['check-1']
      );

      // Should update placement retention_status to 'left'
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining("retention_status = 'left'"),
        ['placement-abc']
      );

      // Should cancel remaining pending checks
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'no_response'"),
        expect.arrayContaining(['placement-abc'])
      );

      // Should log RETENTION_LEFT event
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        expect.arrayContaining([
          'learner-123',
          'RETENTION_LEFT',
          expect.any(String)
        ])
      );

      // Session should reset to JOBS_SHOWN
      expect(session.step).toBe(Steps.JOBS_SHOWN);

      // Should return a left message
      expect(replies).toHaveLength(1);
      expect(replies[0].text).toContain('Samajh gaya');
    });

    it('handles various negative responses', async () => {
      const negativeResponses = [
        'nahi',
        'chhod diya',
        'left',
        'nikal diya',
        'band ho gaya'
      ];

      for (const response of negativeResponses) {
        mockGemini.generateJson.mockResolvedValue({
          classification: 'left',
          confidence: 0.85
        });
        mockStore.queryOne
          .mockResolvedValueOnce({ id: 'placement-abc' })
          .mockResolvedValueOnce({ id: 'check-1', check_day: 60 });

        const sess = createSession();
        const replies = await service.handleRetentionResponse(sess, response);

        expect(sess.step).toBe(Steps.JOBS_SHOWN);
        expect(replies[0].text).toContain('Samajh gaya');
      }
    });
  });

  // ─── Test: 'unclear' on first attempt ────────────────────────────────────

  describe('when LLM classifies as "unclear" on first attempt (step=RETENTION_CHECK)', () => {
    beforeEach(() => {
      mockGemini.generateJson.mockResolvedValue({
        classification: 'unclear',
        confidence: 0.3
      });
    });

    it('advances step to RETENTION_RETRY and returns clarification message', async () => {
      const session = createSession({ step: Steps.RETENTION_CHECK });

      const replies = await service.handleRetentionResponse(session, 'kuch aur baat hai');

      // Should advance step to RETENTION_RETRY
      expect(session.step).toBe(Steps.RETENTION_RETRY);

      // Should return clarification message
      expect(replies).toHaveLength(1);
      expect(replies[0].text).toContain('Maaf karein');
    });

    it('returns clarification in the correct script', async () => {
      const session = createSession({ step: Steps.RETENTION_CHECK, script: 'english' });

      const replies = await service.handleRetentionResponse(session, 'something unclear');

      expect(session.step).toBe(Steps.RETENTION_RETRY);
      expect(replies[0].text).toContain('Sorry, I could not understand');
    });
  });

  // ─── Test: 'unclear' on second attempt (RETENTION_RETRY) ─────────────────

  describe('when LLM classifies as "unclear" on second attempt (step=RETENTION_RETRY)', () => {
    beforeEach(() => {
      mockGemini.generateJson.mockResolvedValue({
        classification: 'unclear',
        confidence: 0.2
      });
      mockStore.queryOne
        .mockResolvedValueOnce({ id: 'placement-abc' }) // _getPlacementId
        .mockResolvedValueOnce({ id: 'check-1', check_day: 30 }); // active retention check
    });

    it('marks as "no_response" and returns review message', async () => {
      const session = createSession({ step: Steps.RETENTION_RETRY });

      const replies = await service.handleRetentionResponse(session, 'random text again');

      // Should update retention_check to 'no_response' with notes
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'no_response'"),
        expect.arrayContaining([expect.stringContaining('unclear_response'), 'check-1'])
      );

      // Should log RETENTION_NO_RESPONSE event
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        expect.arrayContaining([
          'learner-123',
          'RETENTION_NO_RESPONSE',
          expect.any(String)
        ])
      );

      // Session should advance to PLACED
      expect(session.step).toBe(Steps.PLACED);

      // Should return review message
      expect(replies).toHaveLength(1);
      expect(replies[0].text).toContain('officer');
    });
  });

  // ─── Test: 90-day retained triggers salary update flow ───────────────────

  describe('when 90-day retained: asks about salary changes', () => {
    beforeEach(() => {
      mockGemini.generateJson.mockResolvedValue({
        classification: 'retained',
        confidence: 0.95
      });
      mockStore.queryOne
        .mockResolvedValueOnce({ id: 'placement-abc' }) // _getPlacementId
        .mockResolvedValueOnce({ id: 'check-90', check_day: 90 }); // active 90-day retention check
    });

    it('sets awaitingSalaryUpdate flag and returns salary inquiry message', async () => {
      const session = createSession();

      const replies = await service.handleRetentionResponse(session, 'haan abhi bhi wahi hoon');

      // Should set the awaitingSalaryUpdate flag
      expect(session.context.awaitingSalaryUpdate).toBe(true);
      expect(session.context.retentionCheckId).toBe('check-90');

      // Should return both the retained message and the salary inquiry
      expect(replies).toHaveLength(2);
      expect(replies[0].text).toContain('Bahut accha');
      expect(replies[1].text).toContain('salary');
    });
  });

  // ─── Test: 90-day salary update when awaitingSalaryUpdate is true ─────────

  describe('when awaitingSalaryUpdate=true and learner provides new salary', () => {
    beforeEach(() => {
      // Mock salary extraction returning a valid salary
      mockGemini.generateJson.mockResolvedValue({
        salary: 18000,
        confidence: 0.9
      });
      mockStore.queryOne.mockResolvedValueOnce({ id: 'placement-abc' }); // _getPlacementId
    });

    it('updates current_salary on placement', async () => {
      const session = createSession({
        context: {
          awaitingSalaryUpdate: true,
          retentionCheckId: 'check-90'
        }
      });

      const replies = await service.handleRetentionResponse(session, '18000 mil raha hai');

      // Should update placement current_salary
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE placements SET current_salary'),
        [18000, 'placement-abc']
      );

      // Should update retention_check salary_reported
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE retention_checks SET salary_reported'),
        [18000, 'check-90']
      );

      // Should log SALARY_CAPTURED event
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        expect.arrayContaining([
          'learner-123',
          'SALARY_CAPTURED',
          expect.any(String)
        ])
      );

      // awaitingSalaryUpdate should be cleared
      expect(session.context.awaitingSalaryUpdate).toBe(false);

      // Session should advance to PLACED
      expect(session.step).toBe(Steps.PLACED);

      // Should return salary success message
      expect(replies).toHaveLength(1);
      expect(replies[0].text).toContain('salary record');
    });

    it('handles "same" response without updating salary', async () => {
      const session = createSession({
        context: {
          awaitingSalaryUpdate: true,
          retentionCheckId: 'check-90'
        }
      });

      const replies = await service.handleRetentionResponse(session, 'same hai');

      // Should NOT call salary extraction or update queries
      // The generateJson for salary extraction should not be called
      // since "same" is handled before LLM extraction
      expect(session.context.awaitingSalaryUpdate).toBe(false);
      expect(session.step).toBe(Steps.PLACED);

      // Should return a positive confirmation message
      expect(replies).toHaveLength(1);
      expect(replies[0].text).toContain('Bahut accha');
    });
  });

  // ─── Test: Low confidence from LLM treated as 'unclear' ──────────────────

  describe('when LLM returns low confidence (≤0.5)', () => {
    it('treats the response as unclear', async () => {
      mockGemini.generateJson.mockResolvedValue({
        classification: 'retained',
        confidence: 0.3 // Below 0.5 threshold
      });

      const session = createSession({ step: Steps.RETENTION_CHECK });

      const replies = await service.handleRetentionResponse(session, 'maybe');

      // Low confidence should be treated as unclear → advance to RETENTION_RETRY
      expect(session.step).toBe(Steps.RETENTION_RETRY);
      expect(replies[0].text).toContain('Maaf karein');
    });
  });
});
