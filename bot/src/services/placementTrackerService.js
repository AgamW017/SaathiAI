import { Steps, EventTypes } from '../constants/steps.js';

const SALARY_NUDGE_DAY = 7;
const RETENTION_CHECK_DAYS = [30, 60, 90];
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SALARY_MIN = 1000;
const SALARY_MAX = 100000;
const SALARY_TIMEOUT_HOURS = 48;
const RETENTION_TIMEOUT_HOURS = 48;
const RETENTION_FINAL_TIMEOUT_HOURS = 24;

const SALARY_NUDGE_MESSAGE =
  'Namaste! Aapki nayi job mein monthly salary kitni mil rahi hai? (Please share your current monthly salary amount)';

const SALARY_CLARIFY_MESSAGE =
  'Exact monthly salary bata dijiye — jaise 12000 ya 15000. Sirf number batayein.';

const SALARY_OUT_OF_RANGE_MESSAGE =
  'Yeh amount sahi nahi lag raha. Kripya apni monthly salary 1000 se 100000 ke beech mein batayein.';

const SALARY_SUCCESS_MESSAGE =
  'Dhanyavaad! Aapki salary record ho gayi hai. Hum aapke saath check-in karte rahenge.';

const SALARY_REVIEW_MESSAGE =
  'Dhanyavaad. Humne aapka response save kar liya hai. Ek officer aapse jaldi contact karenge.';

const SALARY_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    salary: { type: 'number' },
    confidence: { type: 'number' }
  },
  required: ['salary', 'confidence']
};

// ─── Retention Check Messages ──────────────────────────────────────────────

const RETENTION_CHECK_MESSAGES = {
  devanagari: 'नमस्ते! क्या आप अभी भी उसी job पर काम कर रहे हैं? बस "हाँ" या "नहीं" बता दीजिए।',
  roman: 'Namaste! Kya aap abhi bhi usi job par kaam kar rahe hain? Bas "haan" ya "nahi" bata dijiye.',
  english: 'Hello! Are you still working at the same job? Just reply "yes" or "no".'
};

const RETENTION_CLARIFY_MESSAGES = {
  devanagari: 'माफ करें, मैं समझ नहीं पाया। क्या आप अभी भी वही job कर रहे हैं, या छोड़ दी? बस "हाँ, कर रहा हूँ" या "नहीं, छोड़ दी" बता दीजिए।',
  roman: 'Maaf karein, main samajh nahi paaya. Kya aap abhi bhi wahi job kar rahe hain, ya chhod di? Bas "haan, kar raha hoon" ya "nahi, chhod di" bata dijiye.',
  english: 'Sorry, I could not understand. Are you still at the same job, or have you left? Please reply "yes, still working" or "no, I left".'
};

const RETENTION_90_DAY_SALARY_MESSAGES = {
  devanagari: '3 महीने हो गए — बधाई! क्या आपकी salary बदली है? अगर हाँ, तो नई monthly salary बता दीजिए। अगर नहीं बदली, तो "same" लिखें।',
  roman: '3 mahine ho gaye — badhai! Kya aapki salary badli hai? Agar haan, to nayi monthly salary bata dijiye. Agar nahi badli, to "same" likhein.',
  english: '3 months completed — congratulations! Has your salary changed? If yes, please share your new monthly salary. If not, reply "same".'
};

const RETENTION_REMINDER_MESSAGES = {
  devanagari: 'नमस्ते! हमने पहले भी पूछा था — क्या आप अभी भी काम कर रहे हैं? कृपया reply करें।',
  roman: 'Namaste! Humne pehle bhi poocha tha — kya aap abhi bhi kaam kar rahe hain? Please reply karein.',
  english: 'Hello! We asked earlier — are you still working? Please reply.'
};

const RETENTION_RETAINED_MESSAGES = {
  devanagari: '👍 बहुत अच्छा! काम करते रहिए। हम check-in करते रहेंगे।',
  roman: '👍 Bahut accha! Kaam karte rahiye. Hum check-in karte rahenge.',
  english: '👍 Great! Keep up the good work. We will check in again later.'
};

const RETENTION_LEFT_MESSAGES = {
  devanagari: 'समझ गया। कोई बात नहीं — हम आपके लिए नई jobs ढूंढेंगे। जल्दी नई opportunities भेजेंगे।',
  roman: 'Samajh gaya. Koi baat nahi — hum aapke liye nayi jobs dhoondenge. Jaldi nayi opportunities bhejenge.',
  english: 'Understood. No worries — we will find new jobs for you. We will share new opportunities soon.'
};

const RETENTION_CLASSIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    classification: { type: 'string', enum: ['retained', 'left', 'unclear'] },
    confidence: { type: 'number' }
  },
  required: ['classification', 'confidence']
};

/**
 * PlacementTrackerService handles post-placement salary capture scheduling
 * and retention check scheduling.
 *
 * Uses a polling-based approach (setInterval every 5 minutes) to check for
 * due nudges rather than an external dependency like node-cron.
 */
export class PlacementTrackerService {
  /**
   * @param {object} params
   * @param {object} params.store - SupabaseStore instance with query/queryOne methods
   * @param {object} params.gemini - GeminiClient instance for LLM extraction
   * @param {function} params.sendMessage - Callback to send WhatsApp message: (learnerId, text) => Promise<void>
   * @param {object} [params.logger] - Optional pino logger instance
   */
  constructor({ store, gemini, sendMessage, logger = null }) {
    this.store = store;
    this.gemini = gemini;
    this.sendMessage = sendMessage;
    this.logger = logger;
    this._pollTimer = null;
  }

  // ─── Salary Capture Scheduling ───────────────────────────────────────────

  /**
   * Schedule a salary capture nudge for 7 days after placement.
   * Inserts a retention_checks record with check_day=7 and status='pending'.
   * Uses ON CONFLICT to enforce uniqueness (one check per placement per check_day).
   *
   * @param {string} learnerId - UUID of the learner
   * @param {Date|string} placementDate - The confirmed placement date
   * @returns {Promise<object|null>} The created retention_checks record, or null if already exists
   */
  async scheduleSalaryCapture(learnerId, placementDate) {
    const placementId = await this._getPlacementId(learnerId);

    const rows = await this.store.query(
      `INSERT INTO retention_checks (placement_id, learner_id, check_day, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (placement_id, check_day) DO NOTHING
       RETURNING *`,
      [placementId, learnerId, SALARY_NUDGE_DAY]
    );

    const record = rows[0] ?? null;

    if (record) {
      this._log('info', { learnerId, placementId }, 'Scheduled salary capture nudge for day 7');
    } else {
      this._log('info', { learnerId, placementId }, 'Salary capture already scheduled, skipping');
    }

    return record;
  }

  // ─── Polling Loop ────────────────────────────────────────────────────────

  /**
   * Start the polling loop that checks for due salary nudges every 5 minutes.
   * Uses setInterval to avoid adding a node-cron dependency.
   */
  startPolling() {
    if (this._pollTimer) return;

    this._log('info', {}, 'Starting placement tracker polling loop (every 5 min)');
    this._pollTimer = setInterval(() => this._pollCycle(), POLL_INTERVAL_MS);

    // Run an initial check immediately on start
    this._pollCycle();
  }

  /**
   * Stop the polling loop. Call this on graceful shutdown.
   */
  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
      this._log('info', {}, 'Stopped placement tracker polling loop');
    }
  }

  // ─── Salary Response Handling ──────────────────────────────────────────

  /**
   * Handle a learner's response to the salary capture nudge.
   * Uses Gemini LLM to extract a numeric salary from natural language Hindi/Hinglish text.
   *
   * @param {object} session - Session object with learnerId, step, phone, collected, context
   * @param {string} text - The learner's raw message text
   * @returns {Promise<Array<{text: string}>>} Array of reply objects to send back
   */
  async handleSalaryResponse(session, text) {
    const extractedSalary = await this._extractSalaryViaLLM(text);

    // LLM successfully extracted a number
    if (extractedSalary !== null) {
      // Validate salary range
      if (extractedSalary < SALARY_MIN || extractedSalary > SALARY_MAX) {
        // Out of range — ask to re-enter (stay on same step for one more attempt)
        if (session.step === Steps.SALARY_CAPTURE) {
          session.step = Steps.SALARY_RETRY;
          return [{ text: SALARY_OUT_OF_RANGE_MESSAGE }];
        }
        // Second out-of-range attempt — store as review_needed
        return this._markForReview(session, text);
      }

      // Valid salary — store it
      return this._storeSalary(session, extractedSalary);
    }

    // LLM could not extract a salary
    if (session.step === Steps.SALARY_CAPTURE) {
      // First attempt failed — ask for clarification
      session.step = Steps.SALARY_RETRY;
      return [{ text: SALARY_CLARIFY_MESSAGE }];
    }

    // Second attempt also failed — store raw text and mark for review
    return this._markForReview(session, text);
  }

  /**
   * Check for salary capture nudges that have timed out (48 hours without response).
   * Finds retention_checks with check_day=7, status='sent', where checked_at + 48h < NOW().
   * Updates those to status='no_response' and sets placement to review_needed.
   */
  async checkSalaryTimeouts() {
    try {
      const timedOut = await this.store.query(
        `UPDATE retention_checks
         SET status = 'no_response', notes = '48h timeout - no salary response'
         WHERE check_day = $1
           AND status = 'sent'
           AND checked_at + INTERVAL '${SALARY_TIMEOUT_HOURS} hours' < NOW()
         RETURNING id, learner_id, placement_id`,
        [SALARY_NUDGE_DAY]
      );

      for (const record of timedOut) {
        // Set placement to review_needed by storing a note
        await this.store.query(
          `UPDATE placements
           SET retention_status = 'unknown',
               updated_at = NOW()
           WHERE id = $1`,
          [record.placement_id]
        );

        // Log the no_response event
        await this.store.query(
          `INSERT INTO events (learner_id, event_type, source, metadata)
           VALUES ($1, $2, 'bot', $3)`,
          [
            record.learner_id,
            EventTypes.RETENTION_NO_RESPONSE,
            JSON.stringify({ check_day: SALARY_NUDGE_DAY, reason: 'timeout_48h' })
          ]
        );

        // Reset learner session step from SALARY_CAPTURE/SALARY_RETRY back to PLACED
        await this.store.query(
          `UPDATE sessions
           SET step = 'PLACED', updated_at = NOW()
           WHERE learner_id = $1
             AND step IN ('SALARY_CAPTURE', 'SALARY_RETRY')
             AND id = (SELECT id FROM sessions WHERE learner_id = $1 ORDER BY updated_at DESC LIMIT 1)`,
          [record.learner_id]
        );

        this._log('info', { learnerId: record.learner_id }, 'Salary capture timed out (48h), marked no_response');
      }

      if (timedOut.length > 0) {
        this._log('info', { count: timedOut.length }, 'Processed salary capture timeouts');
      }
    } catch (error) {
      this._log('error', { err: error.message }, 'Error checking salary timeouts');
    }
  }

  // ─── Internal: Salary Extraction Helpers ─────────────────────────────────

  /**
   * Use Gemini LLM to extract a numeric monthly salary from Hindi/Hinglish text.
   * @param {string} text - Learner's raw message
   * @returns {Promise<number|null>} Extracted salary amount or null if extraction fails
   */
  async _extractSalaryViaLLM(text) {
    if (!this.gemini) return null;

    const prompt = `You are a salary extraction assistant for Indian vocational workers.
Extract the monthly salary (in INR) from the following Hindi/Hinglish message.
The learner may say things like "15000", "15 hazar", "pandraa hazaar", "₹15,000/month", "15k", etc.
If the text contains a salary amount, return it as a number. If you cannot determine a salary, return 0.
Only extract monthly salary. If they mention daily wages, multiply by 26 working days.
If they mention annual salary, divide by 12.

Message: ${JSON.stringify(text)}`;

    try {
      const result = await this.gemini.generateJson({
        prompt,
        schema: SALARY_EXTRACTION_SCHEMA
      });

      if (result && result.salary > 0 && result.confidence > 0.3) {
        return Math.round(result.salary);
      }

      return null;
    } catch (error) {
      this._log('error', { err: error.message }, 'LLM salary extraction failed');
      return null;
    }
  }

  /**
   * Store a valid salary in the placement record and log the event.
   * @param {object} session - Current session
   * @param {number} salary - Validated salary amount
   * @returns {Promise<Array<{text: string}>>} Reply messages
   */
  async _storeSalary(session, salary) {
    const placementId = await this._getPlacementId(session.learnerId);

    // Update placement with salary
    await this.store.query(
      `UPDATE placements
       SET salary_reported = $1, updated_at = NOW()
       WHERE id = $2`,
      [salary, placementId]
    );

    // Update retention_check record status to 'retained' (salary captured)
    await this.store.query(
      `UPDATE retention_checks
       SET status = 'retained', salary_reported = $1, checked_at = NOW()
       WHERE placement_id = $2 AND check_day = $3 AND status = 'sent'`,
      [salary, placementId, SALARY_NUDGE_DAY]
    );

    // Log SALARY_CAPTURED event
    await this.store.query(
      `INSERT INTO events (learner_id, event_type, source, metadata)
       VALUES ($1, $2, 'bot', $3)`,
      [
        session.learnerId,
        EventTypes.SALARY_CAPTURED,
        JSON.stringify({ salary, placement_id: placementId })
      ]
    );

    // Advance session to PLACED step
    session.step = Steps.PLACED;

    this._log('info', { learnerId: session.learnerId, salary }, 'Salary captured successfully');

    return [{ text: SALARY_SUCCESS_MESSAGE }];
  }

  /**
   * Mark a placement as review_needed when salary cannot be extracted after retries.
   * Stores the raw text as a note for officer review.
   * @param {object} session - Current session
   * @param {string} rawText - The learner's unprocessed text
   * @returns {Promise<Array<{text: string}>>} Reply messages
   */
  async _markForReview(session, rawText) {
    const placementId = await this._getPlacementId(session.learnerId);

    // Update retention_check with raw text as note and status review_needed
    await this.store.query(
      `UPDATE retention_checks
       SET status = 'no_response', notes = $1, checked_at = NOW()
       WHERE placement_id = $2 AND check_day = $3 AND status = 'sent'`,
      [rawText, placementId, SALARY_NUDGE_DAY]
    );

    // Update placement retention_status so it surfaces on the dashboard
    await this.store.query(
      `UPDATE placements
       SET retention_status = 'unknown', updated_at = NOW()
       WHERE id = $1`,
      [placementId]
    );

    // Advance session back to PLACED (done with salary capture flow)
    session.step = Steps.PLACED;

    this._log('info', { learnerId: session.learnerId }, 'Salary extraction failed, marked for review');

    return [{ text: SALARY_REVIEW_MESSAGE }];
  }

  // ─── Retention Check Scheduling ─────────────────────────────────────────

  /**
   * Schedule retention checks at 30, 60, and 90 days after placement.
   * Inserts retention_checks records for each day with status='pending'.
   * Uses ON CONFLICT to enforce uniqueness.
   *
   * @param {string} learnerId - UUID of the learner
   * @param {Date|string} placementDate - The confirmed placement date
   * @returns {Promise<object[]>} Array of created retention_checks records
   */
  async scheduleRetentionChecks(learnerId, placementDate) {
    const placementId = await this._getPlacementId(learnerId);
    const created = [];

    for (const checkDay of RETENTION_CHECK_DAYS) {
      const rows = await this.store.query(
        `INSERT INTO retention_checks (placement_id, learner_id, check_day, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (placement_id, check_day) DO NOTHING
         RETURNING *`,
        [placementId, learnerId, checkDay]
      );

      if (rows[0]) created.push(rows[0]);
    }

    this._log('info', { learnerId, placementId, count: created.length }, 'Scheduled retention checks');
    return created;
  }

  // ─── Retention Response Handling ──────────────────────────────────────────

  /**
   * Handle a learner's response to a retention check.
   * Uses Gemini LLM to classify the response as 'retained', 'left', or 'unclear'.
   *
   * @param {object} session - Session object with learnerId, step, phone, script, context
   * @param {string} text - The learner's raw message text
   * @returns {Promise<Array<{text: string}>>} Array of reply objects to send back
   */
  async handleRetentionResponse(session, text) {
    const script = session.script || 'roman';

    // If awaiting salary update for 90-day check
    if (session.context?.awaitingSalaryUpdate) {
      return this._handle90DaySalaryUpdate(session, text);
    }

    // Classify the response via LLM
    const classification = await this._classifyRetentionResponse(text);

    if (classification === 'retained') {
      return this._handleRetained(session, script);
    }

    if (classification === 'left') {
      return this._handleLeft(session, script);
    }

    // 'unclear' — handle based on step
    if (session.step === Steps.RETENTION_CHECK) {
      // First attempt unclear — ask for clarification
      session.step = Steps.RETENTION_RETRY;
      return [{ text: RETENTION_CLARIFY_MESSAGES[script] }];
    }

    // Second attempt (RETENTION_RETRY) still unclear — mark as no_response with notes
    return this._handleUnclearAfterRetry(session, text);
  }

  /**
   * Check for retention checks that have timed out.
   * 48h after the check was sent: send a reminder.
   * 24h after the reminder: mark as 'no_response'.
   */
  async checkRetentionTimeouts() {
    try {
      // Step 1: Find checks that were sent 48+ hours ago and haven't received a reminder yet
      const needsReminder = await this.store.query(
        `SELECT rc.id, rc.learner_id, rc.placement_id, rc.check_day, l.phone,
                s.data->>'script' AS script
         FROM retention_checks rc
         JOIN learners l ON l.id = rc.learner_id
         JOIN sessions s ON s.learner_id = rc.learner_id
           AND s.id = (SELECT id FROM sessions WHERE learner_id = rc.learner_id ORDER BY updated_at DESC LIMIT 1)
         WHERE rc.check_day IN (30, 60, 90)
           AND rc.status = 'sent'
           AND rc.checked_at + INTERVAL '${RETENTION_TIMEOUT_HOURS} hours' < NOW()
           AND (rc.notes IS NULL OR rc.notes NOT LIKE '%reminder_sent%')`,
        []
      );

      for (const check of needsReminder) {
        await this._sendRetentionReminder(check);
      }

      // Step 2: Find checks where reminder was sent 24+ hours ago — final timeout
      const finalTimeout = await this.store.query(
        `SELECT rc.id, rc.learner_id, rc.placement_id, rc.check_day
         FROM retention_checks rc
         WHERE rc.check_day IN (30, 60, 90)
           AND rc.status = 'sent'
           AND rc.notes LIKE '%reminder_sent%'
           AND rc.checked_at + INTERVAL '${RETENTION_TIMEOUT_HOURS + RETENTION_FINAL_TIMEOUT_HOURS} hours' < NOW()`,
        []
      );

      for (const check of finalTimeout) {
        await this._markRetentionNoResponse(check);
      }

      if (needsReminder.length > 0 || finalTimeout.length > 0) {
        this._log('info', { reminders: needsReminder.length, timeouts: finalTimeout.length }, 'Processed retention timeouts');
      }
    } catch (error) {
      this._log('error', { err: error.message }, 'Error checking retention timeouts');
    }
  }

  // ─── Internal: Retention Classification and Handlers ─────────────────────

  /**
   * Use Gemini LLM to classify a retention check response.
   * @param {string} text - The learner's raw response
   * @returns {Promise<'retained'|'left'|'unclear'>} Classification result
   */
  async _classifyRetentionResponse(text) {
    if (!this.gemini) return 'unclear';

    const prompt = `You are a retention check classifier for Indian vocational workers.
Classify the following message as one of:
- "retained": The learner indicates they are still working at the same job (e.g., "haan", "yes", "kaam kar raha hoon", "accha chal raha hai", "abhi bhi wahi job")
- "left": The learner indicates they have left or lost the job (e.g., "nahi", "chhod diya", "nikal diya", "left", "band ho gaya", "fired", "quit")
- "unclear": Cannot confidently determine from the message

Message: ${JSON.stringify(text)}`;

    try {
      const result = await this.gemini.generateJson({
        prompt,
        schema: RETENTION_CLASSIFICATION_SCHEMA
      });

      if (result && result.confidence > 0.5) {
        return result.classification;
      }

      return 'unclear';
    } catch (error) {
      this._log('error', { err: error.message }, 'LLM retention classification failed');
      return 'unclear';
    }
  }

  /**
   * Handle a 'retained' classification. Log event and update check record.
   * If this is the 90-day check, also ask about salary changes.
   */
  async _handleRetained(session, script) {
    const placementId = await this._getPlacementId(session.learnerId);

    // Determine which check_day this is from the pending/sent retention check
    const checkRecord = await this.store.queryOne(
      `SELECT id, check_day FROM retention_checks
       WHERE placement_id = $1 AND learner_id = $2 AND status = 'sent'
         AND check_day IN (30, 60, 90)
       ORDER BY check_day ASC LIMIT 1`,
      [placementId, session.learnerId]
    );

    if (!checkRecord) {
      this._log('warn', { learnerId: session.learnerId }, 'No active retention check found for retained response');
      session.step = Steps.PLACED;
      return [{ text: RETENTION_RETAINED_MESSAGES[script] }];
    }

    // Update retention_check record
    await this.store.query(
      `UPDATE retention_checks SET status = 'retained', checked_at = NOW() WHERE id = $1`,
      [checkRecord.id]
    );

    // Log event
    await this.store.query(
      `INSERT INTO events (learner_id, event_type, source, metadata)
       VALUES ($1, $2, 'bot', $3)`,
      [
        session.learnerId,
        EventTypes.RETENTION_RETAINED,
        JSON.stringify({ check_day: checkRecord.check_day, placement_id: placementId })
      ]
    );

    this._log('info', { learnerId: session.learnerId, checkDay: checkRecord.check_day }, 'Retention check: retained');

    // If 90-day check — ask about salary changes
    if (checkRecord.check_day === 90) {
      session.context = session.context || {};
      session.context.awaitingSalaryUpdate = true;
      session.context.retentionCheckId = checkRecord.id;
      // Keep step as RETENTION_CHECK so the next response routes here
      return [
        { text: RETENTION_RETAINED_MESSAGES[script] },
        { text: RETENTION_90_DAY_SALARY_MESSAGES[script] }
      ];
    }

    // Non-90-day: return to PLACED step
    session.step = Steps.PLACED;
    return [{ text: RETENTION_RETAINED_MESSAGES[script] }];
  }

  /**
   * Handle a 'left' classification. Log event, update placement, cancel remaining checks,
   * and reset session to job matching.
   */
  async _handleLeft(session, script) {
    const placementId = await this._getPlacementId(session.learnerId);

    // Find the active retention check
    const checkRecord = await this.store.queryOne(
      `SELECT id, check_day FROM retention_checks
       WHERE placement_id = $1 AND learner_id = $2 AND status = 'sent'
         AND check_day IN (30, 60, 90)
       ORDER BY check_day ASC LIMIT 1`,
      [placementId, session.learnerId]
    );

    if (checkRecord) {
      // Update the current check to 'left'
      await this.store.query(
        `UPDATE retention_checks SET status = 'left', checked_at = NOW() WHERE id = $1`,
        [checkRecord.id]
      );
    }

    // Update placement: retention_status = 'left', left_at = NOW(), compute tenure_days
    await this.store.query(
      `UPDATE placements
       SET retention_status = 'left',
           left_at = NOW(),
           tenure_days = EXTRACT(DAY FROM NOW() - placement_date)::integer
       WHERE id = $1`,
      [placementId]
    );

    // Cancel all remaining pending retention checks for this placement
    await this.store.query(
      `UPDATE retention_checks SET status = 'no_response', notes = 'cancelled - learner left job'
       WHERE placement_id = $1 AND status = 'pending'`,
      [placementId]
    );

    // Log RETENTION_LEFT event
    await this.store.query(
      `INSERT INTO events (learner_id, event_type, source, metadata)
       VALUES ($1, $2, 'bot', $3)`,
      [
        session.learnerId,
        EventTypes.RETENTION_LEFT,
        JSON.stringify({
          check_day: checkRecord?.check_day ?? null,
          placement_id: placementId
        })
      ]
    );

    // Reset session to JOBS_SHOWN so learner receives new job recommendations
    session.step = Steps.JOBS_SHOWN;

    this._log('info', { learnerId: session.learnerId, placementId }, 'Retention check: left, session reset to job matching');

    return [{ text: RETENTION_LEFT_MESSAGES[script] }];
  }

  /**
   * Handle unclear response after retry (RETENTION_RETRY step).
   * Store as no_response with notes.
   */
  async _handleUnclearAfterRetry(session, text) {
    const script = session.script || 'roman';
    const placementId = await this._getPlacementId(session.learnerId);

    const checkRecord = await this.store.queryOne(
      `SELECT id, check_day FROM retention_checks
       WHERE placement_id = $1 AND learner_id = $2 AND status = 'sent'
         AND check_day IN (30, 60, 90)
       ORDER BY check_day ASC LIMIT 1`,
      [placementId, session.learnerId]
    );

    if (checkRecord) {
      await this.store.query(
        `UPDATE retention_checks SET status = 'no_response', notes = $1, checked_at = NOW() WHERE id = $2`,
        [`unclear_response: ${text}`, checkRecord.id]
      );
    }

    // Log event
    await this.store.query(
      `INSERT INTO events (learner_id, event_type, source, metadata)
       VALUES ($1, $2, 'bot', $3)`,
      [
        session.learnerId,
        EventTypes.RETENTION_NO_RESPONSE,
        JSON.stringify({
          check_day: checkRecord?.check_day ?? null,
          placement_id: placementId,
          reason: 'unclear_after_retry',
          raw_text: text
        })
      ]
    );

    session.step = Steps.PLACED;

    this._log('info', { learnerId: session.learnerId }, 'Retention check: unclear after retry, marked no_response');

    return [{ text: SALARY_REVIEW_MESSAGE }];
  }

  /**
   * Handle the 90-day salary update sub-flow.
   * The learner has been asked about salary changes after being retained for 90 days.
   */
  async _handle90DaySalaryUpdate(session, text) {
    const script = session.script || 'roman';

    // Clear the flag
    session.context.awaitingSalaryUpdate = false;

    // Check if learner says "same" or equivalent
    const normalizedText = text.toLowerCase().trim();
    if (['same', 'nahi', 'no', 'nahi badli', 'same hai', 'wahi hai'].some(k => normalizedText.includes(k))) {
      session.step = Steps.PLACED;
      return [{ text: RETENTION_RETAINED_MESSAGES[script] }];
    }

    // Try to extract salary
    const extractedSalary = await this._extractSalaryViaLLM(text);

    if (extractedSalary !== null) {
      if (extractedSalary >= SALARY_MIN && extractedSalary <= SALARY_MAX) {
        const placementId = await this._getPlacementId(session.learnerId);

        // Update current_salary on placement
        await this.store.query(
          `UPDATE placements SET current_salary = $1 WHERE id = $2`,
          [extractedSalary, placementId]
        );

        // Update retention_check salary_reported
        if (session.context.retentionCheckId) {
          await this.store.query(
            `UPDATE retention_checks SET salary_reported = $1 WHERE id = $2`,
            [extractedSalary, session.context.retentionCheckId]
          );
        }

        // Log event
        await this.store.query(
          `INSERT INTO events (learner_id, event_type, source, metadata)
           VALUES ($1, $2, 'bot', $3)`,
          [
            session.learnerId,
            EventTypes.SALARY_CAPTURED,
            JSON.stringify({ salary: extractedSalary, placement_id: placementId, check_day: 90, type: '90_day_update' })
          ]
        );

        session.step = Steps.PLACED;
        session.context.retentionCheckId = null;

        this._log('info', { learnerId: session.learnerId, salary: extractedSalary }, '90-day salary update captured');

        return [{ text: SALARY_SUCCESS_MESSAGE }];
      }

      // Out of range
      session.step = Steps.PLACED;
      session.context.retentionCheckId = null;
      return [{ text: SALARY_OUT_OF_RANGE_MESSAGE }];
    }

    // Could not extract — just accept and move on (non-blocking)
    session.step = Steps.PLACED;
    session.context.retentionCheckId = null;
    return [{ text: RETENTION_RETAINED_MESSAGES[script] }];
  }

  // ─── Internal: Retention Due Check Sender ─────────────────────────────────

  /**
   * Check for due retention checks (30, 60, 90 day) and send WhatsApp messages.
   * A retention check is due when:
   *   - check_day IN (30, 60, 90)
   *   - status = 'pending'
   *   - placement_date + check_day days <= NOW()
   */
  async _checkDueRetentionChecks() {
    try {
      const dueChecks = await this.store.query(
        `SELECT rc.id, rc.learner_id, rc.placement_id, rc.check_day, l.phone,
                s.data->>'script' AS script
         FROM retention_checks rc
         JOIN placements p ON p.id = rc.placement_id
         JOIN learners l ON l.id = rc.learner_id
         LEFT JOIN sessions s ON s.learner_id = rc.learner_id
           AND s.id = (SELECT id FROM sessions WHERE learner_id = rc.learner_id ORDER BY updated_at DESC LIMIT 1)
         WHERE rc.check_day IN (30, 60, 90)
           AND rc.status = 'pending'
           AND (p.placement_date + (rc.check_day || ' days')::INTERVAL) <= NOW()`,
        []
      );

      if (dueChecks.length > 0) {
        this._log('info', { count: dueChecks.length }, 'Found due retention checks');
      }

      for (const check of dueChecks) {
        await this._sendRetentionCheck(check);
      }
    } catch (error) {
      this._log('error', { err: error.message }, 'Error checking due retention checks');
    }
  }

  /**
   * Send retention check message to a learner and update the check record.
   */
  async _sendRetentionCheck(check) {
    try {
      const script = check.script || 'roman';
      const message = RETENTION_CHECK_MESSAGES[script] || RETENTION_CHECK_MESSAGES.roman;

      await this.sendMessage(check.learner_id, message);

      await this.store.query(
        `UPDATE retention_checks SET status = 'sent', checked_at = NOW() WHERE id = $1`,
        [check.id]
      );

      // Update session step to RETENTION_CHECK
      await this.store.query(
        `UPDATE sessions
         SET step = 'RETENTION_CHECK',
             data = jsonb_set(
               jsonb_set(COALESCE(data, '{}'::jsonb), '{retentionCheckId}', to_jsonb($2::text)),
               '{step}', to_jsonb($3::int)
             ),
             updated_at = NOW()
         WHERE learner_id = $1
           AND id = (SELECT id FROM sessions WHERE learner_id = $1 ORDER BY updated_at DESC LIMIT 1)`,
        [check.learner_id, check.id, Steps.RETENTION_CHECK]
      );

      this._log('info', { learnerId: check.learner_id, checkDay: check.check_day }, 'Sent retention check message');
    } catch (error) {
      this._log('error', { learnerId: check.learner_id, err: error.message }, 'Failed to send retention check');
    }
  }

  /**
   * Send a retention check reminder (48h after initial check with no response).
   */
  async _sendRetentionReminder(check) {
    try {
      const script = check.script || 'roman';
      const message = RETENTION_REMINDER_MESSAGES[script] || RETENTION_REMINDER_MESSAGES.roman;

      await this.sendMessage(check.learner_id, message);

      // Mark that a reminder was sent via notes
      await this.store.query(
        `UPDATE retention_checks SET notes = COALESCE(notes, '') || 'reminder_sent:' || NOW()::text WHERE id = $1`,
        [check.id]
      );

      this._log('info', { learnerId: check.learner_id, checkDay: check.check_day }, 'Sent retention check reminder');
    } catch (error) {
      this._log('error', { learnerId: check.learner_id, err: error.message }, 'Failed to send retention reminder');
    }
  }

  /**
   * Mark a retention check as no_response after final timeout (48h + 24h).
   */
  async _markRetentionNoResponse(check) {
    try {
      await this.store.query(
        `UPDATE retention_checks SET status = 'no_response', notes = COALESCE(notes, '') || ' | final_timeout' WHERE id = $1`,
        [check.id]
      );

      // Log RETENTION_NO_RESPONSE event
      await this.store.query(
        `INSERT INTO events (learner_id, event_type, source, metadata)
         VALUES ($1, $2, 'bot', $3)`,
        [
          check.learner_id,
          EventTypes.RETENTION_NO_RESPONSE,
          JSON.stringify({ check_day: check.check_day, placement_id: check.placement_id, reason: 'timeout_72h' })
        ]
      );

      // Reset session step back to PLACED
      await this.store.query(
        `UPDATE sessions
         SET step = 'PLACED',
             data = jsonb_set(COALESCE(data, '{}'::jsonb), '{step}', to_jsonb($2::int)),
             updated_at = NOW()
         WHERE learner_id = $1
           AND id = (SELECT id FROM sessions WHERE learner_id = $1 ORDER BY updated_at DESC LIMIT 1)`,
        [check.learner_id, Steps.PLACED]
      );

      this._log('info', { learnerId: check.learner_id, checkDay: check.check_day }, 'Retention check timed out, marked no_response');
    } catch (error) {
      this._log('error', { learnerId: check.learner_id, err: error.message }, 'Failed to mark retention no_response');
    }
  }

  // ─── Internal: Due Nudge Processing ──────────────────────────────────────

  /**
   * Single polling cycle that checks both salary nudges and retention checks.
   */
  async _pollCycle() {
    await this._bootstrapMissingChecks();
    await this._checkDueNudges();
    await this._checkDueRetentionChecks();
    await this.checkSalaryTimeouts();
    await this.checkRetentionTimeouts();
  }

  /**
   * Resilience: placements created outside the bot (e.g. by the backend when an
   * employer marks a match 'hired') may have no retention_checks rows if the
   * schedule-retention ping was missed. Find any such placement that has not
   * already left and schedule its salary capture + retention checks.
   */
  async _bootstrapMissingChecks() {
    try {
      const orphans = await this.store.query(
        `SELECT p.id, p.learner_id, p.placement_date
         FROM placements p
         WHERE COALESCE(p.retention_status::text, 'unknown') <> 'left'
           AND NOT EXISTS (
             SELECT 1 FROM retention_checks rc WHERE rc.placement_id = p.id
           )
         LIMIT 100`
      );

      for (const p of orphans ?? []) {
        try {
          const placementDate = p.placement_date ?? new Date().toISOString();
          await this.scheduleSalaryCapture(p.learner_id, placementDate);
          await this.scheduleRetentionChecks(p.learner_id, placementDate);
          this._log('info', { learnerId: p.learner_id, placementId: p.id }, 'Bootstrapped retention checks for untracked placement');
        } catch (err) {
          this._log('error', { placementId: p.id, err: err.message }, 'Failed to bootstrap retention checks');
        }
      }
    } catch (error) {
      this._log('error', { err: error.message }, 'Error bootstrapping missing retention checks');
    }
  }

  /**
   * Check for due salary nudges and send WhatsApp messages.
   * A nudge is due when:
   *   - check_day = 7
   *   - status = 'pending'
   *   - placement_date + 7 days <= NOW()
   */
  async _checkDueNudges() {
    try {
      const dueNudges = await this.store.query(
        `SELECT rc.id, rc.learner_id, rc.placement_id, l.phone
         FROM retention_checks rc
         JOIN placements p ON p.id = rc.placement_id
         JOIN learners l ON l.id = rc.learner_id
         WHERE rc.check_day = $1
           AND rc.status = 'pending'
           AND (p.placement_date + INTERVAL '7 days') <= NOW()`,
        [SALARY_NUDGE_DAY]
      );

      if (dueNudges.length > 0) {
        this._log('info', { count: dueNudges.length }, 'Found due salary nudges');
      }

      for (const nudge of dueNudges) {
        await this._sendSalaryNudge(nudge);
      }
    } catch (error) {
      this._log('error', { err: error.message }, 'Error checking due salary nudges');
    }
  }

  /**
   * Send salary nudge message to a learner and update the check record.
   * Updates status to 'sent' and records checked_at timestamp.
   */
  async _sendSalaryNudge(nudge) {
    try {
      await this.sendMessage(nudge.learner_id, SALARY_NUDGE_MESSAGE);

      await this.store.query(
        `UPDATE retention_checks
         SET status = 'sent', checked_at = NOW()
         WHERE id = $1`,
        [nudge.id]
      );

      // Update the learner's session step to SALARY_CAPTURE so the response handler knows context
      await this.store.query(
        `UPDATE sessions
         SET step = 'SALARY_CAPTURE',
             data = jsonb_set(COALESCE(data, '{}'::jsonb), '{salaryCaptureCheckId}', to_jsonb($2::text)),
             updated_at = NOW()
         WHERE learner_id = $1
           AND id = (SELECT id FROM sessions WHERE learner_id = $1 ORDER BY updated_at DESC LIMIT 1)`,
        [nudge.learner_id, nudge.id]
      );

      this._log('info', { learnerId: nudge.learner_id }, 'Sent salary capture nudge');
    } catch (error) {
      this._log('error', { learnerId: nudge.learner_id, err: error.message }, 'Failed to send salary nudge');
    }
  }

  // ─── Internal Helpers ────────────────────────────────────────────────────

  /**
   * Get the most recent placement ID for a learner.
   * @throws {Error} if no placement exists for the learner
   */
  async _getPlacementId(learnerId) {
    const placement = await this.store.queryOne(
      `SELECT id FROM placements WHERE learner_id = $1 ORDER BY placement_date DESC LIMIT 1`,
      [learnerId]
    );

    if (!placement) {
      throw new Error(`No placement found for learner ${learnerId}`);
    }

    return placement.id;
  }

  /**
   * Internal logging helper. Uses pino structured logging when available.
   */
  _log(level, meta, message) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](meta, message);
    } else if (level === 'error') {
      console.error('[PlacementTrackerService]', message, meta);
    }
  }
}
