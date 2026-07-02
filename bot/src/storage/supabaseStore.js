import pg from 'pg';
import { StepNames } from '../constants/steps.js';

const { Pool } = pg;

export class SupabaseStore {
  constructor({ supabase, publicBaseUrl, frontendUrl }) {
    if (!supabase.databaseUrl) {
      throw new Error('DATABASE_URL is required for direct Postgres connection');
    }

    this.pool = new Pool({
      connectionString: supabase.databaseUrl,
      ssl: { rejectUnauthorized: false }
    });
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '');
    this.frontendUrl = (frontendUrl || publicBaseUrl).replace(/\/$/, '');
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
      language: row.data.language ?? learner.language ?? null,
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
      `INSERT INTO learners (phone, full_name, trade, district, state, status, risk_score, language)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (phone) DO UPDATE SET
         full_name  = COALESCE(EXCLUDED.full_name, learners.full_name),
         trade      = COALESCE(EXCLUDED.trade, learners.trade),
         district   = COALESCE(EXCLUDED.district, learners.district),
         state      = COALESCE(EXCLUDED.state, learners.state),
         status     = COALESCE(EXCLUDED.status, learners.status),
         risk_score = COALESCE(EXCLUDED.risk_score, learners.risk_score),
         language   = COALESCE(EXCLUDED.language, learners.language),
         updated_at = NOW()
       RETURNING *`,
      [
        phone,
        set.full_name ?? null,
        set.trade ?? null,
        set.district ?? null,
        set.state ?? null,
        set.status ?? 'active',
        set.risk_score ?? 0,
        set.language ?? null
      ]
    );

    if (!row) throw new Error('Failed to upsert learner: no row returned');

    const latestCard = await this.getLatestSkillCardByLearnerId(row.id);
    return mapLearnerRow(row, latestCard, this.publicBaseUrl);
  }

  async ensureLearner(phone, patch = {}) {
    return this.upsertLearner(phone, patch);
  }

  async savePlacementDetails(phone, details = {}) {
    const row = await this.queryOne(
      `UPDATE learners
       SET placement_company     = COALESCE($1, placement_company),
           placement_role        = COALESCE($2, placement_role),
           placement_salary      = COALESCE($3, placement_salary),
           placement_location    = COALESCE($4, placement_location),
           placement_date        = COALESCE($5, placement_date),
           placement_reported_at = NOW(),
           status                = 'placed',
           updated_at            = NOW()
       WHERE phone = $6
       RETURNING *`,
      [
        details.company ?? null,
        details.role ?? null,
        details.salary ?? null,
        details.location ?? null,
        details.joiningDate ?? null,
        phone
      ]
    );
    if (!row) throw new Error(`savePlacementDetails: no learner found for phone ${phone}`);
    return row;
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
      // Pull certificate_url from the learners row so we inherit any already-uploaded certificate.
      // (Certificate upload happens before skill card creation in the onboarding flow.)
      `INSERT INTO skill_cards (id, learner_id, trade, skills, certificate_type, certificate_url, verification_status)
       SELECT $1, $2, $3, $4::jsonb, $5,
              (SELECT certificate_url FROM learners WHERE id = $2),
              $6
       RETURNING *`,
      [
        card.id,
        learner.id,
        card.trade,
        JSON.stringify(card.skills ?? []),
        card.certificateType ?? null,
        mapVerificationStatus(card.verificationStatus)
      ]
    );

    if (!row) throw new Error('Failed to save skill card: no row returned');
    return mapSkillCardRow(row, learner, this.frontendUrl);
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
    return mapSkillCardRow(row, row.learner_json, this.frontendUrl);
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
    return mapSkillCardRow(row, row.learner_json, this.frontendUrl);
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

    // Check if this job_id is a vacancy (from employer portal) vs old jobs table
    const jobExists = await this.queryOne(
      `SELECT id FROM jobs WHERE id = $1`,
      [application.jobId]
    );

    if (jobExists) {
      // Old jobs table — use applications table
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

    // Vacancy from employer portal — use matches table
    // Find the employer_id for this vacancy
    const vacancy = await this.queryOne(
      `SELECT employer_id FROM vacancies WHERE id = $1`,
      [application.jobId]
    );

    if (!vacancy) throw new Error(`Job/vacancy ${application.jobId} not found in either table`);

    const row = await this.queryOne(
      `INSERT INTO matches (vacancy_id, learner_id, employer_id, stage, timeline)
       VALUES ($1, $2, $3, 'interest_expressed', $4)
       ON CONFLICT (vacancy_id, learner_id) DO UPDATE SET stage='interest_expressed', updated_at=NOW()
       RETURNING *`,
      [
        application.jobId,
        learner.id,
        vacancy.employer_id,
        JSON.stringify([{ stage: 'interest_expressed', timestamp: new Date().toISOString(), actor: 'learner', note: 'Learner expressed interest via WhatsApp' }])
      ]
    );
    if (!row) throw new Error('Failed to save vacancy application: no row returned');
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

  // ─── KYC ──────────────────────────────────────────────────────────────────

  /**
   * Persist Aadhaar KYC data to the learners table after a successful OTP verify.
   *
   * @param {string} phone - Learner phone number
   * @param {object} kycData
   * @param {string} kycData.aadhaarNumber
   * @param {string} kycData.dob - YYYY-MM-DD
   * @param {string} kycData.gender
   * @param {object} kycData.address - { line, district, state, pincode }
   * @param {string|null} kycData.aadhaarPhotoUrl - Supabase Storage URL
   * @param {string} kycData.aadhaarName - Name from Aadhaar card
   * @param {string|null} kycData.currentName - Name already on record (for reconciliation)
   */
  async saveKycData(phone, kycData) {
    const {
      aadhaarNumber,
      dob,
      gender,
      address = {},
      aadhaarPhotoUrl = null,
      aadhaarName,
      currentName
    } = kycData;

    // Reconcile names per spec: pick the longer of the two if they match well enough
    const resolvedName = reconcileNames(currentName, aadhaarName);

    const row = await this.queryOne(
      `UPDATE learners
       SET aadhaar_number   = $1,
           dob              = $2,
           gender           = $3,
           address_line     = $4,
           address_district = $5,
           address_state    = $6,
           address_pincode  = $7,
           kyc_status       = 'verified',
           aadhaar_photo_url = $8,
           full_name        = COALESCE($9, full_name),
           updated_at       = NOW()
       WHERE phone = $10
       RETURNING *`,
      [
        aadhaarNumber,
        dob || null,
        gender || null,
        address.line || null,
        address.district || null,
        address.state || null,
        address.pincode || null,
        aadhaarPhotoUrl,
        resolvedName,
        phone
      ]
    );

    if (!row) throw new Error(`saveKycData: no learner found for phone ${phone}`);
    return row;
  }

  /**
   * Persist the certificate URL to both learners and skill_cards tables.
   *
   * @param {string} phone - Learner phone number
   * @param {string} certificateUrl - Public URL of uploaded certificate
   */
  async saveCertificateUrl(phone, certificateUrl) {
    // Update learners table
    await this.query(
      `UPDATE learners SET certificate_url = $1, updated_at = NOW() WHERE phone = $2`,
      [certificateUrl, phone]
    );

    // Update the most recent skill_card row (if any)
    await this.query(
      `UPDATE skill_cards
       SET certificate_url = $1, updated_at = NOW()
       WHERE learner_id = (SELECT id FROM learners WHERE phone = $2)
         AND created_at = (
           SELECT MAX(created_at) FROM skill_cards
           WHERE learner_id = (SELECT id FROM learners WHERE phone = $2)
         )`,
      [certificateUrl, phone]
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
    risk_score: patch.riskScore ?? null,
    language: patch.language ?? null
  };
}

function sessionSnapshot(session, learnerId) {
  return {
    phone: session.phone,
    learnerId,
    step: session.step,
    script: session.script,
    language: session.language ?? null,
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
    language: row.language ?? null,
    placementStatus: placementFromLearnerStatus(row.status),
    cardUrl: latestCard?.url ?? null,
    skillCardId: latestCard?.id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publicBaseUrl
  };
}

function mapSkillCardRow(row, learner, frontendUrl) {
  const l = learner ?? {};
  return {
    id: row.id,
    phone: l.phone,
    learnerId: row.learner_id,
    url: `${frontendUrl}/card/${row.id}`,
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

/**
 * Reconcile a learner's existing name with the name returned by Aadhaar KYC.
 *
 * Rule (per spec): normalise both names to lowercase word sets.
 * If the minimum word count of the two names has n words, and those n words
 * all appear in the other name → names match → return the longer name.
 * Otherwise return null (mismatch — caller should flag for manual review;
 * we don't overwrite the existing name).
 *
 * @param {string|null} currentName - Name already recorded for the learner
 * @param {string|null} aadhaarName - Name from Aadhaar card
 * @returns {string|null}
 */
function reconcileNames(currentName, aadhaarName) {
  if (!aadhaarName) return currentName ?? null;
  if (!currentName) return aadhaarName;

  const normalise = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9ऀ-ॿ\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const wordsA = normalise(currentName);
  const wordsB = normalise(aadhaarName);

  const shorter = wordsA.length <= wordsB.length ? wordsA : wordsB;
  const longerWords = wordsA.length > wordsB.length ? wordsA : wordsB;
  const longer = wordsA.length > wordsB.length ? currentName : aadhaarName;

  const n = shorter.length;
  const allMatch = shorter.every((w) => longerWords.includes(w));

  if (n > 0 && allMatch) {
    return longer; // prefer the more complete name
  }

  // Names don't match well enough — keep existing name, do not overwrite
  return currentName;
}
