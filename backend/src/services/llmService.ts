/**
 * LLM Service — Groq-primary with Gemini fallback.
 *
 * Provides a simple `generateContent(prompt)` method that tries Groq first,
 * then falls back to Gemini if Groq fails. Transparent to callers.
 */

import { logger } from '../config/logger.js';

// --- Constants ---

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_TIMEOUT_MS = 30_000;

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_TIMEOUT_MS = 60_000;

// --- Types ---

export interface LlmResponse {
  text: string;
  provider: 'groq' | 'gemini';
}

// --- Service ---

export class LlmService {
  constructor() {
    // API keys are read lazily at call time to support test env manipulation
  }

  private get groqApiKey(): string {
    return process.env.GROQ_API_KEY ?? '';
  }

  private get geminiApiKey(): string {
    return process.env.GEMINI_API_KEY ?? '';
  }

  /**
   * Generate content using Groq first, falling back to Gemini.
   *
   * @param prompt - The text prompt to send to the LLM
   * @returns The generated text content
   * @throws Error if both providers fail
   */
  async generateContent(prompt: string): Promise<string> {
    // Try Groq first
    if (this.groqApiKey) {
      try {
        const result = await this.callGroq(prompt);
        logger.info('LLM response served by Groq');
        return result;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn({ error }, `Groq failed, falling back to Gemini: ${msg}`);
      }
    }

    // Fallback to Gemini
    if (this.geminiApiKey) {
      try {
        const result = await this.callGemini(prompt);
        logger.info('LLM response served by Gemini (fallback)');
        return result;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Both LLM providers failed. Gemini error: ${msg}`);
      }
    }

    throw new Error('No LLM API keys configured (neither GROQ_API_KEY nor GEMINI_API_KEY)');
  }

  /**
   * Generate content and return which provider was used.
   */
  async generateContentWithMeta(prompt: string): Promise<LlmResponse> {
    // Try Groq first
    if (this.groqApiKey) {
      try {
        const text = await this.callGroq(prompt);
        logger.info('LLM response served by Groq');
        return { text, provider: 'groq' };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn({ error }, `Groq failed, falling back to Gemini: ${msg}`);
      }
    }

    // Fallback to Gemini
    if (this.geminiApiKey) {
      try {
        const text = await this.callGemini(prompt);
        logger.info('LLM response served by Gemini (fallback)');
        return { text, provider: 'gemini' };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Both LLM providers failed. Gemini error: ${msg}`);
      }
    }

    throw new Error('No LLM API keys configured (neither GROQ_API_KEY nor GEMINI_API_KEY)');
  }

  /**
   * Call Groq's OpenAI-compatible API.
   */
  private async callGroq(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.groqApiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await this.safeParseBody(response);
        throw new Error(
          `Groq API returned HTTP ${response.status}: ${errorBody?.error?.message || response.statusText}`
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Groq returned empty response');
      }

      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Call Google Gemini REST API.
   */
  private async callGemini(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const url = `${GEMINI_API_URL}?key=${this.geminiApiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await this.safeParseBody(response);
        throw new Error(
          `Gemini API returned HTTP ${response.status}: ${errorBody?.error?.message || response.statusText}`
        );
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini returned empty response');
      }

      return text;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Safely attempt to parse a response body as JSON.
   */
  private async safeParseBody(response: Response): Promise<Record<string, any> | null> {
    try {
      return (await response.json()) as Record<string, any>;
    } catch {
      return null;
    }
  }
}

// --- Singleton export ---

export const llmService = new LlmService();
