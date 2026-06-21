import { logger } from '../config/logger.js';
import { llmService } from './llmService.js';

// --- Types ---

export interface ParseResult {
  text: string;
  pages?: number;
  metadata?: Record<string, unknown>;
  tables?: string[][][];
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
  trade: string;
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
  'text/csv',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const DOCLING_TIMEOUT_MS = 3000000;

/** Indian mobile number: exactly 10 digits, first digit 6-9 */
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

const LOW_CONFIDENCE_THRESHOLD = 0.7;

const LEARNER_EXTRACTION_PROMPT = `Extract ITI/PMKVY student records from text. Return JSON array containing: name (string, handle Roman Hindi), phone (string, exactly 10 digits, strip 91/+91 prefixes, must start with 6-9), trade (string, empty if none, DO NOT hallucinate), confidence (float 0.0-1.0). Rules: Deduplicate across pages using phone number. Reconstruct rows split by page breaks. Output strictly valid JSON array.

Text:
`;

// --- CSV helpers ---

/** Parse a single CSV line respecting double-quoted fields. */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Escaped quote inside quoted field
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/** Normalise a CSV header for fuzzy matching: lowercase, strip spaces/underscores/dots. */
function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_.\-]/g, '');
}

const NAME_PATTERNS = /^(name|naam|fullname|learnerfullname|studentname|studentfullname|candidatename)$/;
const PHONE_PATTERNS =
  /^(phone|mobile|whatsapp|number|contact|phoneno|mobileno|mobilenum|phonenumber|contactno|mob)$/;
const TRADE_PATTERNS =
  /^(trade|course|tradename|skill|vyavsay|coursename|tradecoursename|skillname|occupation)$/;

// --- Service ---

export class DocumentParserService {
  private doclingUrl: string;
  private translationCache: Map<string, Record<string, number>> = new Map();

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
   * Route document processing by MIME type and extract learner records.
   *
   * - text/csv: Bypasses Docling; parses with built-in CSV parser + fuzzy header matching.
   * - application/pdf: Processes via Docling, feeds raw text to LLM.
   * - image/jpeg & image/png: Processes all images concurrently via Docling, concatenates
   *   results with PAGE BREAK delimiters, then feeds to LLM.
   *
   * @param files - One or more file buffers (images may be supplied as an array)
   * @param mimeType - MIME type shared by all supplied files
   * @param filenames - Optional original filenames (same order as files)
   * @returns ExtractionResult with valid and invalid entries separated
   * @throws DocumentParseError on unsupported type or Docling failure
   */
  async extractLearnersFromDocument(
    files: Buffer | Buffer[],
    mimeType: string,
    filenames?: string | string[]
  ): Promise<ExtractionResult> {
    const fileArray = Array.isArray(files) ? files : [files];
    const nameArray = Array.isArray(filenames)
      ? filenames
      : filenames
        ? [filenames]
        : fileArray.map((_, i) => `file-${i + 1}`);

    if (mimeType === 'text/csv') {
      const csvResult = this.parseLearnersFromCsv(fileArray[0]);
      if (csvResult.validEntries.length > 0) return csvResult;
      
      // Fallback: Use the new table extraction LLM logic for CSV if fuzzy match failed
      const text = fileArray[0].toString('utf-8');
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const csvTable = lines.map(parseCsvLine);
      return this.extractLearnersFromTables([csvTable]);
    }

    let allText = '';
    let allTables: string[][][] = [];

    if (mimeType === 'application/pdf') {
      const parseResult = await this.callDocling(fileArray[0], mimeType, nameArray[0]);
      allText = parseResult.text;
      if (parseResult.tables) allTables = parseResult.tables;
    } else if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
      const parseResults = await Promise.all(
        fileArray.map((buf, i) => this.callDocling(buf, mimeType, nameArray[i]))
      );
      allText = parseResults.map((r) => r.text).join('\n--- PAGE BREAK ---\n');
      for (const r of parseResults) {
        if (r.tables) allTables.push(...r.tables);
      }
    } else {
      throw new DocumentParseError({
        message: `Unsupported MIME type for learner extraction: "${mimeType}".`,
      });
    }

    // Try new table-based extraction first
    if (allTables.length > 0) {
      const tableResult = await this.extractLearnersFromTables(allTables);
      if (tableResult.validEntries.length > 0) {
        return tableResult;
      }
    }

    // Fallback to old raw-text extraction if tables yielded nothing
    return this.extractLearners(allText);
  }

  /**
   * Process extracted structured tables using LLM column mapping.
   */
  async extractLearnersFromTables(tables: string[][][]): Promise<ExtractionResult> {
    const rawLearners: Array<{ name: string; phone: string; trade: string; confidence: number }> = [];

    for (const table of tables) {
      if (!table || table.length === 0) continue;

      const headerRow = table[0];
      const sampleRow = table.length > 1 ? table[1] : undefined;
      const headerKey = JSON.stringify(headerRow.map((h) => normaliseHeader(h)));

      let mapping: Record<string, number> | undefined;
      let isDataRow = false;

      if (this.translationCache.has(headerKey)) {
        mapping = this.translationCache.get(headerKey);
      } else {
        try {
          const mappingResponse = await llmService.mapTableColumns(headerRow, sampleRow);
          if (mappingResponse.status === 'SKIP') {
            continue;
          } else if (mappingResponse.status === 'HEADER' && mappingResponse.mapping) {
            mapping = mappingResponse.mapping;
            this.translationCache.set(headerKey, mapping);
          } else if (mappingResponse.status === 'DATA' && mappingResponse.mapping) {
            mapping = mappingResponse.mapping;
            isDataRow = true;
          }
        } catch (err) {
          logger.warn({ err }, 'Failed to map table columns, skipping table');
          continue;
        }
      }

      if (!mapping) continue;

      const startIndex = isDataRow ? 0 : 1;
      for (let i = startIndex; i < table.length; i++) {
        const row = table[i];
        const name = mapping.name !== undefined ? (row[mapping.name] ?? '').trim() : '';
        let phone = mapping.phone !== undefined ? (row[mapping.phone] ?? '').trim().replace(/\D/g, '') : '';
        const trade = mapping.trade !== undefined ? (row[mapping.trade] ?? '').trim() : '';

        if (phone.startsWith('91') && phone.length === 12) {
          phone = phone.slice(2);
        } else if (phone.startsWith('+91')) {
          phone = phone.slice(3);
        }

        if (name || phone) {
          rawLearners.push({ name, phone, trade, confidence: 0.95 });
        }
      }
    }

    return this.validateAndSeparateEntries(rawLearners);
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
   * Extract specific fields from a document using Docling + LLM.
   *
   * @param file - The raw file buffer
   * @param mimeType - MIME type of the file
   * @param fields - Field names to extract (e.g. ['institute_name', 'batch_year'])
   * @param filename - Optional original filename
   * @returns Extracted field values, per-field confidence, and the raw Docling text
   * @throws DocumentParseError if Docling fails, Error if LLM fails
   */
  async extractFields(
    file: Buffer,
    mimeType: string,
    fields: string[],
    filename?: string
  ): Promise<{
    extracted: Record<string, string | null>;
    confidence: Record<string, number>;
    rawText: string;
  }> {
    const parseResult = await this.parseDocument(file, mimeType, filename);
    const rawText = parseResult.text;

    const prompt = `Extract fields: ${fields.join(', ')}. Return ONLY a JSON object with these exact keys. Use null for missing fields. Text: ${rawText}`;
    const text = await llmService.generateContent(prompt);

    if (!text) {
      throw new Error('LLM returned empty response for field extraction');
    }

    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const extracted = JSON.parse(cleaned) as Record<string, string | null>;

    // Assign 1.0 confidence for non-null values, 0.0 for null/missing
    const confidence: Record<string, number> = {};
    for (const field of fields) {
      const val = extracted[field];
      confidence[field] = val !== null && val !== undefined && val !== '' ? 1.0 : 0.0;
    }

    return { extracted, confidence, rawText };
  }

  /**
   * Check if a phone number matches Indian mobile format: exactly 10 digits, starts with 6-9.
   */
  isValidIndianMobile(phone: string): boolean {
    return INDIAN_MOBILE_REGEX.test(phone);
  }

  /**
   * Parse a CSV buffer into learner records using fuzzy header matching.
   * Bypasses Docling entirely. Strips +91/91 country-code prefixes from phones.
   */
  private parseLearnersFromCsv(
    fileBuffer: Buffer
  ): ExtractionResult {
    const text = fileBuffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      return {
        validEntries: [],
        invalidEntries: [],
        totalExtracted: 0,
        error: 'CSV has no data rows',
      };
    }

    const rawHeaders = parseCsvLine(lines[0]);
    const headers = rawHeaders.map(normaliseHeader);

    const nameIdx = headers.findIndex((h) => NAME_PATTERNS.test(h));
    const phoneIdx = headers.findIndex((h) => PHONE_PATTERNS.test(h));
    const tradeIdx = headers.findIndex((h) => TRADE_PATTERNS.test(h));

    const rawLearners: Array<{ name: string; phone: string; trade: string; confidence: number }> = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const name = nameIdx >= 0 ? (cols[nameIdx] ?? '').trim() : '';
      const rawPhone = phoneIdx >= 0 ? (cols[phoneIdx] ?? '').trim().replace(/\D/g, '') : '';
      const phone =
        rawPhone.startsWith('91') && rawPhone.length === 12
          ? rawPhone.slice(2)
          : rawPhone.startsWith('+91')
            ? rawPhone.slice(3)
            : rawPhone;
      const trade = tradeIdx >= 0 ? (cols[tradeIdx] ?? '').trim() : '';

      if (name || phone) {
        rawLearners.push({ name, phone, trade, confidence: 0.95 });
      }
    }

    return this.validateAndSeparateEntries(rawLearners);
  }

  /**
   * Call the LLM service (Groq primary, Gemini fallback) to extract learner data from text.
   */
  private async callLlmForExtraction(
    rawText: string
  ): Promise<Array<{ name: string; phone: string; trade: string; confidence: number }>> {
    const prompt = LEARNER_EXTRACTION_PROMPT + rawText;
    const text = await llmService.generateContent(prompt);

    if (!text) {
      throw new Error('LLM returned empty response');
    }

    return this.parseGeminiResponse(text);
  }

  /**
   * Parse the LLM text response into structured learner data.
   */
  private parseGeminiResponse(
    text: string
  ): Array<{ name: string; phone: string; trade: string; confidence: number }> {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    // Extract JSON array from response — handles preamble text before the array
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      cleaned = arrayMatch[0];
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
        trade: typeof obj.trade === 'string' ? obj.trade.trim() : '',
        confidence: typeof obj.confidence === 'number' ? obj.confidence : 0,
      };
    });
  }

  /**
   * Validate extracted entries and separate into valid/invalid sets.
   * Validates phone numbers against Indian mobile format and flags low-confidence entries.
   */
  private validateAndSeparateEntries(
    rawLearners: Array<{ name: string; phone: string; trade?: string; confidence: number }>
  ): ExtractionResult {
    const validEntries: ExtractedLearner[] = [];
    const invalidEntries: ExtractedLearner[] = [];

    for (const learner of rawLearners) {
      const phoneValid = this.isValidIndianMobile(learner.phone);
      const lowConfidence = learner.confidence < LOW_CONFIDENCE_THRESHOLD;

      const entry: ExtractedLearner = {
        name: learner.name,
        phone: learner.phone,
        trade: learner.trade ?? '',
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
        tables?: string[][][];
      };

      return {
        text: data.text ?? '',
        pages: data.pages ?? undefined,
        metadata: data.metadata ?? undefined,
        tables: data.tables ?? undefined,
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
