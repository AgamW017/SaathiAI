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
    // Support comma-separated API keys for rotation
    this.apiKeys = (config.apiKey || '').split(',').map(k => k.trim()).filter(Boolean);
    this._configured = this.apiKeys.length > 0;
    this.model = config.model || DEFAULT_MODEL;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
    this._currentKeyIndex = 0;

    if (!this._configured) {
      const msg = 'GROQ_API_KEY is missing. Groq provider will be unavailable.';
      if (this.logger) this.logger.warn(msg);
      else console.warn('[GroqClient]', msg);
    } else if (this.apiKeys.length > 1) {
      const msg = `Groq configured with ${this.apiKeys.length} API keys (round-robin rotation)`;
      if (this.logger) this.logger.info(msg);
      else console.log('[GroqClient]', msg);
    }
  }

  /** Get the current API key and rotate to next */
  _getNextKey() {
    const key = this.apiKeys[this._currentKeyIndex];
    this._currentKeyIndex = (this._currentKeyIndex + 1) % this.apiKeys.length;
    return key;
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
    // Try each API key until one works (handles rate limits)
    let lastError = null;
    const keysToTry = this.apiKeys.length;

    for (let attempt = 0; attempt < keysToTry; attempt++) {
      const apiKey = this._getNextKey();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            ...body
          }),
          signal: controller.signal
        });

        if (response.status === 429) {
          // Rate limited — try next key
          const errorBody = await safeParseBody(response);
          lastError = new Error(`Rate limited (key ${attempt + 1}/${keysToTry}): ${errorBody?.error?.message || 'Too many requests'}`);
          if (this.logger) this.logger.warn(`Groq key ${attempt + 1} rate limited, trying next...`);
          clearTimeout(timeoutId);
          continue;
        }

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
      } catch (err) {
        clearTimeout(timeoutId);
        // If it's a rate limit retry, continue to next key
        if (err === lastError) continue;
        // For other errors (network, timeout, etc.), throw immediately
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // All keys exhausted
    throw lastError || new Error('All Groq API keys rate limited');
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
Extract trade(s), district, and state from a rural Indian vocational learner's WhatsApp message.

TRADE EXTRACTION RULES:
- Accept ANY legitimate trade/profession/skill the learner mentions. Do NOT restrict to a fixed list.
- Common ITI trades: Electrician, Fitter, COPA, Welder, Plumber, Mechanic, Turner, Machinist, Carpenter, Painter, Sheet Metal Worker, Wireman, Electronics Mechanic, Instrument Mechanic, Draughtsman, Surveyor, Stenographer, Diesel Mechanic, Motor Vehicle Mechanic, Refrigeration/AC, Information Technology, Beauty Wellness, Fashion Design, Food Production, etc.
- Also accept non-ITI trades: Hacker, Cybersecurity, Data Entry, Graphic Design, Digital Marketing, Accounting, Photography, Tailoring, Farming, Driving, Security, Housekeeping, Cooking, etc.
- If the learner mentions multiple trades/skills, return them as comma-separated in the trade field (e.g., "Electrician, Plumber" or "COPA, Data Entry").
- Normalize to concise English labels but DO NOT reject any trade.
- If a trade sounds unusual but the learner insists, accept it.

CRITICAL — District/State resolution:
- ALWAYS resolve the state from the district. Every Indian district belongs to exactly one state. You MUST fill in the state field.
  Examples: Mohali → Punjab, Varanasi → Uttar Pradesh, Jamshedpur → Jharkhand, Pune → Maharashtra.
- If the learner mentions a city/area, map it to the correct district and state.
- Never leave state empty if district is known.
- Do not overwrite existing correct fields unless the message clearly corrects them.

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
You are SaathiAI, a WhatsApp career companion for Indian vocational graduates (ITI/PMKVY/JSS).
You talk like a helpful elder brother/sister who genuinely cares about the learner's career.

Language/script: ${languageName(script)}
Tone: warm, encouraging, slightly informal, practical. Like a supportive friend who knows the job market.
- Use the learner's name with "ji" naturally
- Use WhatsApp formatting: *bold* for emphasis, emojis sparingly but meaningfully
- Sound human, not robotic. Vary your sentence structure.
- Show you understand their situation (blue-collar job seekers, often first-generation workers)

Audience: Young adults (18-25) on low-end Android phones, often in small towns/rural India.
They respond better to encouragement and practical next steps.

Rules:
- Never mention AI, APIs, databases, technical systems, or classification.
- Never guarantee a job or salary.
- Never ask for Aadhaar, bank details, OTPs, passwords.
- Keep messages under 800 characters unless listing multiple jobs.
- If listing jobs, format them cleanly with bullet points and emojis.
- If the brief contains numbered options, preserve them clearly for number-based replies.
- If something is unclear, ask ONE clarifying question — don't bombard with multiple.
- Add a small motivational touch when appropriate (not forced).
- Match the user's energy — if they're excited, be excited. If they're frustrated, be empathetic first.
- NEVER say "samajh nahi aaya" or "I don't understand" when rewriting. The system already understood the user — you are just making the reply sound natural.
- If the user typed a number (1, 2, etc.), they were selecting from a menu. The system handled it. Your job is just to rephrase the response naturally, NOT to express confusion about what the number means.

Intent: ${intent}
The user said: ${JSON.stringify(facts.incomingText ?? '')}${facts.replyingTo ? `\nThe user is REPLYING TO this bot message: ${JSON.stringify(facts.replyingTo)}` : ''}
Recent conversation history: ${JSON.stringify((facts.chatHistory ?? []).slice(-6))}
Session context: ${JSON.stringify(publicSessionSummary(session))}
Key facts: ${JSON.stringify({ ...facts, chatHistory: undefined, replyingTo: undefined })}
Template to rewrite (make it sound natural and personal): ${JSON.stringify(brief)}

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
