import { GoogleGenAI } from '@google/genai';

const DEFAULT_MODEL = 'gemini-3.5-flash';

export class GeminiClient {
  constructor(config, logger = null) {
    this.logger = logger;
    this._configured = Boolean(config.apiKey);

    if (!this._configured) {
      // AI is the primary layer, but the bot must still function without it.
      // Log a severe warning — all calls will use fallback responses.
      const msg = 'GEMINI_API_KEY is missing. Bot will operate in fallback mode with template responses only.';
      if (this.logger) this.logger.warn(msg);
      else console.warn('[GeminiClient]', msg);
    }

    this.model = config.model || DEFAULT_MODEL;
    this.ai = this._configured ? new GoogleGenAI({ apiKey: config.apiKey }) : null;
  }

  isConfigured() {
    return true;
  }

  async runTask(task, payload) {
    const spec = taskSpecs[task];
    if (!spec) throw new Error(`Unknown Gemini task: ${task}`);

    const response = await this.generateJson({
      prompt: spec.prompt(payload),
      schema: spec.schema
    });

    if (response !== null) return response;

    // AI failed — return a safe, schema-conformant empty result so callers don't crash
    return fallbackResult(task);
  }

  async draftReply({ script, intent, facts = {}, brief, session = {} }) {
    const response = await this.generateJson({
      prompt: replyPrompt({ script, intent, facts, brief, session }),
      schema: replySchema
    });

    if (response !== null) {
      return {
        text: sanitizeReply(response.text),
        flags: response.flags ?? []
      };
    }

    // AI unavailable — pass the template brief text through untouched.
    // The template messages in messages.js are already well-written in 3 scripts,
    // so sending them without AI polish is still a good user experience.
    return {
      text: sanitizeReply(brief),
      flags: [aiUnavailableFlag('reply')]
    };
  }

  async generateJson({ prompt, schema }) {
    if (!this._configured || !this.ai) return null;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseFormat: {
            text: {
              mimeType: 'application/json',
              schema
            }
          }
        }
      });

      return parseJson(response.text);
    } catch (error) {
      // Log the error but don't throw — callers will receive null and use fallbacks
      const msg = `Gemini API call failed: ${error.message ?? error}`;
      if (this.logger) this.logger.error({ error }, msg);
      else console.error('[GeminiClient]', msg);
      return null;
    }
  }
}

const profileSchema = {
  type: 'object',
  properties: {
    trade: { type: 'string' },
    district: { type: 'string' },
    state: { type: 'string' },
    confidence: { type: 'number' },
    missingFields: { type: 'array', items: { type: 'string' } },
    flags: { type: 'array', items: flagSchema() }
  },
  required: ['trade', 'district', 'state', 'confidence', 'missingFields', 'flags']
};

const nameSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    confidence: { type: 'number' },
    flags: { type: 'array', items: flagSchema() }
  },
  required: ['name', 'confidence', 'flags']
};

const certificateSchema = {
  type: 'object',
  properties: {
    certificateType: { type: 'string' },
    normalizedType: { type: 'string' },
    confidence: { type: 'number' },
    flags: { type: 'array', items: flagSchema() }
  },
  required: ['certificateType', 'normalizedType', 'confidence', 'flags']
};

const skillSchema = {
  type: 'object',
  properties: {
    skills_mentioned: { type: 'array', items: { type: 'string' } },
    ojt_hours: { type: 'number' },
    specific_projects: { type: 'array', items: { type: 'string' } },
    additional_trades: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
    flags: { type: 'array', items: flagSchema() }
  },
  required: ['skills_mentioned', 'ojt_hours', 'specific_projects', 'additional_trades', 'confidence', 'flags']
};

const feedbackSchema = {
  type: 'object',
  properties: {
    feedback: { type: 'string' },
    score: { type: 'number' },
    flags: { type: 'array', items: flagSchema() }
  },
  required: ['feedback', 'score', 'flags']
};

const replySchema = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    flags: { type: 'array', items: flagSchema() }
  },
  required: ['text', 'flags']
};

function flagSchema() {
  return {
    type: 'object',
    properties: {
      code: { type: 'string' },
      severity: { type: 'string', enum: ['info', 'warning', 'urgent'] },
      reason: { type: 'string' },
      field: { type: 'string' }
    },
    required: ['code', 'severity', 'reason', 'field']
  };
}

const taskSpecs = {
  extract_name: {
    schema: nameSchema,
    prompt: ({ text, script }) => `
You are SaathiAI's intake classifier for Indian vocational learners.
Extract the learner's personal name from the message.
Do not invent. If the message is a greeting, command, emoji, phone number, or not a name, return an empty string for name.
Return professional flags for suspicious/ambiguous input.

Script: ${script}
Message: ${JSON.stringify(text)}
`
  },
  extract_profile: {
    schema: profileSchema,
    prompt: ({ text, existing }) => `
You are SaathiAI's learner profile classifier.
Extract trade, district, and state from a rural Indian vocational learner's WhatsApp message.
Normalize trade to a concise English label such as Electrician, Fitter, COPA, Welder, Plumber, Mechanic, Beauty Wellness.
Normalize district/state using Indian geography. If unsure, use an empty string and add a flag.
Do not overwrite existing correct fields unless the message clearly corrects them.

Existing profile: ${JSON.stringify(existing)}
Message: ${JSON.stringify(text)}
`
  },
  extract_certificate: {
    schema: certificateSchema,
    prompt: ({ text }) => `
Classify the learner's training/certificate source.
Common normalized types: PMKVY, ITI, JSS, Polytechnic, Private Training Centre, Government Skill Centre, Unknown.
Keep certificateType as the learner-friendly label. Add flags if ambiguous.

Message: ${JSON.stringify(text)}
`
  },
  extract_skills: {
    schema: skillSchema,
    prompt: ({ text, existingSkills }) => `
Extract practical vocational skills from a learner's free-form text or STT transcript.
Prefer concrete tasks over broad subjects. Example: "3-phase panel wiring", "fault finding", "MS Excel data entry".
Keep each skill short and employer-readable.
Do not invent skills. Merge mentally with existing skills but return only clean distinct skills.
Flag vague answers, non-career content, safety concerns, distress, fraud risk, or unrelated input.

Existing skills: ${JSON.stringify(existingSkills)}
Message: ${JSON.stringify(text)}
`
  },
  interview_feedback: {
    schema: feedbackSchema,
    prompt: ({ question, answer, script }) => `
You are SaathiAI, a professional but warm interview coach for Indian vocational learners.
Evaluate the answer and give feedback in ${languageName(script)}.
Keep it under 2 short sentences.
Start with one concrete positive point, then one specific improvement.
Never be harsh. Never overpromise employment.

Question: ${JSON.stringify(question)}
Answer: ${JSON.stringify(answer)}
`
  }
};

function replyPrompt({ script, intent, facts, brief, session }) {
  return `
You are SaathiAI, a WhatsApp career companion for Indian vocational graduates.
You are the only voice the learner sees. Write the final WhatsApp message.

Language/script: ${languageName(script)}
Tone: professional, warm, concise, respectful. Use the learner's name with "ji" when natural.
Audience: low-end Android WhatsApp user, often rural, likely Hindi/Hinglish.

Rules:
- Do not mention AI internals, APIs, database, schema, errors, or classification.
- Do not guarantee a job.
- Do not ask for Aadhaar, bank details, OTPs, passwords, or sensitive credentials.
- Ask only the next useful question.
- If options are provided in the brief, preserve the numbered options exactly enough for the user to reply by number.
- Keep under 900 characters unless listing jobs.
- If a field is uncertain, politely ask a clarifying question instead of pretending certainty.
- Never include technical debug information.

Intent: ${intent}
Session summary: ${JSON.stringify(publicSessionSummary(session))}
Facts to include: ${JSON.stringify(facts)}
Draft brief to transform: ${JSON.stringify(brief)}

Return only JSON with text and flags. For unknown flag.field, use an empty string.
`;
}

function publicSessionSummary(session) {
  return {
    step: session.step,
    script: session.script,
    placementStatus: session.placementStatus,
    learner: {
      name: session.collected?.name,
      trade: session.collected?.trade,
      district: session.collected?.district,
      certificateType: session.collected?.certificateType,
      skills: session.collected?.skills
    }
  };
}

function languageName(script) {
  if (script === 'devanagari') return 'Devanagari Hindi';
  if (script === 'english') return 'simple English';
  return 'Roman Hinglish';
}

function sanitizeReply(text = '') {
  return text.toString().trim().replace(/\n{3,}/g, '\n\n');
}

function parseJson(text) {
  const raw = text?.trim() ?? '';
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    // Return null instead of throwing — generateJson will propagate null to trigger fallbacks
    return null;
  }
}

function aiUnavailableFlag(field = '') {
  return { code: 'ai_unavailable', severity: 'warning', reason: 'Gemini API call failed or returned invalid data', field };
}

const fallbackResults = {
  extract_name: {
    name: '',
    confidence: 0,
    flags: [aiUnavailableFlag('name')]
  },
  extract_profile: {
    trade: '',
    district: '',
    state: '',
    confidence: 0,
    missingFields: ['trade', 'district'],
    flags: [aiUnavailableFlag('profile')]
  },
  extract_certificate: {
    certificateType: '',
    normalizedType: 'Unknown',
    confidence: 0,
    flags: [aiUnavailableFlag('certificate')]
  },
  extract_skills: {
    skills_mentioned: [],
    ojt_hours: 0,
    specific_projects: [],
    additional_trades: [],
    confidence: 0,
    flags: [aiUnavailableFlag('skills')]
  },
  interview_feedback: {
    feedback: '',
    score: 0,
    flags: [aiUnavailableFlag('feedback')]
  }
};

function fallbackResult(task) {
  return fallbackResults[task] ?? { flags: [aiUnavailableFlag(task)] };
}
