// OpportunityAlertService — feature 1.2.4 Proactive Opportunity Alerts.
//
// Periodically nudges ACTIVE learners on WhatsApp when a NEW active vacancy
// appears that matches their trade + district. Rate-limited to at most one
// alert per learner per 24h, and only when there is at least one fresh match.
// DB-only matching (no SIDH calls) to keep the loop cheap.

const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const MIN_HOURS_BETWEEN_ALERTS = 24;
const MAX_LEARNERS_PER_CYCLE = 200;
const ALERT_EVENT = 'OPPORTUNITY_ALERT';

export class OpportunityAlertService {
  /**
   * @param {object} params
   * @param {object} params.store - SupabaseStore (query/queryOne)
   * @param {object} params.jobService - unused for matching here, kept for parity
   * @param {function} params.sendMessage - (learnerId, text) => Promise<void>
   * @param {object} [params.logger]
   */
  constructor({ store, jobService, sendMessage, logger = null }) {
    this.store = store;
    this.jobService = jobService;
    this.sendMessage = sendMessage;
    this.logger = logger;
    this._timer = null;
  }

  startPolling() {
    if (this._timer) return;
    this._log('info', {}, 'Starting opportunity alert loop (every 6h)');
    this._timer = setInterval(() => this._cycle(), POLL_INTERVAL_MS);
    // Defer the first run a bit so it doesn't fire during startup churn.
    setTimeout(() => this._cycle(), 60 * 1000);
  }

  stopPolling() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async _cycle() {
    try {
      const learners = await this.store.query(
        `SELECT id, full_name, trade, district
         FROM learners
         WHERE status = 'active' AND trade IS NOT NULL AND trade <> ''
         LIMIT $1`,
        [MAX_LEARNERS_PER_CYCLE]
      );

      let alerted = 0;
      for (const learner of learners ?? []) {
        try {
          if (await this._sendAlertIfDue(learner)) alerted += 1;
        } catch (err) {
          this._log('error', { learnerId: learner.id, err: err.message }, 'Opportunity alert failed for learner');
        }
      }
      if (alerted > 0) this._log('info', { alerted }, 'Sent proactive opportunity alerts');
    } catch (error) {
      this._log('error', { err: error.message }, 'Opportunity alert cycle failed');
    }
  }

  async _sendAlertIfDue(learner) {
    // Last alert time (rate limit) from the events table.
    const last = await this.store.queryOne(
      `SELECT created_at FROM events
       WHERE learner_id = $1 AND event_type = $2
       ORDER BY created_at DESC LIMIT 1`,
      [learner.id, ALERT_EVENT]
    );

    if (last?.created_at) {
      const hours = (Date.now() - new Date(last.created_at).getTime()) / 36e5;
      if (hours < MIN_HOURS_BETWEEN_ALERTS) return false;
    }

    // Only vacancies created since the last alert (or last 24h on first run).
    const sinceIso = last?.created_at
      ? new Date(last.created_at).toISOString()
      : new Date(Date.now() - MIN_HOURS_BETWEEN_ALERTS * 36e5).toISOString();

    // Fuzzy trade match on first token; district match when known.
    const tradeToken = String(learner.trade).split(',')[0].trim();
    const matches = await this.store.query(
      `SELECT v.title, e.company_name, v.district
       FROM vacancies v
       LEFT JOIN employers e ON e.id = v.employer_id
       WHERE v.status = 'active'
         AND v.created_at >= $1
         AND v.trade_required ILIKE '%' || $2 || '%'
         AND ($3 = '' OR v.district IS NULL OR v.district ILIKE '%' || $3 || '%')
       ORDER BY v.created_at DESC
       LIMIT 3`,
      [sinceIso, tradeToken, learner.district ?? '']
    );

    if (!matches || matches.length === 0) return false;

    const top = matches[0];
    const company = top.company_name ?? 'an employer';
    const where = top.district ? ` in ${top.district}` : '';
    const extra = matches.length > 1 ? ` (+${matches.length - 1} more)` : '';
    const msg =
      `🔔 Namaste${learner.full_name ? ' ' + learner.full_name : ''}! Aapke liye nayi job hai: ` +
      `*${top.title}* at ${company}${where}${extra}. Reply *JOBS* to see all matches.`;

    await this.sendMessage(learner.id, msg);

    await this.store.query(
      `INSERT INTO events (learner_id, event_type, source, metadata)
       VALUES ($1, $2, 'bot', $3)`,
      [learner.id, ALERT_EVENT, JSON.stringify({ count: matches.length, title: top.title })]
    );

    return true;
  }

  _log(level, meta, msg) {
    if (this.logger?.[level]) this.logger[level](meta, msg);
  }
}
