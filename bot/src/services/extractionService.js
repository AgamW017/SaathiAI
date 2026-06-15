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

    if (result.confidence >= MIN_NAME_CONFIDENCE && name) {
      return { name, confidence: result.confidence, flags: result.flags ?? [] };
    }

    // AI returned nothing or low confidence — try heuristic extraction
    const heuristicName = heuristicExtractName(text);
    if (heuristicName) {
      return {
        name: heuristicName,
        confidence: 0.4,
        flags: [...(result.flags ?? []), { code: 'heuristic_fallback', severity: 'info', reason: 'Name extracted by heuristic after AI returned low confidence', field: 'name' }]
      };
    }

    return { name: null, confidence: result.confidence, flags: result.flags ?? [] };
  }

  async extractProfile(text, existing = {}) {
    const result = await this.aiClient.runTask('extract_profile', { text, existing });
    const flags = result.flags ?? [];
    const confident = Number(result.confidence ?? 0) >= MIN_PROFILE_CONFIDENCE;

    if (confident && (result.trade || result.district)) {
      return normalizeProfile({
        trade: result.trade ?? existing.trade ?? null,
        district: result.district ?? existing.district ?? null,
        state: result.state || existing.state || null,
        confidence: result.confidence,
        missingFields: result.missingFields ?? [],
        flags
      });
    }

    // AI returned nothing useful — try heuristic keyword matching
    const heuristic = heuristicExtractProfile(text, existing);
    return normalizeProfile({
      trade: heuristic.trade ?? existing.trade ?? null,
      district: heuristic.district ?? existing.district ?? null,
      state: heuristic.state ?? existing.state ?? null,
      confidence: heuristic.matched ? 0.45 : 0,
      missingFields: result.missingFields ?? [],
      flags: [...flags, ...(heuristic.matched
        ? [{ code: 'heuristic_fallback', severity: 'info', reason: 'Profile extracted by keyword matching after AI returned low confidence', field: 'profile' }]
        : [])]
    });
  }

  async extractCertificate(text) {
    const result = await this.aiClient.runTask('extract_certificate', { text });

    if (result.certificateType || result.normalizedType !== 'Unknown') {
      return {
        certificateType: result.certificateType || result.normalizedType || 'Unknown',
        normalizedType: result.normalizedType || result.certificateType || 'Unknown',
        confidence: result.confidence,
        flags: result.flags ?? []
      };
    }

    // AI returned nothing — try regex matching for known certificate types
    const heuristic = heuristicExtractCertificate(text);
    return {
      certificateType: heuristic.certificateType,
      normalizedType: heuristic.normalizedType,
      confidence: heuristic.matched ? 0.5 : 0,
      flags: [...(result.flags ?? []), ...(heuristic.matched
        ? [{ code: 'heuristic_fallback', severity: 'info', reason: 'Certificate matched by keyword', field: 'certificate' }]
        : [])]
    };
  }

  async extractSkills(text, existingSkills = []) {
    const result = await this.aiClient.runTask('extract_skills', { text, existingSkills });
    const aiSkills = result.skills_mentioned ?? [];

    if (aiSkills.length > 0) {
      return {
        skills: uniqueList([...(existingSkills ?? []), ...aiSkills]).slice(0, 12),
        ojtHours: result.ojt_hours > 0 ? result.ojt_hours : null,
        specificProjects: result.specific_projects ?? [],
        additionalTrades: result.additional_trades ?? [],
        confidence: result.confidence,
        flags: result.flags ?? []
      };
    }

    // AI returned no skills — try splitting text into skill phrases
    const heuristicSkills = heuristicExtractSkills(text);
    return {
      skills: uniqueList([...(existingSkills ?? []), ...heuristicSkills]).slice(0, 12),
      ojtHours: null,
      specificProjects: [],
      additionalTrades: [],
      confidence: heuristicSkills.length > 0 ? 0.3 : 0,
      flags: [...(result.flags ?? []), ...(heuristicSkills.length > 0
        ? [{ code: 'heuristic_fallback', severity: 'info', reason: 'Skills extracted by text splitting after AI returned empty', field: 'skills' }]
        : [])]
    };
  }

  async interviewFeedback({ question, answer, script }) {
    const result = await this.aiClient.runTask('interview_feedback', { question, answer, script });
    const feedback = result.feedback;

    if (feedback) return feedback;

    // AI returned no feedback — use pre-written encouraging response
    return heuristicInterviewFeedback(script);
  }
}

// ============================================================
// Heuristic fallback functions
// ============================================================

// Common Hindi/English greetings and filler words to strip when guessing a name
const GREETING_WORDS = new Set([
  'hi', 'hello', 'namaste', 'namaskar', 'mera', 'naam', 'name', 'hai', 'hain',
  'hoon', 'hu', 'main', 'mai', 'ji', 'sir', 'bhai', 'bhaiya', 'didi',
  'नमस्ते', 'नमस्कार', 'मेरा', 'नाम', 'है', 'हैं', 'हूँ', 'मैं'
]);

function heuristicExtractName(text) {
  if (!text) return null;
  // Strip emojis, special chars, numbers, and extra spaces
  let cleaned = text
    .replace(/[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/[^\p{L}\s]/gu, '')
    .trim();

  if (!cleaned) return null;

  // Split into words, remove greeting/filler words
  const words = cleaned.split(/\s+/).filter((w) => !GREETING_WORDS.has(w.toLowerCase()));

  if (words.length === 0 || words.length > 4) return null;

  const name = words.join(' ');
  return cleanName(name);
}

// Known Indian trades from the spec — covers PMKVY/ITI common trades
const KNOWN_TRADES = [
  { pattern: /\b(electric(?:ian|al)?|bijli|विद्युत|इलेक्ट्रिशियन)\b/i, label: 'Electrician' },
  { pattern: /\b(fitter|फिटर)\b/i, label: 'Fitter' },
  { pattern: /\b(copa|कोपा|computer\s*operator)\b/i, label: 'COPA' },
  { pattern: /\b(weld(?:er|ing)|वेल्डर)\b/i, label: 'Welder' },
  { pattern: /\b(plumb(?:er|ing)|प्लम्बर|नलसाज)\b/i, label: 'Plumber' },
  { pattern: /\b(mechani[ck]|मैकेनिक|मिस्त्री)\b/i, label: 'Mechanic' },
  { pattern: /\b(beauty|wellness|ब्यूटी)\b/i, label: 'Beauty Wellness' },
  { pattern: /\b(carpenter|बढ़ई)\b/i, label: 'Carpenter' },
  { pattern: /\b(painter|पेंटर)\b/i, label: 'Painter' },
  { pattern: /\b(mason|राजमिस्त्री)\b/i, label: 'Mason' },
  { pattern: /\b(turner|टर्नर)\b/i, label: 'Turner' },
  { pattern: /\b(machinist|मशीनिस्ट)\b/i, label: 'Machinist' },
  { pattern: /\b(draughtsman|ड्राफ्ट्समैन)\b/i, label: 'Draughtsman' },
  { pattern: /\b(diesel\s*mechanic)\b/i, label: 'Diesel Mechanic' },
  { pattern: /\b(motor\s*mechanic)\b/i, label: 'Motor Mechanic' },
  { pattern: /\b(sewing|silai|सिलाई|tailor|दर्ज़ी)\b/i, label: 'Sewing Technology' },
  { pattern: /\b(data\s*entry)\b/i, label: 'Data Entry Operator' }
];

// Major Indian districts — a representative sample for keyword matching
const KNOWN_DISTRICTS = [
  { pattern: /\b(varanasi|वाराणसी|banaras|बनारस)\b/i, district: 'Varanasi', state: 'Uttar Pradesh' },
  { pattern: /\b(lucknow|लखनऊ)\b/i, district: 'Lucknow', state: 'Uttar Pradesh' },
  { pattern: /\b(kanpur|कानपुर)\b/i, district: 'Kanpur', state: 'Uttar Pradesh' },
  { pattern: /\b(agra|आगरा)\b/i, district: 'Agra', state: 'Uttar Pradesh' },
  { pattern: /\b(allahabad|prayagraj|प्रयागराज|इलाहाबाद)\b/i, district: 'Prayagraj', state: 'Uttar Pradesh' },
  { pattern: /\b(gorakhpur|गोरखपुर)\b/i, district: 'Gorakhpur', state: 'Uttar Pradesh' },
  { pattern: /\b(meerut|मेरठ)\b/i, district: 'Meerut', state: 'Uttar Pradesh' },
  { pattern: /\b(jaipur|जयपुर)\b/i, district: 'Jaipur', state: 'Rajasthan' },
  { pattern: /\b(jodhpur|जोधपुर)\b/i, district: 'Jodhpur', state: 'Rajasthan' },
  { pattern: /\b(udaipur|उदयपुर)\b/i, district: 'Udaipur', state: 'Rajasthan' },
  { pattern: /\b(patna|पटना)\b/i, district: 'Patna', state: 'Bihar' },
  { pattern: /\b(gaya|गया)\b/i, district: 'Gaya', state: 'Bihar' },
  { pattern: /\b(muzaffarpur|मुजफ्फरपुर)\b/i, district: 'Muzaffarpur', state: 'Bihar' },
  { pattern: /\b(bhopal|भोपाल)\b/i, district: 'Bhopal', state: 'Madhya Pradesh' },
  { pattern: /\b(indore|इंदौर)\b/i, district: 'Indore', state: 'Madhya Pradesh' },
  { pattern: /\b(delhi|दिल्ली|new\s*delhi|नई\s*दिल्ली)\b/i, district: 'Delhi', state: 'Delhi' },
  { pattern: /\b(mumbai|मुंबई|bombay)\b/i, district: 'Mumbai', state: 'Maharashtra' },
  { pattern: /\b(pune|पुणे)\b/i, district: 'Pune', state: 'Maharashtra' },
  { pattern: /\b(nagpur|नागपुर)\b/i, district: 'Nagpur', state: 'Maharashtra' },
  { pattern: /\b(ahmedabad|अहमदाबाद)\b/i, district: 'Ahmedabad', state: 'Gujarat' },
  { pattern: /\b(surat|सूरत)\b/i, district: 'Surat', state: 'Gujarat' },
  { pattern: /\b(bangalore|bengaluru|बेंगलुरु)\b/i, district: 'Bengaluru', state: 'Karnataka' },
  { pattern: /\b(chennai|चेन्नई)\b/i, district: 'Chennai', state: 'Tamil Nadu' },
  { pattern: /\b(hyderabad|हैदराबाद)\b/i, district: 'Hyderabad', state: 'Telangana' },
  { pattern: /\b(kolkata|कोलकाता)\b/i, district: 'Kolkata', state: 'West Bengal' },
  { pattern: /\b(ranchi|रांची)\b/i, district: 'Ranchi', state: 'Jharkhand' },
  { pattern: /\b(dehradun|देहरादून)\b/i, district: 'Dehradun', state: 'Uttarakhand' },
  { pattern: /\b(chandigarh|चंडीगढ़)\b/i, district: 'Chandigarh', state: 'Chandigarh' },
  { pattern: /\b(raipur|रायपुर)\b/i, district: 'Raipur', state: 'Chhattisgarh' },
  { pattern: /\b(guwahati|गुवाहाटी)\b/i, district: 'Guwahati', state: 'Assam' },
  { pattern: /\b(bhubaneswar|भुवनेश्वर)\b/i, district: 'Bhubaneswar', state: 'Odisha' },
  { pattern: /\b(thiruvananthapuram|तिरुवनंतपुरम)\b/i, district: 'Thiruvananthapuram', state: 'Kerala' }
];

function heuristicExtractProfile(text, existing = {}) {
  const result = { trade: null, district: null, state: null, matched: false };

  for (const entry of KNOWN_TRADES) {
    if (entry.pattern.test(text)) {
      result.trade = entry.label;
      result.matched = true;
      break;
    }
  }

  for (const entry of KNOWN_DISTRICTS) {
    if (entry.pattern.test(text)) {
      result.district = entry.district;
      result.state = entry.state;
      result.matched = true;
      break;
    }
  }

  return result;
}

const CERTIFICATE_PATTERNS = [
  { pattern: /\bpmkvy\b/i, type: 'PMKVY', normalized: 'PMKVY' },
  { pattern: /\b(iti|आई\.?टी\.?आई)\b/i, type: 'ITI', normalized: 'ITI' },
  { pattern: /\b(jss|जे\.?एस\.?एस)\b/i, type: 'JSS', normalized: 'JSS' },
  { pattern: /\b(polytechnic|पॉलिटेक्निक)\b/i, type: 'Polytechnic', normalized: 'Polytechnic' },
  { pattern: /\b(government|sarkari|सरकारी|govt)\b/i, type: 'Government Skill Centre', normalized: 'PMKVY' },
  { pattern: /\b(private|प्राइवेट|training\s*cent[er]r?e?)\b/i, type: 'Private Training Centre', normalized: 'Private Training Centre' },
  { pattern: /\b(skill\s*centre|skill\s*center|कौशल\s*केंद्र)\b/i, type: 'Government Skill Centre', normalized: 'PMKVY' },
  { pattern: /\b(college|कॉलेज)\b/i, type: 'College', normalized: 'Polytechnic' }
];

function heuristicExtractCertificate(text) {
  for (const entry of CERTIFICATE_PATTERNS) {
    if (entry.pattern.test(text)) {
      return { certificateType: entry.type, normalizedType: entry.normalized, matched: true };
    }
  }
  return { certificateType: 'Unknown', normalizedType: 'Unknown', matched: false };
}

function heuristicExtractSkills(text) {
  if (!text || text.trim().length < 3) return [];

  // Split by commas, line breaks, "aur"/"और"/"and" conjunctions
  const phrases = text
    .split(/[,\n]|(?:\band\b)|(?:\baur\b)|(?:और)/i)
    .map((p) => p.replace(/[^\p{L}\p{N}\s\-\.]/gu, '').trim())
    .filter((p) => p.length >= 3 && p.split(/\s+/).length <= 8);

  // Deduplicate and return at most 6 heuristic skills
  return uniqueList(phrases).slice(0, 6);
}

const FALLBACK_FEEDBACK = {
  devanagari: 'अच्छा प्रयास! एक specific example देने की कोशिश करें — जैसे कोई real project या काम जो आपने किया हो। इससे interviewer को आपकी capability समझ में आएगी।',
  english: 'Good attempt! Try giving a specific example from your training or OJT — like a real task you completed. This helps the interviewer see your practical ability.',
  roman: 'Accha prayaas! Ek specific example dene ki koshish karein — jaise koi real project ya kaam jo aapne kiya ho. Isse interviewer ko aapki capability samajh mein aayegi.'
};

function heuristicInterviewFeedback(script = 'roman') {
  return FALLBACK_FEEDBACK[script] ?? FALLBACK_FEEDBACK.roman;
}

// ============================================================
// Utility functions
// ============================================================

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

