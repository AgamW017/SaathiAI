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

  /**
   * Draft a reply using proper multi-turn conversation history.
   * Chat history is sent as real user/model content turns with
   * the persona as systemInstruction, instead of being dumped as JSON.
   */
  async draftReply({ script, intent, facts = {}, brief, session = {} }) {
    if (!this._configured || !this.ai) {
      return {
        text: sanitizeReply(brief),
        flags: [aiUnavailableFlag('reply')]
      };
    }

    try {
      const effectiveLanguage = session?.language ?? script;
      const systemPrompt = buildReplySystemPrompt(effectiveLanguage);

      // Build proper multi-turn contents from chat history
      const history = (facts.chatHistory ?? []).slice(-20);
      const userMessage = buildReplyUserMessage({ intent, facts, brief, session });
      const contents = buildGeminiContents(history, userMessage);

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          responseFormat: {
            text: {
              mimeType: 'application/json',
              schema: replySchema
            }
          }
        }
      });

      const parsed = parseJson(response.text);
      if (parsed !== null) {
        return {
          text: sanitizeReply(parsed.text),
          flags: parsed.flags ?? []
        };
      }
    } catch (error) {
      const msg = `Gemini draftReply failed: ${error.message ?? error}`;
      if (this.logger) this.logger.error({ error }, msg);
      else console.error('[GeminiClient]', msg);
    }

    // AI unavailable — pass the template brief text through untouched.
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
  extract_decision: {
    schema: decisionSchema,
    prompt: ({ text, step, options }) => `
The user is at the step: ${step}.
They were given these options: ${JSON.stringify(options)}.
Based on their message, which option did they choose?
If they clearly chose one of the options, return that exact option string.
If they chose none, or their intent doesn't match any option, return "none".
Message: ${JSON.stringify(text)}
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
- 'stop': user wants to stop, unsubscribe, or opt out of the service entirely. Refusing to answer a specific question (e.g. "I won't give my Aadhaar") is NOT 'stop', it is 'refuse_aadhaar' or 'none'.
- 'refuse_aadhaar': user explicitly refuses to provide Aadhaar details, asks why it's needed, or says they don't have it right now.
- 'start': user wants to start or resume.
- 'status': user wants to check their application status.
- 'placed': user got a job, got placed, or has been selected.
- 'distress': user is in distress, very frustrated, out of money, or expressing desperation (e.g., "thak gaya", "paisa nahi").
- 'none': None of the above. User is answering a question, giving their name, trade, confirmation, or making conversational small talk.

Current step: ${step}

Message: ${JSON.stringify(text)}
`
  },
  extract_name: {
    schema: nameSchema,
    prompt: ({ text, script }) => `
You are SaathiAI's intake classifier for Indian vocational learners.
Extract the learner's personal name from the message.

CRITICAL RULES:
- Do NOT invent a name. Only extract if the user is clearly stating their name.
- Return EMPTY STRING for name if the message is:
  • A question (e.g., "kyu chahiye mera naam", "why do you need my name", "naam kyu batau")
  • A complaint or pushback (e.g., "I don't want to tell", "nahi bataunga")
  • A greeting, command, emoji, phone number, or random text
  • Conversational filler that is NOT a personal name
- If the message contains words like kyu, kya, chahiye, nahi, why, what, how — it is NOT a name. Return empty string.
- Set confidence to 0.0 when returning empty string.

Script: ${script}
Message: ${JSON.stringify(text)}
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
- CRITICAL: If the message is completely unrelated to jobs, trades, or locations (e.g., random chat, weather, greetings), do NOT hallucinate. Return empty strings for trade, district, and state.

Existing profile: ${JSON.stringify(existing)}
Message: ${JSON.stringify(text)}
`
  },
  extract_certificate: {
    schema: certificateSchema,
    prompt: ({ text }) => `
Classify the learner's training/certificate source.
Common normalized types: PMKVY, ITI, JSS, Polytechnic, Private Training Centre, Government Skill Centre, None, Unknown.
Keep certificateType as the learner-friendly label (e.g., if they say "ITI", keep it "ITI").
CRITICAL: If the user explicitly says they do NOT have a certificate, didn't do any training, or says "no" (e.g., "nhi li", "nahi hai", "none", "kuch nahi"), set BOTH certificateType and normalizedType to "None".
CRITICAL: If the message is completely random, conversational filler, or unrelated to certificates, set BOTH certificateType and normalizedType to "Unknown".
Add flags if ambiguous.

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
CRITICAL: If the message is completely random, conversational filler, or unrelated to skills, return an empty array for skills_mentioned.

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

/**
 * System prompt for reply drafting — sent as Gemini systemInstruction.
 * Contains mission, persona, onboarding context, and rules.
 */
function buildReplySystemPrompt(language) {
  return `You are SaathiAI, a WhatsApp assistant that helps job seekers across India get real opportunities.

YOUR MISSION:
You onboard learners through a structured flow — collecting their name, skills, location, training certificates (if any), verifying their identity via Aadhaar KYC, extracting detailed skills, then matching them with verified job opportunities. You also provide interview practice and post-placement support.

Language/script: Match the language and script the user is currently speaking in. If the user changes their language, you must seamlessly switch to match it. If unsure, default to ${languageName(language)}.
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
- **CRITICAL**: If the brief asks the user to upload a photo/image (e.g., Aadhaar card), you MUST explicitly mention that they can send a photo. Do not omit the photo option.
- If the brief contains numbered options, preserve them clearly for number-based replies.
- Ask only ONE clarifying question at a time — never bombard.
- Add motivational touches naturally (not forced).
- Match the user's energy — excited → be excited, frustrated → empathize first.
- NEVER say "samajh nahi aaya" or "I don't understand" when rewriting. The system already understood — you are making the reply sound natural.
- If the user typed a number (1, 2, etc.), they were selecting from a menu. Rephrase the response naturally, don't express confusion.

Return only valid JSON with text and flags. For unknown flag.field, use an empty string.`;
}

/**
 * User message for the current turn — contains intent, context, and template.
 * Chat history is sent as separate content turns before this.
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

/**
 * Build Gemini multi-turn contents from chat history.
 * Merges consecutive same-role messages since Gemini requires alternating
 * user/model turns. Ensures the first content entry is always from 'user'.
 */
function buildGeminiContents(history, currentUserMessage) {
  const contents = [];

  for (const entry of history) {
    const role = entry.role === 'user' ? 'user' : 'model';
    const last = contents[contents.length - 1];

    // Gemini requires alternating roles — merge consecutive same-role messages
    if (last && last.role === role) {
      last.parts[0].text += '\n' + entry.text;
    } else {
      contents.push({ role, parts: [{ text: entry.text }] });
    }
  }

  // Ensure first content is from user (Gemini API requirement)
  if (contents.length > 0 && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: '(conversation start)' }] });
  }

  // Add current context as final user message
  const last = contents[contents.length - 1];
  if (last && last.role === 'user') {
    // Avoid consecutive user turns — merge with separator
    last.parts[0].text += '\n\n---\n\n' + currentUserMessage;
  } else {
    contents.push({ role: 'user', parts: [{ text: currentUserMessage }] });
  }

  return contents;
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
