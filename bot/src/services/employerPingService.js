import { checkMessage } from './contentSafetyService.js';
import { EventTypes } from '../constants/steps.js';

/**
 * Regex to parse employer ping commands.
 * Format: "msg learner:<phone>: <message>"
 * - Case-insensitive
 * - Allows optional whitespace around the colon separators
 * - Phone must be exactly 10 digits
 * - Message body is everything after the second colon (trimmed)
 */
const EMPLOYER_COMMAND_REGEX = /^msg\s+learner:\s*(\d{10})\s*:\s*(.+)$/is;

/**
 * Indian mobile phone validation: 10 digits, first digit is 6-9.
 */
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/**
 * EmployerPingService handles parsing, validating, and relaying
 * employer-to-learner messages sent via WhatsApp.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8
 */
export class EmployerPingService {
  /**
   * @param {object} params
   * @param {object} params.store - SupabaseStore instance with query/queryOne methods
   * @param {function} params.sendMessage - Callback to send WhatsApp message: (phone, text) => Promise<void>
   * @param {object} [params.logger] - Optional pino logger instance
   */
  constructor({ store, sendMessage, logger = null }) {
    this.store = store;
    this.sendMessage = sendMessage;
    this.logger = logger;
  }

  // ─── Command Parsing ─────────────────────────────────────────────────────

  /**
   * Parse an employer ping command from the raw message text.
   *
   * Expected format: "msg learner:<phone>: <message>"
   *
   * @param {string} text - The raw incoming WhatsApp message text
   * @returns {{ phone: string, message: string } | null} Parsed result or null if format doesn't match
   */
  parseEmployerCommand(text) {
    if (!text || typeof text !== 'string') return null;

    const match = text.match(EMPLOYER_COMMAND_REGEX);
    if (!match) return null;

    const phone = match[1].trim();
    const message = match[2].trim();

    if (!message) return null;

    return { phone, message };
  }

  // ─── Main Orchestration ──────────────────────────────────────────────────

  /**
   * Handle an incoming employer ping command.
   * Orchestrates parsing → validation → content safety → relay → storage.
   *
   * @param {string} text - The raw incoming WhatsApp message text
   * @param {string} senderPhone - The sender's phone number (employer)
   * @returns {Promise<string|null>} Response message to send back to the employer, or null to ignore silently
   */
  async handleEmployerPing(text, senderPhone) {
    // 1. Parse the command
    const parsed = this.parseEmployerCommand(text);
    if (!parsed) {
      return 'Invalid command format. Use: msg learner:<10-digit phone>: <your message>';
    }

    const { phone: learnerPhone, message } = parsed;

    // 2. Validate phone format (Indian mobile: starts with 6-9, 10 digits)
    if (!INDIAN_MOBILE_REGEX.test(learnerPhone)) {
      return 'Invalid phone number. Please provide a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';
    }

    // 3. Look up sender in users table — must have role 'employer'
    const sender = await this.store.queryOne(
      `SELECT id, role, full_name FROM users WHERE phone = $1`,
      [senderPhone]
    );

    // 4. If sender not found or not an employer, ignore silently (requirement 3.4)
    if (!sender || sender.role !== 'employer') {
      return null;
    }

    // 5. Look up learner by phone
    const learner = await this.store.queryOne(
      `SELECT id, full_name, phone FROM learners WHERE phone = $1`,
      [learnerPhone]
    );

    if (!learner) {
      return 'Learner not found. Please check the phone number and try again.';
    }

    // 6. Check rate limit (max 10 pings per employer per learner per calendar day)
    const rateLimitResult = await this.store.query(
      `SELECT COUNT(*)::text AS count FROM messages
       WHERE sender_id = $1 AND receiver_learner_id = $2 AND direction = 'to_learner'
         AND created_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
         AND created_at < ((NOW() AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 day')`,
      [sender.id, learner.id]
    );
    const pingCount = parseInt(rateLimitResult[0]?.count || '0', 10);
    if (pingCount >= 10) {
      return 'Daily limit reached. You can send up to 10 messages per learner per day.';
    }

    // 7. Run message through content safety filter
    const safetyResult = checkMessage(message);
    if (!safetyResult.safe) {
      return `Message cannot be delivered: ${safetyResult.reasons.join('; ')}`;
    }

    // 8. Look up employer's company name from jobs table
    const job = await this.store.queryOne(
      `SELECT company FROM jobs WHERE posted_by = $1 LIMIT 1`,
      [sender.id]
    );
    const companyName = job?.company || sender.full_name || 'Employer';

    // 9. Relay message to learner with company attribution
    const relayedMessage = `[${companyName}] says: ${message}`;
    await this.sendMessage(learnerPhone, relayedMessage);

    // 10. Store message in messages table
    await this.store.query(
      `INSERT INTO messages (sender_id, receiver_learner_id, direction, content, source, status)
       VALUES ($1, $2, 'to_learner', $3, 'whatsapp', 'sent')`,
      [sender.id, learner.id, message]
    );

    // 11. Log PING_SENT event
    await this.store.query(
      `INSERT INTO events (learner_id, event_type, source, metadata)
       VALUES ($1, $2, 'bot', $3)`,
      [
        learner.id,
        EventTypes.PING_SENT,
        JSON.stringify({
          sender_id: sender.id,
          sender_phone: senderPhone,
          learner_phone: learnerPhone,
          company: companyName,
          timestamp: new Date().toISOString()
        })
      ]
    );

    this._log('info', {
      senderId: sender.id,
      learnerId: learner.id,
      company: companyName
    }, 'Employer ping relayed to learner');

    // 12. Return confirmation to employer
    return `Message delivered to ${learner.full_name || 'learner'}.`;
  }

  // ─── Learner Reply Handling ────────────────────────────────────────────────

  /**
   * Handle a learner's reply to a recent employer ping.
   * Detects if a learner received a ping within the last 24 hours and forwards
   * the reply back to the employer's WhatsApp with learner name attribution.
   *
   * @param {object} session - Session object with learnerId, phone, collected (name), etc.
   * @param {string} text - The learner's raw reply text
   * @returns {Promise<string|null>} null if reply forwarded (no reply back to learner needed),
   *   or null if no recent ping found (caller should handle normally)
   *
   * Validates: Requirements 3.6, 3.7
   */
  async handleLearnerReply(session, text) {
    if (!session || !session.learnerId || !text) return null;

    // 1. Look up if there's a recent employer ping (within 24h) to this learner
    const recentPing = await this.store.queryOne(
      `SELECT m.id, m.sender_id, u.phone AS employer_phone, u.full_name AS employer_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.receiver_learner_id = $1
         AND m.direction = 'to_learner'
         AND m.created_at > NOW() - INTERVAL '24 hours'
       ORDER BY m.created_at DESC
       LIMIT 1`,
      [session.learnerId]
    );

    // No recent ping found — return undefined to signal caller should handle normally
    if (!recentPing) return undefined;

    // 2. Run reply through content safety filter before forwarding
    const safetyResult = checkMessage(text);
    if (!safetyResult.safe) {
      // Don't forward unsafe content; silently drop (learner doesn't get error for reply)
      this._log('info', {
        learnerId: session.learnerId,
        reasons: safetyResult.reasons
      }, 'Learner reply blocked by content safety filter');
      return null;
    }

    // 3. Get learner name for attribution
    const learnerName = session.collected?.name || 'Learner';

    // 4. Forward reply to employer's WhatsApp with learner name attribution
    const forwardedMessage = `[${learnerName}] replies: ${text}`;
    await this.sendMessage(recentPing.employer_phone, forwardedMessage);

    // 5. Store reply in messages table linked via reply_to_id
    await this.store.query(
      `INSERT INTO messages (sender_id, receiver_learner_id, direction, content, source, status, reply_to_id)
       VALUES ($1, $2, 'from_learner', $3, 'whatsapp', 'sent', $4)`,
      [recentPing.sender_id, session.learnerId, text, recentPing.id]
    );

    // 6. Log PING_RELAYED event
    await this.store.query(
      `INSERT INTO events (learner_id, event_type, source, metadata)
       VALUES ($1, $2, 'bot', $3)`,
      [
        session.learnerId,
        EventTypes.PING_RELAYED,
        JSON.stringify({
          employer_id: recentPing.sender_id,
          employer_phone: recentPing.employer_phone,
          original_message_id: recentPing.id,
          learner_name: learnerName,
          timestamp: new Date().toISOString()
        })
      ]
    );

    this._log('info', {
      learnerId: session.learnerId,
      employerId: recentPing.sender_id,
      originalMessageId: recentPing.id
    }, 'Learner reply forwarded to employer');

    // Return null — no reply back to learner needed
    return null;
  }

  // ─── Rate Limiting ────────────────────────────────────────────────────────

  /**
   * Check whether an employer has exceeded the daily ping limit for a specific learner.
   * Rate limit: max 10 pings per employer per learner per calendar day (IST midnight-to-midnight).
   *
   * @param {string} employerId - The employer's user ID
   * @param {string} learnerId - The target learner's ID
   * @returns {Promise<{ allowed: boolean, count: number }>} Whether the ping is allowed and current count
   *
   * Validates: Requirements 3.9, 3.10
   */
  async checkRateLimit(employerId, learnerId) {
    // Get today's date boundaries in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const istStartOfDay = new Date(istNow);
    istStartOfDay.setUTCHours(0, 0, 0, 0);
    const utcStartOfDay = new Date(istStartOfDay.getTime() - istOffset);

    const result = await this.store.queryOne(
      `SELECT COUNT(*)::text AS count FROM messages
       WHERE sender_id = $1
         AND receiver_learner_id = $2
         AND direction = 'to_learner'
         AND created_at >= $3`,
      [employerId, learnerId, utcStartOfDay.toISOString()]
    );

    const count = parseInt(result?.count || '0', 10);
    const allowed = count < 10;

    return { allowed, count };
  }

  // ─── Internal Helpers ────────────────────────────────────────────────────

  /**
   * Internal logging helper. Uses pino structured logging when available.
   */
  _log(level, meta, message) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](meta, message);
    } else if (level === 'error') {
      console.error('[EmployerPingService]', message, meta);
    }
  }
}
