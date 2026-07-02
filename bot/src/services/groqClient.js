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
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
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
   * Draft a reply using proper multi-turn conversation history.
   * Chat history is sent as real user/assistant message turns instead of
   * being serialized as JSON inside a single prompt.
   */
  async draftReply({ script, intent, facts = {}, brief, session = {} }) {
    if (!this._configured) return null;

    const effectiveLanguage = session?.language ?? script;
    const systemPrompt = buildReplySystemPrompt(effectiveLanguage);

    // Build proper multi-turn messages array
    const messages = [{ role: 'system', content: systemPrompt }];

    // Add chat history as actual conversation turns
    const history = (facts.chatHistory ?? []).slice(-20);
    for (const entry of history) {
      messages.push({
        role: entry.role === 'user' ? 'user' : 'assistant',
        content: entry.text
      });
    }

    // Final user message with current context and template to rewrite
    messages.push({ role: 'user', content: buildReplyUserMessage({ intent, facts, brief, session }) });

    try {
      const response = await this._callApi({
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2048
      });

      const parsed = parseJson(response);
      if (parsed !== null) {
        return {
          text: sanitizeReply(parsed.text),
          flags: parsed.flags ?? []
        };
      }
      return null;
    } catch (error) {
      const msg = `Groq draftReply failed: ${error.message ?? error}`;
      if (this.logger) this.logger.error({ error }, msg);
      else console.error('[GroqClient]', msg);
      throw error; // Propagate to LlmClient for Gemini fallback
    }
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

const decisionSchema = {
  type: 'object',
  properties: {
    decision: { type: 'string' }
  },
  required: ['decision']
};

const intentSchema = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['jobs', 'practice', 'card', 'help', 'stop', 'start', 'status', 'placed', 'distress', 'none'] },
    isDistress: { type: 'boolean' }
  },
  required: ['intent', 'isDistress']
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
  extract_decision: {
    schema: decisionSchema,
    prompt: ({ text, step, options }) => `
The user is at the step: ${step}.
They were given these options: ${JSON.stringify(options)}.
Based on their message, which option did they choose?
If they clearly chose one of the options, return that exact option string.
If they chose none, or their intent doesn't match any option, return "none".
Message: ${JSON.stringify(text)}

Return ONLY a valid JSON object matching this structure: { decision }
`
  },
  extract_intent: {
    schema: intentSchema,
    prompt: ({ text, step }) => `
Classify the user's intent based on their message.
Possible intents:
- 'jobs': user wants to see jobs, search for jobs, or says they need work.
- 'practice': user wants to practice interviews.
- 'card': user wants to see or share their skill card.
- 'help': user needs help or assistance.
- 'stop': user wants to stop, unsubscribe, or opt out.
- 'start': user wants to start or resume.
- 'status': user wants to check their application status.
- 'placed': user got a job, got placed, or has been selected.
- 'distress': user is in distress, very frustrated, out of money, or expressing desperation (e.g., "thak gaya", "paisa nahi").
- 'none': None of the above. User is answering a question, giving their name, trade, confirmation, or making conversational small talk.

Current step: ${step}

Message: ${JSON.stringify(text)}

Return ONLY a valid JSON object matching this structure: { intent, isDistress }
`
  },
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

/**
 * System prompt for reply drafting — sent as the system message.
 * Contains mission, persona, onboarding context, and rules.
 */
function buildReplySystemPrompt(language) {
  return `You are SaathiAI, a WhatsApp assistant that helps job seekers across India get real opportunities.

YOUR MISSION:
You onboard learners through a structured flow — collecting their name, skills, location, training certificates (if any), verifying their identity via Aadhaar KYC, extracting detailed skills, then matching them with verified job opportunities. You also provide interview practice and post-placement support.

Language/script: ${languageName(language)}
Personality: You are like a supportive elder brother/sister (bhaiya/didi) who genuinely cares.
- Use the learner's name with "ji" naturally (e.g., "Raj ji")
- Use WhatsApp formatting: *bold* for emphasis, emojis sparingly but meaningfully
- Sound human, not robotic. Vary your phrasing.
- Show you understand their world — job seekers from all backgrounds looking for real opportunities.

Audience: Job seekers from diverse backgrounds across India.
They respond best to encouragement, simple language, and clear next steps.

AADHAAR VERIFICATION — IMPORTANT CONTEXT:
Aadhaar KYC is a MANDATORY step in the onboarding process. You should handle it naturally:
- If a learner hesitates or asks "why?", explain the real benefits conversationally:
  • Verified profiles get noticed by employers first — "Employers verified candidates ko zyada prefer karte hain"
  • It protects THEM from fake job scams — "Aapki safety ke liye bhi zaroori hai"
  • Better job matches happen with verified identity — "Bina verify ke job match nahi ho paata"
  • Their data is secure — only used for identity, never shared
- If they say "mere paas abhi nahi hai" — be understanding, suggest they come back when ready, but be clear it IS required
- If they have privacy concerns — empathize first, then reassure with specifics
- NEVER be robotic or repetitive. Each response about Aadhaar should feel fresh and address their specific concern
- NEVER skip Aadhaar verification or suggest it's optional

ONBOARDING FLOW AWARENESS:
You are aware of these steps: Language Selection → Name → Trade + District → Certificate → Aadhaar KYC → Skills → Skill Card → Job Matching → Interview Practice → Placement Tracking.
When rewriting messages, understand which step the learner is on and provide context-appropriate encouragement.

Rules:
- Never mention AI, APIs, databases, LLMs, or technical systems.
- Never guarantee a specific job or salary amount.
- Never ask for bank details or passwords.
- Keep messages under 800 characters unless listing multiple jobs.
- If listing jobs, format them cleanly with bullet points and emojis.
- If the brief contains numbered options, preserve them clearly for number-based replies.
- Ask only ONE clarifying question at a time — never bombard.
- Add motivational touches naturally (not forced).
- Match the user's energy — excited → be excited, frustrated → empathize first.
- NEVER say "samajh nahi aaya" or "I don't understand" when rewriting. The system already understood — you are making the reply sound natural.
- If the user typed a number (1, 2, etc.), they were selecting from a menu. Rephrase the response naturally, don't express confusion.

You MUST respond with valid JSON only — no markdown, no code fences, no extra text.
Return a JSON object: { "text": "your reply message", "flags": [{ "code": "...", "severity": "info|warning|urgent", "reason": "...", "field": "..." }] }
For unknown flag.field, use an empty string.`;
}

/**
 * User message for the current turn — contains intent, context, and template.
 * Chat history is sent as separate message turns before this.
 */
function buildReplyUserMessage({ intent, facts, brief, session }) {
  let msg = `[Current message context]\n`;
  msg += `Intent: ${intent}\n`;
  msg += `The user just said: ${JSON.stringify(facts.incomingText ?? '')}`;
  if (facts.replyingTo) {
    msg += `\nThe user is REPLYING TO this bot message: ${JSON.stringify(facts.replyingTo)}`;
  }
  msg += `\n\nSession context: ${JSON.stringify(publicSessionSummary(session))}`;
  msg += `\nKey facts: ${JSON.stringify({ ...facts, chatHistory: undefined, replyingTo: undefined })}`;
  msg += `\n\nTemplate to rewrite (make it sound natural and personal): ${JSON.stringify(brief)}`;
  return msg;
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
  if (script === 'english') return 'simple English';
  if (script === 'hindi') return 'Hindi (Devanagari script)';
  if (script === 'devanagari') return 'Hindi (Devanagari script)';
  if (script === 'marathi') return 'Marathi (मराठी) - use Devanagari script';
  if (script === 'gujarati') return 'Gujarati (ગુજરાતી) - use Gujarati script';
  if (script === 'bengali') return 'Bengali (বাংলা) - use Bengali script';
  return 'Roman Hinglish (Hinglish — mix of Hindi words written in English letters)';
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
