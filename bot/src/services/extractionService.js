import { uniqueList } from '../utils/text.js';

const MIN_PROFILE_CONFIDENCE = 0.62;
const MIN_NAME_CONFIDENCE = 0.55;

export class ExtractionService {
  constructor({ aiClient, logger }) {
    this.aiClient = aiClient;
    this.logger = logger;
  }

  async extractName(text, { script } = {}) {
    const result = await this.aiClient.runTask('extract_name', { text, script });
    const name = cleanName(result.name);
    return {
      name: result.confidence >= MIN_NAME_CONFIDENCE ? name : null,
      confidence: result.confidence,
      flags: result.flags ?? []
    };
  }

  async extractProfile(text, existing = {}) {
    const result = await this.aiClient.runTask('extract_profile', { text, existing });
    const flags = result.flags ?? [];
    const confident = Number(result.confidence ?? 0) >= MIN_PROFILE_CONFIDENCE;

    return normalizeProfile({
      trade: confident ? result.trade ?? existing.trade : existing.trade ?? null,
      district: confident ? result.district ?? existing.district : existing.district ?? null,
      state: confident ? result.state || existing.state || null : existing.state ?? null,
      confidence: result.confidence,
      missingFields: result.missingFields ?? [],
      flags
    });
  }

  async extractCertificate(text) {
    const result = await this.aiClient.runTask('extract_certificate', { text });
    return {
      certificateType: result.certificateType || result.normalizedType || 'Unknown',
      normalizedType: result.normalizedType || result.certificateType || 'Unknown',
      confidence: result.confidence,
      flags: result.flags ?? []
    };
  }

  async extractSkills(text, existingSkills = []) {
    const result = await this.aiClient.runTask('extract_skills', { text, existingSkills });
    return {
      skills: uniqueList([...(existingSkills ?? []), ...(result.skills_mentioned ?? [])]).slice(0, 12),
      ojtHours: result.ojt_hours > 0 ? result.ojt_hours : null,
      specificProjects: result.specific_projects ?? [],
      additionalTrades: result.additional_trades ?? [],
      confidence: result.confidence,
      flags: result.flags ?? []
    };
  }

  async interviewFeedback({ question, answer, script }) {
    const result = await this.aiClient.runTask('interview_feedback', { question, answer, script });
    return result.feedback;
  }
}

function normalizeProfile(profile) {
  return {
    trade: cleanLabel(profile.trade),
    district: cleanLabel(profile.district),
    state: cleanLabel(profile.state),
    confidence: profile.confidence ?? null,
    missingFields: profile.missingFields ?? [],
    flags: profile.flags ?? []
  };
}

function cleanLabel(value) {
  if (!value) return null;
  const cleaned = value.toString().replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

function cleanName(value) {
  const cleaned = cleanLabel(value);
  if (!cleaned) return null;
  if (cleaned.length < 2 || cleaned.length > 60) return null;
  if (/^\d+$/.test(cleaned)) return null;
  return cleaned;
}
