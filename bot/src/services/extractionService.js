import { compact, uniqueList } from '../utils/text.js';

const TRADE_ALIASES = new Map([
  ['electrician', ['electrician', 'electrical', 'bijli', 'वायरिंग', 'बिजली', 'इलेक्ट्रीशियन']],
  ['fitter', ['fitter', 'fitters', 'फिटर']],
  ['copa', ['copa', 'computer', 'data entry', 'कंप्यूटर', 'कोपा']],
  ['welder', ['welder', 'welding', 'weld', 'वेल्डर', 'वेल्डिंग']],
  ['plumber', ['plumber', 'plumbing', 'प्लम्बर', 'प्लंबर']],
  ['mechanic', ['mechanic', 'motor', 'diesel', 'मैकेनिक']],
  ['beauty wellness', ['beauty', 'wellness', 'salon', 'ब्यूटी']]
]);

const DISTRICTS = [
  'Varanasi',
  'Kanpur',
  'Lucknow',
  'Noida',
  'Prayagraj',
  'Gorakhpur',
  'Jaunpur',
  'Agra',
  'Meerut',
  'Ghaziabad',
  'Bareilly'
];

const SKILL_HINTS = [
  'wiring',
  'fault finding',
  'panel board',
  'single phase',
  '3 phase',
  'three phase',
  'earthing',
  'safety',
  'lathe',
  'turning',
  'measurement',
  'blueprint',
  'data entry',
  'ms office',
  'excel',
  'typing',
  'welding',
  'butt joint',
  'pipe fitting',
  'repair',
  'installation',
  'maintenance'
];

export class ExtractionService {
  constructor({ aiClient, logger }) {
    this.aiClient = aiClient;
    this.logger = logger;
  }

  async extractProfile(text, existing = {}) {
    const external = await this.tryExternal('extract_profile', { text, existing });
    if (external) {
      return normalizeProfile({ ...existing, ...external });
    }

    return normalizeProfile({
      ...existing,
      trade: compact(existing.trade) ?? findTrade(text),
      district: compact(existing.district) ?? findDistrict(text),
      state: compact(existing.state) ?? 'Uttar Pradesh'
    });
  }

  async extractCertificate(text) {
    const external = await this.tryExternal('extract_certificate', { text });
    if (external?.certificateType) return external.certificateType;

    const value = text.toLowerCase();
    if (value.includes('iti') || value.includes('polytechnic') || value.includes('sarkari college')) return 'ITI';
    if (value.includes('pmkvy') || value.includes('government') || value.includes('skill centre')) return 'PMKVY';
    if (value.includes('jss')) return 'JSS';
    return text.trim() || 'unknown';
  }

  async extractSkills(text, existingSkills = []) {
    const external = await this.tryExternal('extract_skills', { text, existingSkills });
    if (external?.skills_mentioned) {
      return {
        skills: uniqueList([...existingSkills, ...external.skills_mentioned]),
        ojtHours: external.ojt_hours ?? null,
        specificProjects: external.specific_projects ?? [],
        additionalTrades: external.additional_trades ?? []
      };
    }

    const lower = text.toLowerCase();
    const hintedSkills = SKILL_HINTS.filter((hint) => lower.includes(hint)).map(titleCaseSkill);
    const sentenceSkills = text
      .split(/[,.।\n]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 6 && part.length <= 80)
      .slice(0, 5);

    return {
      skills: uniqueList([...existingSkills, ...hintedSkills, ...sentenceSkills]).slice(0, 8),
      ojtHours: readOjtHours(text),
      specificProjects: [],
      additionalTrades: []
    };
  }

  async interviewFeedback({ question, answer, script }) {
    const external = await this.tryExternal('interview_feedback', { question, answer, script });
    if (external?.feedback) return external.feedback;

    const hasSpecifics = /\d|phase|safety|tool|machine|project|site|ojt|example|उदाहरण|काम/i.test(answer);
    if (script === 'devanagari') {
      return hasSpecifics
        ? 'अच्छा जवाब है. Interview में यही बात एक real example के साथ बोलें, ताकि employer को आपका काम साफ समझ आए.'
        : 'ठीक शुरुआत है. एक specific example जोड़िए - आपने कहाँ काम किया, कौन सा tool use किया, और result क्या था.';
    }
    if (script === 'english') {
      return hasSpecifics
        ? 'Good answer. In the interview, connect it to one real example so the employer can picture your work.'
        : 'Good start. Add one specific example: where you worked, which tool you used, and what result you achieved.';
    }
    return hasSpecifics
      ? 'Accha jawab hai. Interview mein isi baat ko ek real example ke saath boliye, taaki employer ko kaam clear dikhe.'
      : 'Theek start hai. Ek specific example jodiye - kahan kaam kiya, kaunsa tool use kiya, aur result kya tha.';
  }

  async tryExternal(task, payload) {
    if (!this.aiClient?.isConfigured()) return null;
    try {
      return await this.aiClient.runTask(task, payload);
    } catch (error) {
      this.logger.warn({ error, task }, 'External AI task failed; falling back locally');
      return null;
    }
  }
}

function normalizeProfile(profile) {
  return {
    trade: compact(profile.trade),
    district: compact(profile.district),
    state: compact(profile.state)
  };
}

function findTrade(text) {
  const lower = text.toLowerCase();
  for (const [trade, aliases] of TRADE_ALIASES) {
    if (aliases.some((alias) => lower.includes(alias.toLowerCase()))) return trade;
  }
  return null;
}

function findDistrict(text) {
  const lower = text.toLowerCase();
  return DISTRICTS.find((district) => lower.includes(district.toLowerCase())) ?? inferDistrict(text);
}

function inferDistrict(text) {
  const candidates = [
    readMatch(text, /\b(?:district|jila|zilla)\s+(?:is\s+)?([a-zA-Z\u0900-\u097F ]{2,40})/i),
    readMatch(text, /([a-zA-Z\u0900-\u097F ]{2,40})\s+(?:district|jila|zilla)\b/i),
    readMatch(text, /(?:main|mai|i am in|i live in|from|se|से|में|mein|me)\s+([a-zA-Z\u0900-\u097F ]{2,40})/i),
    readMatch(text, /([a-zA-Z\u0900-\u097F ]{2,40})\s+(?:mein|me|में)\b/i),
    inferFromComma(text)
  ];

  return candidates.map(cleanDistrictCandidate).find(Boolean) ?? null;
}

function inferFromComma(text) {
  const parts = text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length >= 2 ? parts.at(-1) : null;
}

function readMatch(text, pattern) {
  return text.match(pattern)?.[1] ?? null;
}

function cleanDistrictCandidate(candidate) {
  if (!candidate) return null;

  const cleaned = candidate
    .replace(/\b(rehta|rehti|rahta|rahti|hoon|hu|hun|hai|hain|aur|and|trade|course|kiya|from|se|mein|me)\b/gi, ' ')
    .replace(/[.।]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2 || cleaned.length > 30) return null;
  if (findTrade(cleaned)) return null;
  return titleCaseWords(cleaned);
}

function titleCaseWords(value) {
  return value
    .split(' ')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');
}

function readOjtHours(text) {
  const match = text.match(/(\d{2,4})\s*(hours|hrs|घंटे)/i);
  return match ? Number(match[1]) : null;
}

function titleCaseSkill(skill) {
  return skill
    .split(' ')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}
