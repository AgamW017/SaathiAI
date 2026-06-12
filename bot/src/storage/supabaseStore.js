import { createClient } from '@supabase/supabase-js';
import { StepNames } from '../constants/steps.js';

export class SupabaseStore {
  constructor({ supabase, publicBaseUrl }) {
    if (!supabase.url || !supabase.serviceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
    }

    this.client = createClient(supabase.url, supabase.serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '');
  }

  async init() {
    await this.assertConnection();
  }

  async assertConnection() {
    const { error } = await this.client.from('learners').select('id').limit(1);
    if (error) throw new Error(`Supabase connection failed: ${error.message}`);
  }

  async getSession(phone) {
    const learner = await this.getLearnerByPhone(phone);
    if (!learner?.id) return null;

    const { data, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('learner_id', learner.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to load session: ${error.message}`);
    if (!data?.data) return null;

    return {
      ...data.data,
      learnerId: learner.id,
      phone,
      step: data.data.step ?? numberFromStepText(data.step),
      collected: {
        ...data.data.collected,
        name: data.data.collected?.name ?? learner.name,
        trade: data.data.collected?.trade ?? learner.trade,
        district: data.data.collected?.district ?? learner.district,
        state: data.data.collected?.state ?? learner.state
      },
      cardUrl: data.data.cardUrl ?? learner.cardUrl ?? null,
      context: data.data.context ?? {},
      lastProcessedMessageIds: data.data.lastProcessedMessageIds ?? []
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
    const query = existing
      ? this.client.from('sessions').update(payload).eq('id', existing.id).select().single()
      : this.client.from('sessions').insert(payload).select().single();

    const { data, error } = await query;
    if (error || !data) throw new Error(`Failed to save session: ${error?.message ?? 'no row returned'}`);

    return {
      ...session,
      learnerId: learner.id,
      updatedAt: data.updated_at
    };
  }

  async getLearnerByPhone(phone) {
    const { data, error } = await this.client.from('learners').select('*').eq('phone', phone).maybeSingle();
    if (error) throw new Error(`Failed to load learner: ${error.message}`);
    if (!data) return null;

    const latestCard = await this.getLatestSkillCardByLearnerId(data.id);
    return mapLearnerRow(data, latestCard, this.publicBaseUrl);
  }

  async upsertLearner(phone, patch = {}) {
    const row = learnerPatchToRow(phone, patch);
    const { data, error } = await this.client.from('learners').upsert(row, { onConflict: 'phone' }).select().single();
    if (error || !data) throw new Error(`Failed to upsert learner: ${error?.message ?? 'no row returned'}`);

    const latestCard = await this.getLatestSkillCardByLearnerId(data.id);
    return mapLearnerRow(data, latestCard, this.publicBaseUrl);
  }

  async saveSkillCard(card) {
    const learner = await this.ensureLearner(card.phone, {
      full_name: card.name,
      trade: card.trade,
      district: card.district,
      state: card.state
    });

    const { data, error } = await this.client
      .from('skill_cards')
      .insert({
        id: card.id,
        learner_id: learner.id,
        trade: card.trade,
        skills: card.skills ?? [],
        certificate_type: card.certificateType ?? null,
        verification_status: mapVerificationStatus(card.verificationStatus)
      })
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to save skill card: ${error?.message ?? 'no row returned'}`);
    return mapSkillCardRow(data, learner, this.publicBaseUrl);
  }

  async getLatestSkillCardByPhone(phone) {
    const learner = await this.getLearnerByPhone(phone);
    if (!learner?.id) return null;
    return this.getLatestSkillCardByLearnerId(learner.id);
  }

  async getLatestSkillCardByLearnerId(learnerId) {
    const { data, error } = await this.client
      .from('skill_cards')
      .select('*, learners(*)')
      .eq('learner_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to load skill card: ${error.message}`);
    return data ? mapSkillCardRow(data, data.learners, this.publicBaseUrl) : null;
  }

  async getSkillCardById(id) {
    const { data, error } = await this.client.from('skill_cards').select('*, learners(*)').eq('id', id).maybeSingle();
    if (error) throw new Error(`Failed to load skill card: ${error.message}`);
    return data ? mapSkillCardRow(data, data.learners, this.publicBaseUrl) : null;
  }

  async listJobs() {
    const { data, error } = await this.client
      .from('jobs')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list jobs: ${error.message}`);
    return (data ?? []).map(mapJobRow);
  }

  async saveApplication(application) {
    const learner = await this.ensureLearner(application.phone);
    const { data, error } = await this.client
      .from('applications')
      .upsert(
        {
          learner_id: learner.id,
          job_id: application.jobId,
          status: 'applied',
          notes: application.cardUrl ? `Skill Card: ${application.cardUrl}` : null
        },
        { onConflict: 'learner_id,job_id' }
      )
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to save application: ${error?.message ?? 'no row returned'}`);
    return data;
  }

  async appendEvent(event) {
    const learnerId = event.learnerId && isUuid(event.learnerId) ? event.learnerId : await this.findLearnerId(event.phone);
    const { data, error } = await this.client
      .from('events')
      .insert({
        learner_id: learnerId,
        event_type: event.eventType,
        source: 'bot',
        metadata: {
          ...event.metadata,
          phone: event.phone,
          step_before: event.stepBefore,
          step_after: event.stepAfter,
          local_event_id: event.id,
          timestamp: event.timestamp
        }
      })
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to append event: ${error?.message ?? 'no row returned'}`);
    return data;
  }

  async recentEvents(limit = 50) {
    const { data, error } = await this.client
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to load events: ${error.message}`);
    return data ?? [];
  }

  async ensureLearner(phone, patch = {}) {
    const existing = await this.getLearnerByPhone(phone);
    if (existing?.id) return this.upsertLearner(phone, patch);
    return this.upsertLearner(phone, patch);
  }

  async findLearnerId(phone) {
    if (!phone) return null;
    const learner = await this.getLearnerByPhone(phone);
    return learner?.id ?? null;
  }

  async getLatestSessionRow(learnerId) {
    const { data, error } = await this.client
      .from('sessions')
      .select('id')
      .eq('learner_id', learnerId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to load session row: ${error.message}`);
    return data;
  }
}

function learnerPatchToRow(phone, patch = {}) {
  return removeEmpty({
    phone,
    full_name: patch.full_name ?? patch.name,
    trade: patch.trade,
    district: patch.district,
    state: patch.state,
    status: patch.status ?? learnerStatusFromPlacement(patch.placementStatus),
    risk_score: patch.riskScore
  });
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
  const learnerRow = row.learners ?? learner ?? {};
  return {
    id: row.id,
    phone: learnerRow.phone,
    learnerId: row.learner_id,
    url: `${publicBaseUrl}/card/${row.id}`,
    name: learnerRow.full_name ?? learnerRow.name,
    trade: row.trade,
    district: learnerRow.district,
    state: learnerRow.state,
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
    postedText: row.created_at ? `Posted ${new Date(row.created_at).toLocaleDateString('en-IN')}` : 'Posted recently',
    type: 'job',
    verified: true,
    detail: row.description,
    requirements: row.requirements
  };
}

function parseSalaryRange(value = '') {
  const numbers = value.match(/\d[\d,]*/g)?.map((item) => Number(item.replaceAll(',', ''))) ?? [];
  return {
    min: numbers[0] ?? null,
    max: numbers.at(-1) ?? numbers[0] ?? null
  };
}

function inferDistrictFromLocation(location = '') {
  return location.split(',').map((part) => part.trim()).filter(Boolean).at(-1) ?? null;
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

function removeEmpty(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''));
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
