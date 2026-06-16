/**
 * LLM Client Facade — Groq-primary with Gemini fallback.
 *
 * Drop-in replacement for GeminiClient. Same API surface:
 *   - generateJson({ prompt, schema })
 *   - draftReply({ script, intent, facts, brief, session })
 *   - runTask(task, payload)
 *   - isConfigured()
 *
 * Tries Groq first. If Groq fails (network error, rate limit, timeout, API error),
 * falls back to Gemini transparently. Callers don't need to know which provider answered.
 */

import { GroqClient } from './groqClient.js';
import { GeminiClient } from './geminiClient.js';

export class LlmClient {
  constructor(config, logger = null) {
    this.logger = logger;

    this.groq = new GroqClient({
      apiKey: config.groq?.apiKey || '',
      model: config.groq?.model || 'llama-3.3-70b-versatile',
      timeoutMs: config.groq?.timeoutMs || 30_000
    }, logger);

    this.gemini = new GeminiClient({
      apiKey: config.gemini?.apiKey || '',
      model: config.gemini?.model || 'gemini-3.5-flash'
    }, logger);
  }

  isConfigured() {
    return this.groq.isConfigured() || this.gemini.isConfigured();
  }

  /**
   * Generate JSON using Groq first, falling back to Gemini.
   */
  async generateJson({ prompt, schema }) {
    // Try Groq first
    if (this.groq.isConfigured()) {
      try {
        const result = await this.groq.generateJson({ prompt, schema });
        if (result !== null) {
          this._log('info', 'LLM response served by Groq');
          return result;
        }
      } catch (error) {
        this._log('warn', `Groq generateJson failed, falling back to Gemini: ${error.message}`);
      }
    }

    // Fallback to Gemini
    if (this.gemini.isConfigured()) {
      this._log('info', 'Falling back to Gemini for generateJson');
      return this.gemini.generateJson({ prompt, schema });
    }

    return null;
  }

  /**
   * Draft a reply using Groq first, falling back to Gemini.
   */
  async draftReply({ script, intent, facts = {}, brief, session = {} }) {
    // Try Groq first
    if (this.groq.isConfigured()) {
      try {
        const result = await this.groq.draftReply({ script, intent, facts, brief, session });
        if (result !== null) {
          this._log('info', 'draftReply served by Groq');
          return result;
        }
      } catch (error) {
        this._log('warn', `Groq draftReply failed, falling back to Gemini: ${error.message}`);
      }
    }

    // Fallback to Gemini
    if (this.gemini.isConfigured()) {
      this._log('info', 'Falling back to Gemini for draftReply');
      return this.gemini.draftReply({ script, intent, facts, brief, session });
    }

    // Both unavailable — return template fallback
    return {
      text: sanitizeReply(brief),
      flags: [{ code: 'ai_unavailable', severity: 'warning', reason: 'Both Groq and Gemini are unavailable', field: 'reply' }]
    };
  }

  /**
   * Run a named task using Groq first, falling back to Gemini.
   */
  async runTask(task, payload) {
    // Try Groq first
    if (this.groq.isConfigured()) {
      try {
        const result = await this.groq.runTask(task, payload);
        if (result !== null) {
          this._log('info', `runTask(${task}) served by Groq`);
          return result;
        }
      } catch (error) {
        this._log('warn', `Groq runTask(${task}) failed, falling back to Gemini: ${error.message}`);
      }
    }

    // Fallback to Gemini
    if (this.gemini.isConfigured()) {
      this._log('info', `Falling back to Gemini for runTask(${task})`);
      return this.gemini.runTask(task, payload);
    }

    // Both unavailable
    return null;
  }

  _log(level, message) {
    if (this.logger && this.logger[level]) {
      this.logger[level](message);
    } else if (level === 'warn') {
      console.warn('[LlmClient]', message);
    } else if (level === 'error') {
      console.error('[LlmClient]', message);
    }
    // Skip info-level console logs to avoid noise
  }
}

function sanitizeReply(text = '') {
  return text.toString().trim().replace(/\n{3,}/g, '\n\n');
}
