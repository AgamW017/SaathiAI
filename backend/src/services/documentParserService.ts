import { logger } from '../config/logger.js';
import { llmService } from './llmService.js';

// --- Types ---

export interface ParseResult {
  text: string;
  pages?: number;
  metadata?: Record<string, unknown>;
}

export interface ParseError {
  message: string;
  documentName?: string;
  failedPages?: number[];
  failedSections?: string[];
}

export interface ExtractedLearner {
  name: string;
  phone: string;
  confidence: number;
  valid: boolean;
  lowConfidence: boolean;
  invalidReason?: string;
}

export interface ExtractionResult {
  validEntries: ExtractedLearner[];
  invalidEntries: ExtractedLearner[];
  totalExtracted: number;
  error?: string;
}

export class DocumentParseError extends Error {
  public readonly details: ParseError;

  constructor(details: ParseError) {
    super(details.message);
    this.name = 'DocumentParseError';
    this.details = details;
  }
}

// --- Constants ---

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const DOCLING_TIMEOUT_MS = 30_000; // 30 seconds

/** Indian mobile number: exactly 10 digits, first digit 6-9 */
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

const LOW_CONFIDENCE_THRESHOLD = 0.7;

const LEARNER_EXTRACTION_PROMPT = `You are a data extraction assistant. Extract all student/learner names and their WhatsApp or phone numbers from the following text.

Return a JSON array where each element has:
- "name": the student's full name (string)
- "phone": the phone number as digits only, without country code (string)
- "confidence": a number between 0 and 1 indicating how confident you are in this extraction

Rules:
- Strip any country code prefix (+91, 91) from phone numbers
- Remove spaces, dashes, and other separators from phone numbers
- If a name is partially readable, include it with lower confidence
- If a phone number is partially readable, include your best guess with lower confidence
- Only include entries where you can identify at least a name OR a phone number
- Return ONLY the JSON array, no other text or markdown formatting

Text to extract from:
`;

// --- Service ---

export class DocumentParserService {
  private doclingUrl: string;

  constructor(doclingUrl?: string) {
    this.doclingUrl =
      doclingUrl ||
      process.env.DOCLING_API_URL ||
      'http://localhost:5000/convert';
  }

  /**
   * Parse a document using Docling for text extraction.
   *
   * @param file - The raw file buffer
   * @param mimeType - The MIME type of the uploaded file
   * @param filename - Optional original filename (used in error reporting)
   * @returns Extracted text content with optional page count and metadata
   * @throws DocumentParseError on validation failure, timeout, or Docling error
   */
  async parseDocument(
    file: Buffer,
    mimeType: string,
    filename?: string
  ): Promise<ParseResult> {
    // 1. Validate MIME type
    if (!this.validateFormat(mimeType)) {
      throw new DocumentParseError({
        message: `Unsupported file format: "${mimeType}". Accepted formats: PDF, JPEG, PNG, DOCX.`,
        documentName: filename,
      });
    }

    // 2. Validate file size
    if (!this.validateSize(file)) {
      throw new DocumentParseError({
        message: `File size exceeds the maximum allowed limit of 10MB. Received: ${(file.length / (1024 * 1024)).toFixed(2)}MB.`,
        documentName: filename,
      });
    }

    // 3. Call Docling with 30-second timeout
    return this.callDocling(file, mimeType, filename);
  }

  /**
   * Check whether the given MIME type is in the accepted list.
   */
  validateFormat(mimeType: string): boolean {
    return ACCEPTED_MIME_TYPES.includes(mimeType as AcceptedMimeType);
  }

  /**
   * Check whether the file size is within the 10MB limit.
   */
  validateSize(file: Buffer): boolean {
    return file.length <= MAX_FILE_SIZE_BYTES;
  }

  /**
   * Use LLM (Groq with Gemini fallback) to extract student names and WhatsApp numbers from raw text.
   *
   * Validates phone numbers against Indian mobile format (10 digits, starts with 6-9),
   * separates valid from invalid entries, and flags low-confidence extractions.
   *
   * @param rawText - The raw text extracted from a document
   * @returns ExtractionResult with valid and invalid entries separated
   */
  async extractLearners(rawText: string): Promise<ExtractionResult> {
    if (!rawText || rawText.trim().length === 0) {
      return {
        validEntries: [],
        invalidEntries: [],
        totalExtracted: 0,
        error: 'No text provided for extraction',
      };
    }

    try {
      const rawLearners = await this.callLlmForExtraction(rawText);
      return this.validateAndSeparateEntries(rawLearners);
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Unknown error during extraction';
      logger.error({ error }, 'Learner extraction failed');
      return {
        validEntries: [],
        invalidEntries: [],
        totalExtracted: 0,
        error: msg,
      };
    }
  }

  /**
   * Call the LLM service (Groq primary, Gemini fallback) to extract learner data from text.
   */
  private async callLlmForExtraction(
    rawText: string
  ): Promise<Array<{ name: string; phone: string; confidence: number }>> {
    const prompt = LEARNER_EXTRACTION_PROMPT + rawText;
    const text = await llmService.generateContent(prompt);

    if (!text) {
      throw new Error('LLM returned empty response');
    }

    return this.parseGeminiResponse(text);
  }

  /**
   * Parse the Gemini LLM text response into structured learner data.
   */
  private parseGeminiResponse(
    text: string
  ): Array<{ name: string; phone: string; confidence: number }> {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      throw new Error('Gemini response is not a JSON array');
    }

    return parsed.map((entry: unknown) => {
      const obj = entry as Record<string, unknown>;
      return {
        name: typeof obj.name === 'string' ? obj.name.trim() : '',
        phone: typeof obj.phone === 'string' ? obj.phone.trim().replace(/\D/g, '') : '',
        confidence: typeof obj.confidence === 'number' ? obj.confidence : 0,
      };
    });
  }

  /**
   * Validate extracted entries and separate into valid/invalid sets.
   * Validates phone numbers against Indian mobile format and flags low-confidence entries.
   */
  private validateAndSeparateEntries(
    rawLearners: Array<{ name: string; phone: string; confidence: number }>
  ): ExtractionResult {
    const validEntries: ExtractedLearner[] = [];
    const invalidEntries: ExtractedLearner[] = [];

    for (const learner of rawLearners) {
      const phoneValid = this.isValidIndianMobile(learner.phone);
      const lowConfidence = learner.confidence < LOW_CONFIDENCE_THRESHOLD;

      const entry: ExtractedLearner = {
        name: learner.name,
        phone: learner.phone,
        confidence: learner.confidence,
        valid: phoneValid,
        lowConfidence,
      };

      if (!phoneValid) {
        entry.invalidReason = this.getPhoneInvalidReason(learner.phone);
        invalidEntries.push(entry);
      } else {
        validEntries.push(entry);
      }
    }

    return {
      validEntries,
      invalidEntries,
      totalExtracted: rawLearners.length,
    };
  }

  /**
   * Check if a phone number matches Indian mobile format: exactly 10 digits, starts with 6-9.
   */
  isValidIndianMobile(phone: string): boolean {
    return INDIAN_MOBILE_REGEX.test(phone);
  }

  /**
   * Get a human-readable reason why a phone number is invalid.
   */
  private getPhoneInvalidReason(phone: string): string {
    if (!phone || phone.length === 0) {
      return 'Phone number is empty';
    }
    if (!/^\d+$/.test(phone)) {
      return 'Phone number contains non-numeric characters';
    }
    if (phone.length !== 10) {
      return `Phone number has ${phone.length} digits (expected 10)`;
    }
    if (!/^[6-9]/.test(phone)) {
      return `Phone number starts with ${phone[0]} (must start with 6-9)`;
    }
    return 'Invalid phone number format';
  }

  /**
   * Send the document to the Docling REST API for text extraction.
   */
  private async callDocling(
    file: Buffer,
    mimeType: string,
    filename?: string
  ): Promise<ParseResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOCLING_TIMEOUT_MS);

    try {
      // Build multipart/form-data body
      const blob = new Blob([new Uint8Array(file)], { type: mimeType });
      const formData = new FormData();
      formData.append('file', blob, filename || 'document');

      logger.info(
        { url: this.doclingUrl, mimeType, fileSize: file.length, filename },
        'Calling Docling for document parsing'
      );

      const response = await fetch(this.doclingUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await this.safeParseResponseBody(response);
        const failedPages = errorBody?.failed_pages ?? errorBody?.failedPages;
        const failedSections =
          errorBody?.failed_sections ?? errorBody?.failedSections;

        throw new DocumentParseError({
          message:
            errorBody?.message ||
            errorBody?.error ||
            `Docling returned HTTP ${response.status}: ${response.statusText}`,
          documentName: filename,
          failedPages: failedPages ?? undefined,
          failedSections: failedSections ?? undefined,
        });
      }

      const data = (await response.json()) as {
        text?: string;
        pages?: number;
        metadata?: Record<string, unknown>;
      };

      return {
        text: data.text ?? '',
        pages: data.pages ?? undefined,
        metadata: data.metadata ?? undefined,
      };
    } catch (error: unknown) {
      // Re-throw DocumentParseError directly
      if (error instanceof DocumentParseError) {
        throw error;
      }

      // Handle abort/timeout
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TimeoutError')
      ) {
        logger.error(
          { filename, timeout: DOCLING_TIMEOUT_MS },
          'Docling request timed out'
        );
        throw new DocumentParseError({
          message: `Document parsing timed out after 30 seconds. The service did not respond in time.`,
          documentName: filename,
        });
      }

      // Handle network/other errors
      const msg =
        error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error({ error, filename }, 'Docling request failed');
      throw new DocumentParseError({
        message: `Failed to parse document: ${msg}`,
        documentName: filename,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Safely attempt to parse the response body as JSON for error details.
   */
  private async safeParseResponseBody(
    response: Response
  ): Promise<Record<string, any> | null> {
    try {
      return (await response.json()) as Record<string, any>;
    } catch {
      return null;
    }
  }
}

// --- Singleton export ---

export const documentParserService = new DocumentParserService();
