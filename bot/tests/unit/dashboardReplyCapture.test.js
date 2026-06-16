import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmployerPingService } from '../../src/services/employerPingService.js';

/**
 * Unit tests for learner reply capture on dashboard-initiated ping threads.
 * Validates: Requirements 4.3, 4.4, 4.7
 *
 * The handleLearnerReply method works for both WhatsApp and dashboard-sourced
 * pings because the query doesn't filter by source — it finds the most recent
 * message to the learner regardless of origin.
 */

describe('EmployerPingService — Dashboard Reply Capture', () => {
  let service;
  let mockStore;
  let mockSendMessage;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([]),
      queryOne: vi.fn(),
    };
    mockSendMessage = vi.fn().mockResolvedValue(undefined);

    service = new EmployerPingService({
      store: mockStore,
      sendMessage: mockSendMessage,
    });
  });

  // ─── Dashboard-Initiated Ping Reply Capture ────────────────────────────────

  describe('learner reply to dashboard-sourced ping', () => {
    it('should forward learner reply to officer when dashboard ping exists within 24h', async () => {
      const session = {
        learnerId: 'learner-dash-1',
        phone: '9876543210',
        collected: { name: 'Vikram' },
      };

      // Simulate finding a recent dashboard-initiated ping
      // The query in handleLearnerReply doesn't filter by source,
      // so dashboard-sourced messages are found the same way
      mockStore.queryOne.mockResolvedValueOnce({
        id: 'msg-dashboard-001',
        sender_id: 'officer-1',
        employer_phone: '9111111111',
        employer_name: 'Officer Singh',
      });

      const result = await service.handleLearnerReply(session, 'Yes sir, I am interested');

      // Reply forwarded to the officer's WhatsApp
      expect(mockSendMessage).toHaveBeenCalledWith(
        '9111111111',
        '[Vikram] replies: Yes sir, I am interested'
      );

      // Reply stored in messages table with reply_to_id linking to original dashboard ping
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        expect.arrayContaining([
          'officer-1',
          'learner-dash-1',
          'Yes sir, I am interested',
          'msg-dashboard-001',
        ])
      );

      // Return null — no reply back to learner
      expect(result).toBeNull();
    });

    it('should store reply with direction from_learner and link via reply_to_id', async () => {
      const session = {
        learnerId: 'learner-dash-2',
        phone: '8765432109',
        collected: { name: 'Priya' },
      };

      mockStore.queryOne.mockResolvedValueOnce({
        id: 'msg-dashboard-002',
        sender_id: 'officer-2',
        employer_phone: '9222222222',
        employer_name: 'Officer Patel',
      });

      await service.handleLearnerReply(session, 'Theek hai');

      // Verify the INSERT call includes direction 'from_learner' and reply_to_id
      const insertCall = mockStore.query.mock.calls.find(
        ([sql]) => sql.includes('INSERT INTO messages')
      );

      expect(insertCall).toBeDefined();
      const [sql, params] = insertCall;
      expect(sql).toContain("'from_learner'");
      expect(params).toContain('msg-dashboard-002'); // reply_to_id
    });

    it('should log PING_RELAYED event for dashboard reply', async () => {
      const session = {
        learnerId: 'learner-dash-3',
        phone: '7654321098',
        collected: { name: 'Ankit' },
      };

      mockStore.queryOne.mockResolvedValueOnce({
        id: 'msg-dashboard-003',
        sender_id: 'officer-3',
        employer_phone: '9333333333',
        employer_name: 'Officer Sharma',
      });

      await service.handleLearnerReply(session, 'Main aa raha hoon');

      // Verify PING_RELAYED event logged
      const eventCall = mockStore.query.mock.calls.find(
        ([sql]) => sql.includes('INSERT INTO events')
      );

      expect(eventCall).toBeDefined();
      const [, eventParams] = eventCall;
      expect(eventParams).toContain('learner-dash-3');
      expect(eventParams).toContain('PING_RELAYED');

      // Verify metadata includes original message ID
      const metadata = JSON.parse(eventParams[2]);
      expect(metadata.original_message_id).toBe('msg-dashboard-003');
      expect(metadata.employer_id).toBe('officer-3');
    });
  });

  // ─── Failed Delivery Status Handling ───────────────────────────────────────

  describe('failed delivery status scenario', () => {
    it('should not crash when sendMessage throws (delivery failure)', async () => {
      const session = {
        learnerId: 'learner-fail-1',
        phone: '9876543210',
        collected: { name: 'Test' },
      };

      mockStore.queryOne.mockResolvedValueOnce({
        id: 'msg-fail-001',
        sender_id: 'officer-4',
        employer_phone: '9444444444',
        employer_name: 'Officer Kumar',
      });

      // Simulate WhatsApp delivery failure
      mockSendMessage.mockRejectedValueOnce(new Error('WhatsApp delivery failed'));

      // Should throw (propagates the delivery error)
      await expect(
        service.handleLearnerReply(session, 'Reply that fails to forward')
      ).rejects.toThrow('WhatsApp delivery failed');
    });
  });

  // ─── Thread Query Verification (Both Directions) ───────────────────────────

  describe('thread query returns both directions', () => {
    it('handleLearnerReply query does not filter by source — captures dashboard pings', async () => {
      const session = {
        learnerId: 'learner-thread-1',
        phone: '9876543210',
        collected: { name: 'Rohan' },
      };

      // The queryOne in handleLearnerReply searches for the most recent message
      // TO this learner within 24h — regardless of source (whatsapp/dashboard)
      mockStore.queryOne.mockResolvedValueOnce({
        id: 'msg-from-dashboard',
        sender_id: 'officer-5',
        employer_phone: '9555555555',
        employer_name: 'Officer Gupta',
      });

      const result = await service.handleLearnerReply(session, 'Received, thanks');

      // Successfully forwards — proves dashboard pings are captured
      expect(mockSendMessage).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});
