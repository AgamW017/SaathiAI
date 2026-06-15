import pg from 'pg';
import { StepNames } from '../constants/steps.js';

const { Pool } = pg;

export class SupabaseStore {
  constructor({ supabase, publicBaseUrl }) {
    if (!supabase.databaseUrl) {
      throw new Error('DATABASE_URL is required for direct Postgres connection');
    }

    this.pool = new Pool({
      connectionString: supabase.databaseUrl,
      ssl: { rejectUnauthorized: false }
    });
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '');
  }

  async init() {
    await this.assertConnection();
  }

  async assertConnection() {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1 FROM learners LIMIT 1');
    } finally {
      client.release();
    }
  }

  async query(sql, params = []) {
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async queryOne(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows[0] ?? null;
  }

  // ─── Sessions ────────────────────────────────────────────────────────────

  async getSession(phone) {
    const learner = await this.getLearnerByPhone(phone);
    if (!learner?.id) return null;

    const row = await this.queryOne(
      `SELECT * FROM sessions WHERE learner_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [learner.id]
    );

    if (!row?.data) return null;

    return {
      ...row.data,
      learnerId: learner.id,
      phone,
      step: row.data.step ?? numberFromStepText(row.step),
      collected: {
        ...row.data.collected,
        name: row.data.collected?.name ?? learner.name,
        trade: row.data.collected?.trade ?? learner.trade,
        district: row.data.collected?.district ?? learner.district,
        state: row.data.collected?.state ?? learner.state
      },
      cardUrl: row.data.cardUrl ?? learner.cardUrl ?? null,
      context: row.data.context ?? {},
      lastProcessedMessageIds: row.data.lastProcessedMessageIds ?? []
    };
  }

  async saveSession(session) {
    const learner = await this.ensureLearner(session.phone, {
      full_name: session.collected?.name,
      trade: session.collected?.trade,
      district: session.collected?.district,
      state: session.collected?.state,
      status: learnerStatusFromPlacement(session.placementStatus)
    });

    const payload = {
      learner_id: learner.id,
      step: StepNames[session.step] ?? String(session.step),
      data: sessionSnapshot(session, learner.id)
    };

    const existing = await this.getLatestSessionRow(learner.id);

    let row;
    if (existing) {
      row = await this.queryOne(
        `UPDATE sessions SET step=$1, data=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
        [payload.step, JSON.stringify(payload.data), existing.id]
      );
    } else {
      row = await this.queryOne(
        `INSERT INTO sessions (learner_id, step, data) VALUES ($1,$2,$3) RETURNING *`,
        [payload.learner_id, payload.step, JSON.stringify(payload.data)]
      );
    }

    if (!row) throw new Error('Failed to save session: no row returned');

    return {
      ...session,
      learnerId: learner.id,
      updatedAt: row.updated_at
    };
  }

  // ─── Learners ─────────────────────────────────────────────────────────────

  async getLearnerByPhone(phone) {
    const row = await this.queryOne(
      `SELECT * FROM learners WHERE phone=$1`,
      [phone]
    );
    if (!row) return null;

    const latestCard = await this.getLatestSkillCardByLearnerId(row.id);
    return mapLearnerRow(row, latestCard, this.publicBaseUrl);
  }

  async upsertLearner(phone, patch = {}) {
    const set = learnerPatchToRow(phone, patch);

    const row = await this.queryOne(
      `INSERT INTO learners (phone, full_name, trade, district, state, status, risk_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (phone) DO UPDATE SET
         full_name  = COALESCE(EXCLUDED.full_name, learners.full_name),
         trade      = COALESCE(EXCLUDED.trade, learners.trade),
         district   = COALESCE(EXCLUDED.district, learners.district),
         state      = COALESCE(EXCLUDED.state, learners.state),
         status     = COALESCE(EXCLUDED.status, learners.status),
         risk_score = COALESCE(EXCLUDED.risk_score, learners.risk_score),
         updated_at = NOW()
       RETURNING *`,
      [
        phone,
        set.full_name ?? null,
        set.trade ?? null,
        set.district ?? null,
        set.state ?? null,
        set.status ?? 'active',
        set.risk_score ?? 0
      ]
    );

    if (!row) throw new Error('Failed to upsert learner: no row returned');

    const latestCard = await this.getLatestSkillCardByLearnerId(row.id);
    return mapLearnerRow(row, latestCard, this.publicBaseUrl);
  }

  async ensureLearner(phone, patch = {}) {
    return this.upsertLearner(phone, patch);
  }

  async findLearnerId(phone) {
    if (!phone) return null;
    const learner = await this.getLearnerByPhone(phone);
    return learner?.id ?? null;
  }

  // ─── Skill Cards ──────────────────────────────────────────────────────────

  async saveSkillCard(card) {
    const learner = await this.ensureLearner(card.phone, {
      full_name: card.name,
      trade: card.trade,
      district: card.district,
      state: card.state
    });

    const row = await this.queryOne(
      `INSERT INTO skill_cards (id, learner_id, trade, skills, certificate_type, verification_status)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        card.id,
        learner.id,
        card.trade,
        card.skills ?? [],
        card.certificateType ?? null,
        mapVerificationStatus(card.verificationStatus)
      ]
    );

    if (!row) throw new Error('Failed to save skill card: no row returned');
    return mapSkillCardRow(row, learner, this.publicBaseUrl);
  }

  async getLatestSkillCardByPhone(phone) {
    const learner = await this.getLearnerByPhone(phone);
    if (!learner?.id) return null;
    return this.getLatestSkillCardByLearnerId(learner.id);
  }

  async getLatestSkillCardByLearnerId(learnerId) {
    const row = await this.queryOne(
      `SELECT sc.*, row_to_json(l) AS learner_json
       FROM skill_cards sc
       JOIN learners l ON l.id = sc.learner_id
       WHERE sc.learner_id=$1
       ORDER BY sc.created_at DESC LIMIT 1`,
      [learnerId]
    );
    if (!row) return null;
    return mapSkillCardRow(row, row.learner_json, this.publicBaseUrl);
  }

  async getSkillCardById(id) {
    const row = await this.queryOne(
      `SELECT sc.*, row_to_json(l) AS learner_json
       FROM skill_cards sc
       JOIN learners l ON l.id = sc.learner_id
       WHERE sc.id=$1`,
      [id]
    );
    if (!row) return null;
    return mapSkillCardRow(row, row.learner_json, this.publicBaseUrl);
  }

  // ─── Jobs ─────────────────────────────────────────────────────────────────

  async listJobs() {
    const rows = await this.query(
      `SELECT * FROM jobs WHERE is_active=true ORDER BY created_at DESC`
    );
    return rows.map(mapJobRow);
  }

  // ─── Applications ─────────────────────────────────────────────────────────

  async saveApplication(application) {
    const learner = await this.ensureLearner(application.phone);
    const row = await this.queryOne(
      `INSERT INTO applications (learner_id, job_id, status, notes)
       VALUES ($1,$2,'applied',$3)
       ON CONFLICT (learner_id, job_id) DO UPDATE SET status='applied', updated_at=NOW()
       RETURNING *`,
      [
        learner.id,
        application.jobId,
        application.cardUrl ? `Skill Card: ${application.cardUrl}` : null
      ]
    );
    if (!row) throw new Error('Failed to save application: no row returned');
    return row;
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  async appendEvent(event) {
    const learnerId =
      event.learnerId && isUuid(event.learnerId)
        ? event.learnerId
        : await this.findLearnerId(event.phone);

    const row = await this.queryOne(
      `INSERT INTO events (learner_id, event_type, source, metadata)
       VALUES ($1,$2,'bot',$3)
       RETURNING *`,
      [
        learnerId,
        event.eventType,
        JSON.stringify({
          ...event.metadata,
          phone: event.phone,
          step_before: event.stepBefore,
          step_after: event.stepAfter,
          local_event_id: event.id,
          timestamp: event.timestamp
        })
      ]
    );
    if (!row) throw new Error('Failed to append event: no row returned');
    return row;
  }

  async recentEvents(limit = 50) {
    return this.query(
      `SELECT * FROM events ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  async getLatestSessionRow(learnerId) {
    return this.queryOne(
      `SELECT id FROM sessions WHERE learner_id=$1 ORDER BY updated_at DESC LIMIT 1`,
      [learnerId]
    );
  }
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function learnerPatchToRow(phone, patch = {}) {
  return {
    phone,
    full_name: patch.full_name ?? patch.name ?? null,
    trade: patch.trade ?? null,
    district: patch.district ?? null,
    state: patch.state ?? null,
    status: patch.status ?? learnerStatusFromPlacement(patch.placementStatus) ?? null,
    risk_score: patch.riskScore ?? null
  };
}

function sessionSnapshot(session, learnerId) {
  return {
    phone: session.phone,
    learnerId,
    step: session.step,
    script: session.script,
    placementStatus: session.placementStatus,
    collected: session.collected ?? {},
    cardUrl: session.cardUrl ?? null,
    selectedJob: session.selectedJob
      ? {
        id: session.selectedJob.id,
        employerName: session.selectedJob.employerName,
        role: session.selectedJob.role
      }
      : null,
    latestJobIds: (session.latestJobs ?? []).map((job) => job.id),
    aiFlags: session.context?.aiFlags ?? [],
    updatedAt: new Date().toISOString()
  };
}

function mapLearnerRow(row, latestCard, publicBaseUrl) {
  return {
    id: row.id,
    phone: row.phone,
    name: row.full_name,
    fullName: row.full_name,
    trade: row.trade,
    district: row.district,
    state: row.state,
    status: row.status,
    placementStatus: placementFromLearnerStatus(row.status),
    cardUrl: latestCard?.url ?? null,
    skillCardId: latestCard?.id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publicBaseUrl
  };
}

function mapSkillCardRow(row, learner, publicBaseUrl) {
  const l = learner ?? {};
  return {
    id: row.id,
    phone: l.phone,
    learnerId: row.learner_id,
    url: `${publicBaseUrl}/card/${row.id}`,
    name: l.full_name ?? l.name,
    trade: row.trade,
    district: l.district,
    state: l.state,
    certificateType: row.certificate_type,
    skills: row.skills ?? [],
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapJobRow(row) {
  const salary = parseSalaryRange(row.salary_range);
  return {
    id: row.id,
    trade: row.trade,
    employerName: row.company,
    role: row.title,
    location: row.location ?? 'Location to be confirmed',
    district: inferDistrictFromLocation(row.location),
    distanceKm: null,
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryRangeText: row.salary_range,
    openings: null,
    postedText: row.created_at
      ? `Posted ${new Date(row.created_at).toLocaleDateString('en-IN')}`
      : 'Posted recently',
    type: 'job',
    verified: true,
    detail: row.description,
    requirements: row.requirements
  };
}

function parseSalaryRange(value = '') {
  const numbers =
    value.match(/\d[\d,]*/g)?.map((item) => Number(item.replaceAll(',', ''))) ?? [];
  return {
    min: numbers[0] ?? null,
    max: numbers.at(-1) ?? numbers[0] ?? null
  };
}

function inferDistrictFromLocation(location = '') {
  return (
    location
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .at(-1) ?? null
  );
}

function learnerStatusFromPlacement(status) {
  if (status === 'PLACED') return 'placed';
  if (status === 'AT_RISK') return 'at_risk';
  return status ? 'active' : undefined;
}

function placementFromLearnerStatus(status) {
  if (status === 'placed') return 'PLACED';
  if (status === 'at_risk') return 'AT_RISK';
  return 'ONBOARDING';
}

function mapVerificationStatus(status) {
  if (['pending', 'verified', 'rejected'].includes(status)) return status;
  return 'pending';
}

function numberFromStepText(stepText) {
  const entry = Object.entries(StepNames).find(([, name]) => name === stepText);
  return entry ? Number(entry[0]) : 0;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
