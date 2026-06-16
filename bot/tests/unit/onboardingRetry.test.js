import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OnboardingRetryService } from '../../src/services/onboardingRetryService.js';

/**
 * Unit tests for onboarding retry logic.
 * Validates: Requirements 9.2, 9.3, 9.4
 */

describe('OnboardingRetryService — recordFailure', () => {
  let service;
  let mockStore;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn().mockResolvedValue(null)
    };

    service = new OnboardingRetryService({ store: mockStore });
  });

  it('should set onboardingStatus to "failed" on first failure', async () => {
    // No existing session
    mockStore.queryOne.mockResolvedValueOnce(null);

    const result = await service.recordFailure('learner-1', '9876543210', 'connection timeout');

    expect(result.onboardingStatus).toBe('failed');
    expect(result.onboardingAttempts).toBe(1);
    expect(result.failureReason).toBe('connection timeout');
    expect(result.lastAttemptAt).toBeDefined();
  });

  it('should increment attempts counter on subsequent failures', async () => {
    // Existing session with 1 previous attempt
    mockStore.queryOne.mockResolvedValueOnce({
      id: 'session-1',
      data: {
        onboardingStatus: 'failed',
        onboardingAttempts: 1,
        lastAttemptAt: '2025-01-01T00:00:00.000Z',
        failureReason: 'previous error'
      }
    });

    const result = await service.recordFailure('learner-1', '9876543210', 'delivery failed');

    expect(result.onboardingAttempts).toBe(2);
    expect(result.onboardingStatus).toBe('failed');
    expect(result.failureReason).toBe('delivery failed');
  });

  it('should mark as "unreachable" after 3 failed attempts', async () => {
    // Existing session with 2 previous attempts
    mockStore.queryOne.mockResolvedValueOnce({
      id: 'session-1',
      data: {
        onboardingStatus: 'failed',
        onboardingAttempts: 2,
        lastAttemptAt: '2025-01-01T00:00:00.000Z',
        failureReason: 'timeout'
      }
    });

    const result = await service.recordFailure('learner-1', '9876543210', 'third failure');

    expect(result.onboardingAttempts).toBe(3);
    expect(result.onboardingStatus).toBe('unreachable');
    expect(result.failureReason).toBe('third failure');
  });

  it('should log failure with phone, timestamp, and error reason', async () => {
    const mockLogger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
    service = new OnboardingRetryService({ store: mockStore, logger: mockLogger });

    mockStore.queryOne.mockResolvedValueOnce(null);

    await service.recordFailure('learner-1', '9876543210', 'network error');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        learnerId: 'learner-1',
        phone: '9876543210',
        reason: 'network error',
        attempt: 1
      }),
      expect.stringContaining('Onboarding message delivery failed')
    );
  });

  it('should create a new session record when none exists', async () => {
    mockStore.queryOne.mockResolvedValueOnce(null);

    await service.recordFailure('learner-1', '9876543210', 'error');

    // Should call INSERT INTO sessions
    expect(mockStore.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sessions'),
      expect.arrayContaining(['learner-1'])
    );
  });

  it('should update existing session data when session exists', async () => {
    mockStore.queryOne.mockResolvedValueOnce({
      id: 'session-42',
      data: { phone: '9876543210', step: 0 }
    });

    await service.recordFailure('learner-1', '9876543210', 'error');

    // Should call UPDATE sessions
    expect(mockStore.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sessions'),
      expect.arrayContaining(['session-42'])
    );
  });

  it('should log an ONBOARDING_FAILED event', async () => {
    mockStore.queryOne.mockResolvedValueOnce(null);

    await service.recordFailure('learner-1', '9876543210', 'timeout');

    // Should insert event — the second call should be the events insert
    const eventCall = mockStore.query.mock.calls.find(
      (call) => call[0].includes('INSERT INTO events')
    );
    expect(eventCall).toBeDefined();
    expect(eventCall[0]).toContain('ONBOARDING_FAILED');
    expect(eventCall[1][0]).toBe('learner-1');
  });
});

describe('OnboardingRetryService — getDueRetries', () => {
  let service;
  let mockStore;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn().mockResolvedValue(null)
    };

    service = new OnboardingRetryService({ store: mockStore });
  });

  it('should query for failed onboarding learners with attempts < 3 and lastAttemptAt + 4h <= now', async () => {
    mockStore.query.mockResolvedValueOnce([
      {
        session_id: 's-1',
        learner_id: 'learner-1',
        phone: '9876543210',
        data: { onboardingAttempts: 1 }
      },
      {
        session_id: 's-2',
        learner_id: 'learner-2',
        phone: '8765432109',
        data: { onboardingAttempts: 2 }
      }
    ]);

    const result = await service.getDueRetries();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      learnerId: 'learner-1',
      phone: '9876543210',
      attempts: 1,
      sessionId: 's-1'
    });
    expect(result[1]).toEqual({
      learnerId: 'learner-2',
      phone: '8765432109',
      attempts: 2,
      sessionId: 's-2'
    });

    // Verify the SQL query checks for correct conditions
    const sqlCall = mockStore.query.mock.calls[0][0];
    expect(sqlCall).toContain("onboardingStatus");
    expect(sqlCall).toContain("failed");
    expect(sqlCall).toContain("onboardingAttempts");
  });

  it('should return empty array when no retries are due', async () => {
    mockStore.query.mockResolvedValueOnce([]);

    const result = await service.getDueRetries();

    expect(result).toEqual([]);
  });
});

describe('OnboardingRetryService — processRetries', () => {
  let service;
  let mockStore;
  let mockSendMessage;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn().mockResolvedValue(null)
    };
    mockSendMessage = vi.fn().mockResolvedValue(undefined);

    service = new OnboardingRetryService({ store: mockStore });
    service.setSendMessage(mockSendMessage);
  });

  it('should send welcome message to each due retry learner', async () => {
    // getDueRetries returns one learner
    mockStore.query
      .mockResolvedValueOnce([
        {
          session_id: 's-1',
          learner_id: 'learner-1',
          phone: '9876543210',
          data: { onboardingAttempts: 1 }
        }
      ])
      // _markSuccess queries
      .mockResolvedValue([]);

    mockStore.queryOne.mockResolvedValueOnce({ data: { onboardingAttempts: 1, onboardingStatus: 'failed' } });

    const result = await service.processRetries();

    expect(mockSendMessage).toHaveBeenCalledWith(
      '9876543210',
      expect.stringContaining('Namaste!')
    );
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('should set onboardingStatus to "success" when retry succeeds', async () => {
    // getDueRetries
    mockStore.query
      .mockResolvedValueOnce([
        {
          session_id: 's-1',
          learner_id: 'learner-1',
          phone: '9876543210',
          data: { onboardingAttempts: 1 }
        }
      ])
      .mockResolvedValue([]);

    // _markSuccess: get session data
    mockStore.queryOne.mockResolvedValueOnce({
      data: { onboardingStatus: 'failed', onboardingAttempts: 1 }
    });

    await service.processRetries();

    // Should update session with onboardingStatus: 'success'
    const updateCall = mockStore.query.mock.calls.find(
      (call) => call[0].includes('UPDATE sessions') && call[1]?.[0]?.includes('"onboardingStatus":"success"')
    );
    expect(updateCall).toBeDefined();
  });

  it('should call recordFailure when retry delivery fails', async () => {
    // getDueRetries
    mockStore.query
      .mockResolvedValueOnce([
        {
          session_id: 's-1',
          learner_id: 'learner-1',
          phone: '9876543210',
          data: { onboardingAttempts: 1 }
        }
      ])
      .mockResolvedValue([]);

    // Send message fails
    mockSendMessage.mockRejectedValueOnce(new Error('WhatsApp unreachable'));

    // recordFailure: get existing session
    mockStore.queryOne.mockResolvedValueOnce({
      id: 's-1',
      data: { onboardingStatus: 'failed', onboardingAttempts: 1 }
    });

    const result = await service.processRetries();

    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);
  });

  it('should return zeros when no sendMessage function is available', async () => {
    service = new OnboardingRetryService({ store: mockStore });
    // No setSendMessage called

    const result = await service.processRetries();

    expect(result).toEqual({ retried: 0, succeeded: 0, failed: 0 });
  });

  it('should return zeros when no retries are due', async () => {
    mockStore.query.mockResolvedValueOnce([]);

    const result = await service.processRetries();

    expect(result).toEqual({ retried: 0, succeeded: 0, failed: 0 });
  });
});

describe('OnboardingRetryService — polling lifecycle', () => {
  let service;
  let mockStore;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStore = {
      query: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn().mockResolvedValue(null)
    };

    service = new OnboardingRetryService({ store: mockStore });
    service.setSendMessage(vi.fn().mockResolvedValue(undefined));
  });

  afterEach(() => {
    service.stopPolling();
    vi.useRealTimers();
  });

  it('should start polling and run initial check immediately', () => {
    service.startPolling();

    // Initial getDueRetries query should have been called
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('should not start a second polling loop if already running', () => {
    service.startPolling();
    const callCount = mockStore.query.mock.calls.length;

    service.startPolling(); // second call — should be no-op

    expect(mockStore.query.mock.calls.length).toBe(callCount);
  });

  it('should stop polling when stopPolling is called', () => {
    service.startPolling();
    service.stopPolling();

    // Advance time — no new calls should happen
    const callCount = mockStore.query.mock.calls.length;
    vi.advanceTimersByTime(60 * 60 * 1000); // 1 hour

    expect(mockStore.query.mock.calls.length).toBe(callCount);
  });
});
