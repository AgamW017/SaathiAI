import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmployerPingService } from '../../src/services/employerPingService.js';
import { checkMessage } from '../../src/services/contentSafetyService.js';

/**
 * Unit tests for employer ping flow.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.9
 */

describe('EmployerPingService — Command Parsing', () => {
  let service;
  let mockStore;
  let mockSendMessage;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn()
    };
    mockSendMessage = vi.fn().mockResolvedValue(undefined);

    service = new EmployerPingService({
      store: mockStore,
      sendMessage: mockSendMessage
    });
  });

  // ─── Valid Command Parsing ──────────────────────────────────────────────────

  describe('valid command parsing', () => {
    it('should parse "msg learner:9876543210: interview Tuesday 10am" correctly', () => {
      const result = service.parseEmployerCommand('msg learner:9876543210: interview Tuesday 10am');

      expect(result).toEqual({
        phone: '9876543210',
        message: 'interview Tuesday 10am'
      });
    });

    it('should parse command with extra whitespace around colons', () => {
      const result = service.parseEmployerCommand('msg learner: 9876543210 : hello there');

      expect(result).toEqual({
        phone: '9876543210',
        message: 'hello there'
      });
    });

    it('should parse command case-insensitively (MSG, Msg)', () => {
      const result = service.parseEmployerCommand('MSG learner:9876543210: test message');

      expect(result).toEqual({
        phone: '9876543210',
        message: 'test message'
      });
    });

    it('should handle multiline message body', () => {
      const result = service.parseEmployerCommand('msg learner:9876543210: line1\nline2');

      expect(result).not.toBeNull();
      expect(result.message).toContain('line1');
    });
  });

  // ─── Invalid Command Formats ───────────────────────────────────────────────

  describe('invalid command formats', () => {
    it('should return null for missing "msg" prefix', () => {
      const result = service.parseEmployerCommand('send learner:9876543210: hello');

      expect(result).toBeNull();
    });

    it('should return null for missing colon separator after phone', () => {
      const result = service.parseEmployerCommand('msg learner:9876543210 hello');

      expect(result).toBeNull();
    });

    it('should return null for empty message body', () => {
      const result = service.parseEmployerCommand('msg learner:9876543210:   ');

      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      const result = service.parseEmployerCommand(null);

      expect(result).toBeNull();
    });

    it('should return null for non-string input', () => {
      const result = service.parseEmployerCommand(123);

      expect(result).toBeNull();
    });

    it('should return null for phone that is not exactly 10 digits', () => {
      const result = service.parseEmployerCommand('msg learner:12345: hello');

      expect(result).toBeNull();
    });
  });

  // ─── Invalid Phone Format ──────────────────────────────────────────────────

  describe('invalid phone format rejection (handleEmployerPing)', () => {
    it('should reject a 5-digit phone number with error message', async () => {
      // parseEmployerCommand won't match a 5-digit number, so handleEmployerPing returns format error
      const result = await service.handleEmployerPing('msg learner:12345: hello', '9999999999');

      expect(result).toContain('Invalid command format');
    });

    it('should reject phone starting with 0', async () => {
      // 10 digits starting with 0 → parses but fails Indian mobile validation
      const result = await service.handleEmployerPing('msg learner:0987654321: hello', '9999999999');

      expect(result).toContain('Invalid phone number');
    });

    it('should reject phone starting with 5', async () => {
      const result = await service.handleEmployerPing('msg learner:5876543210: hello', '9999999999');

      expect(result).toContain('Invalid phone number');
    });

    it('should reject phone starting with 1', async () => {
      const result = await service.handleEmployerPing('msg learner:1234567890: hello', '9999999999');

      expect(result).toContain('Invalid phone number');
    });
  });

  // ─── Non-Employer Sender Rejection ─────────────────────────────────────────

  describe('non-employer sender rejection', () => {
    it('should return null (ignore) when sender has role "trainee"', async () => {
      mockStore.queryOne.mockResolvedValueOnce({ id: 'user-1', role: 'trainee', full_name: 'Test' });

      const result = await service.handleEmployerPing('msg learner:9876543210: hello', '9999999999');

      expect(result).toBeNull();
    });

    it('should return null (ignore) when sender has role "officer"', async () => {
      mockStore.queryOne.mockResolvedValueOnce({ id: 'user-2', role: 'officer', full_name: 'Officer' });

      const result = await service.handleEmployerPing('msg learner:9876543210: hello', '9999999999');

      expect(result).toBeNull();
    });

    it('should return null (ignore) when sender is not found in database', async () => {
      mockStore.queryOne.mockResolvedValueOnce(null);

      const result = await service.handleEmployerPing('msg learner:9876543210: hello', '9999999999');

      expect(result).toBeNull();
    });
  });

  // ─── Employer Sender Processes Successfully ────────────────────────────────

  describe('employer sender processes successfully', () => {
    it('should process and relay when sender has role "employer"', async () => {
      // First queryOne: sender lookup → employer
      mockStore.queryOne
        .mockResolvedValueOnce({ id: 'emp-1', role: 'employer', full_name: 'Raj Kumar' })
        // Second queryOne: learner lookup
        .mockResolvedValueOnce({ id: 'learner-1', full_name: 'Amit', phone: '9876543210' })
        // Third queryOne: job lookup for company name
        .mockResolvedValueOnce({ company: 'TechCorp' });

      // Rate limit check passes, subsequent inserts
      mockStore.query
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValue([]);

      const result = await service.handleEmployerPing('msg learner:9876543210: interview Tuesday', '8888888888');

      expect(result).toContain('Message delivered');
      expect(result).toContain('Amit');
      expect(mockSendMessage).toHaveBeenCalledWith('9876543210', '[TechCorp] says: interview Tuesday');
    });
  });

  // ─── Learner Not Found ─────────────────────────────────────────────────────

  describe('learner not found', () => {
    it('should return error message when learner phone is not in learners table', async () => {
      // Sender is employer
      mockStore.queryOne
        .mockResolvedValueOnce({ id: 'emp-1', role: 'employer', full_name: 'Boss' })
        // Learner lookup returns null
        .mockResolvedValueOnce(null);

      const result = await service.handleEmployerPing('msg learner:9876543210: hello', '8888888888');

      expect(result).toContain('Learner not found');
    });
  });
});

// ─── Content Safety Filter ─────────────────────────────────────────────────

describe('ContentSafetyService — Sensitive Content Detection', () => {
  describe('Aadhaar number detection', () => {
    it('should reject message containing 12-digit Aadhaar pattern', () => {
      const result = checkMessage('My aadhaar is 123456789012 please save it');

      expect(result.safe).toBe(false);
      expect(result.reasons.some(r => r.toLowerCase().includes('aadhaar'))).toBe(true);
    });

    it('should reject Aadhaar with spaces (1234 5678 9012)', () => {
      const result = checkMessage('Number is 1234 5678 9012');

      expect(result.safe).toBe(false);
      expect(result.reasons.some(r => r.toLowerCase().includes('aadhaar'))).toBe(true);
    });

    it('should reject Aadhaar with dashes (1234-5678-9012)', () => {
      const result = checkMessage('Aadhaar: 1234-5678-9012');

      expect(result.safe).toBe(false);
      expect(result.reasons.some(r => r.toLowerCase().includes('aadhaar'))).toBe(true);
    });
  });

  describe('bank account number detection', () => {
    it('should reject message containing 9-18 consecutive digits (bank account)', () => {
      const result = checkMessage('My bank account: 123456789');

      expect(result.safe).toBe(false);
      expect(result.reasons.some(r => r.toLowerCase().includes('bank'))).toBe(true);
    });

    it('should reject message with 18-digit bank account number', () => {
      const result = checkMessage('Account: 123456789012345678');

      expect(result.safe).toBe(false);
      expect(result.reasons.some(r => r.toLowerCase().includes('bank'))).toBe(true);
    });
  });

  describe('OTP keyword detection', () => {
    it('should reject message containing "OTP"', () => {
      const result = checkMessage('Please share your OTP with me');

      expect(result.safe).toBe(false);
      expect(result.reasons.some(r => r.toLowerCase().includes('otp'))).toBe(true);
    });

    it('should reject message containing "one-time password" (case-insensitive)', () => {
      const result = checkMessage('Send me your One-Time Password');

      expect(result.safe).toBe(false);
      expect(result.reasons.some(r => r.toLowerCase().includes('otp') || r.toLowerCase().includes('verification'))).toBe(true);
    });

    it('should reject message containing "verification code"', () => {
      const result = checkMessage('What is your verification code?');

      expect(result.safe).toBe(false);
      expect(result.reasons.some(r => r.toLowerCase().includes('verification'))).toBe(true);
    });
  });

  describe('safe messages pass through', () => {
    it('should allow normal interview message', () => {
      const result = checkMessage('Interview at 10am on Tuesday. Please come to office.');

      expect(result.safe).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should allow message with short digit sequences (less than 9)', () => {
      const result = checkMessage('Come to room 105 at 3pm');

      expect(result.safe).toBe(true);
    });
  });

  describe('message length validation', () => {
    it('should reject message exceeding 1000 characters', () => {
      const longMessage = 'a'.repeat(1001);
      const result = checkMessage(longMessage);

      expect(result.safe).toBe(false);
      expect(result.reasons.some(r => r.toLowerCase().includes('length'))).toBe(true);
    });

    it('should allow message at exactly 1000 characters', () => {
      const exactMessage = 'a'.repeat(1000);
      const result = checkMessage(exactMessage);

      expect(result.safe).toBe(true);
    });
  });
});

// ─── Content Safety Integration with Employer Ping ──────────────────────────

describe('EmployerPingService — Content Safety Integration', () => {
  let service;
  let mockStore;
  let mockSendMessage;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn()
    };
    mockSendMessage = vi.fn().mockResolvedValue(undefined);

    service = new EmployerPingService({
      store: mockStore,
      sendMessage: mockSendMessage
    });
  });

  it('should reject ping containing Aadhaar pattern', async () => {
    mockStore.queryOne
      .mockResolvedValueOnce({ id: 'emp-1', role: 'employer', full_name: 'Boss' })
      .mockResolvedValueOnce({ id: 'learner-1', full_name: 'Amit', phone: '9876543210' });

    // Rate limit check passes
    mockStore.query.mockResolvedValueOnce([{ count: '0' }]);

    const result = await service.handleEmployerPing(
      'msg learner:9876543210: send me your aadhaar 1234 5678 9012',
      '8888888888'
    );

    expect(result).toContain('cannot be delivered');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should reject ping containing OTP keyword', async () => {
    mockStore.queryOne
      .mockResolvedValueOnce({ id: 'emp-1', role: 'employer', full_name: 'Boss' })
      .mockResolvedValueOnce({ id: 'learner-1', full_name: 'Amit', phone: '9876543210' });

    // Rate limit check passes
    mockStore.query.mockResolvedValueOnce([{ count: '0' }]);

    const result = await service.handleEmployerPing(
      'msg learner:9876543210: please share your OTP',
      '8888888888'
    );

    expect(result).toContain('cannot be delivered');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});

// ─── Rate Limit Enforcement ──────────────────────────────────────────────────

describe('EmployerPingService — Rate Limiting', () => {
  let service;
  let mockStore;
  let mockSendMessage;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn()
    };
    mockSendMessage = vi.fn().mockResolvedValue(undefined);

    service = new EmployerPingService({
      store: mockStore,
      sendMessage: mockSendMessage
    });
  });

  /**
   * Rate limiting test: 10 pings per employer per learner per calendar day.
   * The service should check the message count and reject the 11th ping.
   * Validates: Requirements 3.9, 3.10
   */

  it('should allow the 10th ping (count=9 existing, boundary)', async () => {
    // Sender is employer
    mockStore.queryOne
      .mockResolvedValueOnce({ id: 'emp-1', role: 'employer', full_name: 'Boss' })
      // Learner exists
      .mockResolvedValueOnce({ id: 'learner-1', full_name: 'Amit', phone: '9876543210' })
      // Job company lookup
      .mockResolvedValueOnce({ company: 'TechCorp' });

    // Rate limit check returns count of 9 (under limit), then subsequent inserts return empty
    mockStore.query
      .mockResolvedValueOnce([{ count: '9' }])
      .mockResolvedValue([]);

    const result = await service.handleEmployerPing('msg learner:9876543210: hello 10th', '8888888888');

    // Should proceed with delivery (allowed at boundary)
    expect(result).toContain('Message delivered');
    expect(mockSendMessage).toHaveBeenCalled();
  });

  it('should reject the 11th ping (count=10 existing, over limit)', async () => {
    // Sender is employer
    mockStore.queryOne
      .mockResolvedValueOnce({ id: 'emp-1', role: 'employer', full_name: 'Boss' })
      // Learner exists
      .mockResolvedValueOnce({ id: 'learner-1', full_name: 'Amit', phone: '9876543210' })
      // Job company lookup (should not be reached)
      .mockResolvedValueOnce({ company: 'TechCorp' });

    // Rate limit check returns count of 10 (at limit → reject)
    mockStore.query.mockResolvedValueOnce([{ count: '10' }]);

    const result = await service.handleEmployerPing('msg learner:9876543210: hello 11th', '8888888888');

    // Should reject — daily limit reached
    expect(result).toContain('limit');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});

// ─── Learner Reply Forwarding ──────────────────────────────────────────────────

describe('EmployerPingService — Learner Reply Forwarding', () => {
  let service;
  let mockStore;
  let mockSendMessage;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn()
    };
    mockSendMessage = vi.fn().mockResolvedValue(undefined);

    service = new EmployerPingService({
      store: mockStore,
      sendMessage: mockSendMessage
    });
  });

  /**
   * Learner reply forwarding tests.
   * Validates: Requirements 3.6, 3.7
   */

  it('should forward learner reply to employer when a recent ping exists (within 24h)', async () => {
    const session = {
      learnerId: 'learner-1',
      phone: '9876543210',
      collected: { name: 'Amit' }
    };

    // Recent ping found
    mockStore.queryOne.mockResolvedValueOnce({
      id: 'msg-123',
      sender_id: 'emp-1',
      employer_phone: '8888888888',
      employer_name: 'Raj Kumar'
    });

    const result = await service.handleLearnerReply(session, 'Yes I will come');

    // Should forward to employer
    expect(mockSendMessage).toHaveBeenCalledWith(
      '8888888888',
      '[Amit] replies: Yes I will come'
    );

    // Should store reply in messages table with reply_to_id
    expect(mockStore.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      expect.arrayContaining(['emp-1', 'learner-1', 'Yes I will come', 'msg-123'])
    );

    // Should log PING_RELAYED event
    expect(mockStore.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO events'),
      expect.arrayContaining(['learner-1', 'PING_RELAYED'])
    );

    // Return null — no reply back to learner
    expect(result).toBeNull();
  });

  it('should return undefined when no recent ping exists (no ping within 24h)', async () => {
    const session = {
      learnerId: 'learner-2',
      phone: '7654321098',
      collected: { name: 'Priya' }
    };

    // No recent ping found
    mockStore.queryOne.mockResolvedValueOnce(null);

    const result = await service.handleLearnerReply(session, 'Hello');

    // Should return undefined (caller handles normally)
    expect(result).toBeUndefined();

    // Should NOT forward anything
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should use "Learner" as default name when session has no collected name', async () => {
    const session = {
      learnerId: 'learner-3',
      phone: '6543210987',
      collected: {}
    };

    mockStore.queryOne.mockResolvedValueOnce({
      id: 'msg-456',
      sender_id: 'emp-2',
      employer_phone: '7777777777',
      employer_name: 'Suresh'
    });

    await service.handleLearnerReply(session, 'OK');

    expect(mockSendMessage).toHaveBeenCalledWith(
      '7777777777',
      '[Learner] replies: OK'
    );
  });

  it('should block learner reply containing sensitive content (Aadhaar)', async () => {
    const session = {
      learnerId: 'learner-4',
      phone: '9876543210',
      collected: { name: 'Ravi' }
    };

    mockStore.queryOne.mockResolvedValueOnce({
      id: 'msg-789',
      sender_id: 'emp-3',
      employer_phone: '6666666666',
      employer_name: 'Boss'
    });

    const result = await service.handleLearnerReply(session, 'My aadhaar is 1234 5678 9012');

    // Should NOT forward unsafe content
    expect(mockSendMessage).not.toHaveBeenCalled();

    // Should NOT store the message
    expect(mockStore.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      expect.anything()
    );

    // Return null (silently dropped)
    expect(result).toBeNull();
  });

  it('should return null for null session', async () => {
    const result = await service.handleLearnerReply(null, 'hello');

    expect(result).toBeNull();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should return null for missing learnerId in session', async () => {
    const result = await service.handleLearnerReply({ phone: '9876543210' }, 'hello');

    expect(result).toBeNull();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should return null for empty text', async () => {
    const session = { learnerId: 'learner-5', phone: '9876543210', collected: { name: 'Test' } };
    const result = await service.handleLearnerReply(session, '');

    expect(result).toBeNull();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});

// ─── Successful Relay End-to-End ─────────────────────────────────────────────

describe('EmployerPingService — Successful Relay', () => {
  let service;
  let mockStore;
  let mockSendMessage;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn()
    };
    mockSendMessage = vi.fn().mockResolvedValue(undefined);

    service = new EmployerPingService({
      store: mockStore,
      sendMessage: mockSendMessage
    });
  });

  it('should store message in DB, forward to learner, log event, and return confirmation', async () => {
    mockStore.queryOne
      .mockResolvedValueOnce({ id: 'emp-1', role: 'employer', full_name: 'Raj' })
      .mockResolvedValueOnce({ id: 'learner-1', full_name: 'Amit', phone: '9876543210' })
      .mockResolvedValueOnce({ company: 'BuildCo' });

    // Rate limit check passes, subsequent queries for inserts
    mockStore.query
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValue([]);

    const result = await service.handleEmployerPing('msg learner:9876543210: please come for interview', '8888888888');

    // 1. Message forwarded to learner
    expect(mockSendMessage).toHaveBeenCalledWith(
      '9876543210',
      '[BuildCo] says: please come for interview'
    );

    // 2. Message stored in DB (INSERT INTO messages)
    expect(mockStore.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      expect.arrayContaining(['emp-1', 'learner-1', 'please come for interview'])
    );

    // 3. Event logged (INSERT INTO events)
    expect(mockStore.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO events'),
      expect.arrayContaining(['learner-1'])
    );

    // 4. Confirmation returned to employer
    expect(result).toContain('Message delivered');
    expect(result).toContain('Amit');
  });

  it('should use employer full_name when no company found in jobs', async () => {
    mockStore.queryOne
      .mockResolvedValueOnce({ id: 'emp-2', role: 'employer', full_name: 'Suresh' })
      .mockResolvedValueOnce({ id: 'learner-2', full_name: 'Priya', phone: '7654321098' })
      // No job found → null
      .mockResolvedValueOnce(null);

    // Rate limit check passes
    mockStore.query
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValue([]);

    const result = await service.handleEmployerPing('msg learner:7654321098: schedule update', '7777777777');

    expect(mockSendMessage).toHaveBeenCalledWith(
      '7654321098',
      '[Suresh] says: schedule update'
    );
    expect(result).toContain('Message delivered');
  });
});
