/**
 * OnboardingRetryService — Handles failed onboarding message retries.
 *
 * Tracks failed welcome message deliveries and automatically retries
 * after 4 hours, up to 3 attempts. After 3 failures, marks the learner
 * as 'unreachable'.
 *
 * Onboarding metadata is stored in the sessions table `data` JSONB field:
 *   {
 *     onboardingStatus: 'pending' | 'failed' | 'success' | 'unreachable',
 *     onboardingAttempts: number,
 *     lastAttemptAt: ISO string,
 *     failureReason: string
 *   }
 *
 * Uses a polling-based approach (setInterval every 30 minutes) to check
 * for due retries rather than adding an external cron dependency.
 */

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_HOURS = 4;
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

const WELCOME_MESSAGE =
  'Namaste! 🙏 Main SaathiAI hoon — aapka career companion. Main aapko jobs dhundne, skill card banane, aur interviews ki taiyaari mein madad karunga. Chaliye shuru karte hain!';

export class OnboardingRetryService {
  /**
   * @param {object} params
   * @param {object} params.store - SupabaseStore instance with query/queryOne methods
   * @param {object} [params.logger] - Optional pino logger instance
   */
  constructor({ store, logger = null }) {
    this.store = store;
    this.logger = logger;
    this._pollTimer = null;
    this._sendMessage = null;
  }

  /**
   * Set the callback used to send WhatsApp messages.
   * @param {function} fn - Async function: (phone: string, text: string) => Promise<void>
   */
  setSendMessage(fn) {
    this._sendMessage = fn;
  }

  // ─── Failure Recording ────────────────────────────────────────────────────

  /**
   * Record a failed onboarding welcome message delivery.
   * Logs failure with phone, timestamp, and error reason.
   * Sets learner onboarding status to 'failed'.
   * If attempts >= 3, marks learner as 'unreachable'.
   *
   * @param {string} learnerId - UUID of the learner
   * @param {string} phone - Learner's phone number
   * @param {string} reason - Error reason for the failure
   * @returns {Promise<object>} Updated onboarding metadata
   */
  async recordFailure(learnerId, phone, reason) {
    const now = new Date().toISOString();

    // Get current onboarding metadata from the session
    const session = await this.store.queryOne(
      `SELECT id, data FROM sessions
       WHERE learner_id = $1
       ORDER BY updated_at DESC LIMIT 1`,
      [learnerId]
    );

    const currentData = session?.data ?? {};
    const currentAttempts = currentData.onboardingAttempts ?? 0;
    const newAttempts = currentAttempts + 1;

    const newStatus = newAttempts >= MAX_ATTEMPTS ? 'unreachable' : 'failed';

    const onboardingMeta = {
      onboardingStatus: newStatus,
      onboardingAttempts: newAttempts,
      lastAttemptAt: now,
      failureReason: reason
    };

    // Log the failure
    this._log('warn', {
      learnerId,
      phone,
      reason,
      attempt: newAttempts,
      status: newStatus
    }, `Onboarding message delivery failed (attempt ${newAttempts}/${MAX_ATTEMPTS})`);

    if (session) {
      // Update existing session data with onboarding metadata
      const updatedData = { ...currentData, ...onboardingMeta };
      await this.store.query(
        `UPDATE sessions
         SET data = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(updatedData), session.id]
      );
    } else {
      // Create a new session record with onboarding metadata
      await this.store.query(
        `INSERT INTO sessions (learner_id, step, data)
         VALUES ($1, 'ONBOARDING', $2)`,
        [learnerId, JSON.stringify(onboardingMeta)]
      );
    }

    // Log event for dashboard visibility
    await this.store.query(
      `INSERT INTO events (learner_id, event_type, source, metadata)
       VALUES ($1, 'ONBOARDING_FAILED', 'bot', $2)`,
      [
        learnerId,
        JSON.stringify({ phone, reason, attempt: newAttempts, status: newStatus, timestamp: now })
      ]
    );

    if (newStatus === 'unreachable') {
      this._log('warn', { learnerId, phone }, 'Learner marked as unreachable after 3 failed onboarding attempts');
    }

    return onboardingMeta;
  }

  // ─── Due Retry Query ──────────────────────────────────────────────────────

  /**
   * Find learners whose onboarding has failed, haven't exceeded max attempts,
   * and whose last attempt was more than 4 hours ago.
   *
   * @returns {Promise<Array<{learnerId: string, phone: string, attempts: number, sessionId: string}>>}
   */
  async getDueRetries() {
    const rows = await this.store.query(
      `SELECT s.id AS session_id, s.learner_id, s.data, l.phone
       FROM sessions s
       JOIN learners l ON l.id = s.learner_id
       WHERE s.data->>'onboardingStatus' = 'failed'
         AND (s.data->>'onboardingAttempts')::int < $1
         AND (s.data->>'lastAttemptAt')::timestamptz + INTERVAL '${RETRY_DELAY_HOURS} hours' <= NOW()
         AND s.id = (
           SELECT id FROM sessions
           WHERE learner_id = s.learner_id
           ORDER BY updated_at DESC LIMIT 1
         )`,
      [MAX_ATTEMPTS]
    );

    return rows.map((row) => ({
      learnerId: row.learner_id,
      phone: row.phone,
      attempts: parseInt(row.data?.onboardingAttempts ?? '0', 10),
      sessionId: row.session_id
    }));
  }

  // ─── Retry Processing ─────────────────────────────────────────────────────

  /**
   * Process all due retries. For each learner due for retry, attempt to send
   * the welcome message. On success, set onboardingStatus to 'success'.
   * On failure, call recordFailure again.
   *
   * @param {function} [sendMessage] - Optional override for the send function
   * @returns {Promise<{retried: number, succeeded: number, failed: number}>}
   */
  async processRetries(sendMessage) {
    const send = sendMessage || this._sendMessage;

    if (!send) {
      this._log('warn', {}, 'processRetries called but no sendMessage function available');
      return { retried: 0, succeeded: 0, failed: 0 };
    }

    const dueRetries = await this.getDueRetries();

    if (dueRetries.length === 0) {
      return { retried: 0, succeeded: 0, failed: 0 };
    }

    this._log('info', { count: dueRetries.length }, 'Processing onboarding retries');

    let succeeded = 0;
    let failed = 0;

    for (const entry of dueRetries) {
      try {
        await send(entry.phone, WELCOME_MESSAGE);

        // Success — update onboarding status
        await this._markSuccess(entry.learnerId, entry.sessionId);
        succeeded += 1;

        this._log('info', { learnerId: entry.learnerId, phone: entry.phone }, 'Onboarding retry succeeded');
      } catch (error) {
        // Failed — record the failure (increments attempts, may mark unreachable)
        await this.recordFailure(entry.learnerId, entry.phone, error.message);
        failed += 1;
      }
    }

    this._log('info', { retried: dueRetries.length, succeeded, failed }, 'Onboarding retry cycle complete');

    return { retried: dueRetries.length, succeeded, failed };
  }

  // ─── Polling Loop ─────────────────────────────────────────────────────────

  /**
   * Start the polling loop that checks for due retries every 30 minutes.
   */
  startPolling() {
    if (this._pollTimer) return;

    this._log('info', {}, 'Starting onboarding retry polling loop (every 30 min)');
    this._pollTimer = setInterval(() => this.processRetries(), POLL_INTERVAL_MS);

    // Run an initial check immediately
    this.processRetries();
  }

  /**
   * Stop the polling loop. Call this on graceful shutdown.
   */
  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
      this._log('info', {}, 'Stopped onboarding retry polling loop');
    }
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────────

  /**
   * Mark a learner's onboarding as successful after a retry.
   * @param {string} learnerId
   * @param {string} sessionId
   */
  async _markSuccess(learnerId, sessionId) {
    const session = await this.store.queryOne(
      `SELECT data FROM sessions WHERE id = $1`,
      [sessionId]
    );

    const currentData = session?.data ?? {};
    const updatedData = {
      ...currentData,
      onboardingStatus: 'success',
      lastAttemptAt: new Date().toISOString()
    };

    await this.store.query(
      `UPDATE sessions
       SET data = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(updatedData), sessionId]
    );

    // Log success event
    await this.store.query(
      `INSERT INTO events (learner_id, event_type, source, metadata)
       VALUES ($1, 'ONBOARDING_TRIGGERED', 'bot', $2)`,
      [
        learnerId,
        JSON.stringify({ status: 'success', retried: true, timestamp: new Date().toISOString() })
      ]
    );
  }

  /**
   * Internal logging helper.
   */
  _log(level, meta, message) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](meta, message);
    } else if (level === 'error' || level === 'warn') {
      console.error('[OnboardingRetryService]', message, meta);
    }
  }
}
