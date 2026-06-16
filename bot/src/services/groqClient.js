/**
 * Groq LLM Client — uses the Groq REST API (OpenAI-compatible).
 *
 * Implements the same interface as GeminiClient:
 *   - generateJson({ prompt, schema })
 *   - draftReply({ script, intent, facts, brief, session })
 *   - runTask(task, payload)
 *   - isConfigured()
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_TIMEOUT_MS = 30_000;

export class GroqClient {
  constructor(config, logger = null) {
    this.logger = logger;
    this._configured = Boolean(config.apiKey);
    this.apiKey = config.apiKey || '';
    this.model = config.model || DEFAULT_MODEL;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;

    if (!this._configured) {
      const msg = 'GROQ_API_KEY is missing. Groq provider will be unavailable.';
      if (this.logger) this.logger.warn(msg);
      else console.warn('[GroqClient]', msg);
    }
  }

  isConfigured() {
    return this._configured;
  }

  /**
   * Generate a JSON response from a text prompt.
   * Returns parsed JSON object or null on failure.
   */
  async generateJson({ prompt, schema }) {
    if (!this._configured) return null;

    try {
      const systemPrompt = buildSystemPrompt(schema);
      const response = await this._callApi({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 4096
      });

      return parseJson(response);
    } catch (error) {
      const msg = `Groq API call failed: ${error.message ?? error}`;
      if (this.logger) this.logger.error({ error }, msg);
      else console.error('[GroqClient]', msg);
      return null;
    }
  }

  /**
   * Draft a reply — delegates to generateJson with the reply prompt.
   */
  async draftReply({ script, intent, facts = {}, brief, session = {} }) {
    const prompt = buildReplyPrompt({ script, intent, facts, brief, session });
    const response = await this.generateJson({
      prompt,
      schema: replySchema
    });

    if (response !== null) {
      return {
        text: sanitizeReply(response.text),
        flags: response.flags ?? []
      };
    }

    return null; // Let the fallback layer handle it
  }

  /**
   * Run a named task (same interface as GeminiClient.runTask).
   * Returns null on failure so the facade can fall back.
   */
  async runTask(task, payload) {
    const spec = taskSpecs[task];
    if (!spec) throw new Error(`Unknown LLM task: ${task}`);

    const response = await this.generateJson({
      prompt: spec.prompt(payload),
      schema: spec.schema
    });

    return response; // null signals failure to the facade
  }

  /**
   * Core API call to Groq's OpenAI-compatible endpoint.
   */
  async _callApi(body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          ...body
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await safeParseBody(response);
        throw new Error(
          `HTTP ${response.status}: ${errorBody?.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Groq returned empty response');
      }

      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// --- Shared schemas & prompts (mirrored from geminiClient.js) ---

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

const replySchema = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    flags: { type: 'array', items: flagSchema() }
  },
  required: ['text', 'flags']
};

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

Return ONLY a valid JSON object matching this structure: { name, confidence, flags }
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

Return ONLY a valid JSON object matching this structure: { trade, district, state, confidence, missingFields, flags }
`
  },
  extract_certificate: {
    schema: certificateSchema,
    prompt: ({ text }) => `
Classify the learner's training/certificate source.
Common normalized types: PMKVY, ITI, JSS, Polytechnic, Private Training Centre, Government Skill Centre, Unknown.
Keep certificateType as the learner-friendly label. Add flags if ambiguous.

Message: ${JSON.stringify(text)}

Return ONLY a valid JSON object matching this structure: { certificateType, normalizedType, confidence, flags }
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

Return ONLY a valid JSON object matching this structure: { skills_mentioned, ojt_hours, specific_projects, additional_trades, confidence, flags }
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

Return ONLY a valid JSON object matching this structure: { feedback, score, flags }
`
  }
};

function buildReplyPrompt({ script, intent, facts, brief, session }) {
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

Return ONLY a valid JSON object with text and flags. For unknown flag.field, use an empty string.
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

function buildSystemPrompt(schema) {
  return `You are a helpful AI assistant. You MUST respond with valid JSON only — no markdown, no code fences, no extra text. Your response must conform to the following JSON schema:\n${JSON.stringify(schema, null, 2)}`;
}

function sanitizeReply(text = '') {
  return text.toString().trim().replace(/\n{3,}/g, '\n\n');
}

function parseJson(text) {
  const raw = (text ?? '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return null;
  }
}

async function safeParseBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
