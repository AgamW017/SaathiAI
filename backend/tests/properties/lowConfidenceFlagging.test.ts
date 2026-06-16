/**
 * Property 20: Low-Confidence Extraction Flagging
 *
 * **Validates: Requirements 10.3**
 *
 * For any LLM extraction result where a learner entry has a confidence score
 * below the configured threshold (0.7), that entry SHALL be marked as
 * low-confidence in the preview. For entries with confidence >= 0.7,
 * lowConfidence SHALL be false.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { DocumentParserService } from '../../src/services/documentParserService.js';

const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** Generate a valid Indian mobile phone number (10 digits, starts with 6-9) */
const validPhoneArb = fc
  .tuple(
    fc.constantFrom('6', '7', '8', '9'),
    fc.array(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 9, maxLength: 9 }).map((arr) => arr.join(''))
  )
  .map(([first, rest]) => first + rest);

/** Generate a learner name */
const nameArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/** Generate a confidence score between 0 and 1 */
const confidenceArb = fc.double({ min: 0, max: 1, noNaN: true });

/** Generate a confidence score strictly below threshold */
const lowConfidenceArb = fc.double({ min: 0, max: 0.699, noNaN: true });

/** Generate a confidence score at or above threshold */
const highConfidenceArb = fc.double({ min: 0.7, max: 1, noNaN: true });

/** Generate a learner entry with a valid phone and given confidence range */
const learnerEntryArb = (confArb: fc.Arbitrary<number>) =>
  fc.tuple(nameArb, validPhoneArb, confArb).map(([name, phone, confidence]) => ({
    name,
    phone,
    confidence,
  }));

/**
 * Helper to mock fetch so that Gemini returns the given entries as its response.
 */
function mockGeminiFetch(entries: Array<{ name: string; phone: string; confidence: number }>) {
  const responseJson = JSON.stringify(entries);
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: responseJson }],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  );
}

describe('Property 20: Low-Confidence Extraction Flagging', () => {
  let service: DocumentParserService;

  beforeEach(() => {
    service = new DocumentParserService();
    vi.stubEnv('GEMINI_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('entries with confidence < 0.7 SHALL be flagged as lowConfidence: true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(learnerEntryArb(lowConfidenceArb), { minLength: 1, maxLength: 10 }),
        async (entries) => {
          const fetchMock = mockGeminiFetch(entries);

          const result = await service.extractLearners('Some document text with student data');

          // All entries have valid phones, so they should be in validEntries
          for (const entry of result.validEntries) {
            expect(entry.lowConfidence).toBe(true);
          }
          expect(result.validEntries.length).toBe(entries.length);

          fetchMock.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('entries with confidence >= 0.7 SHALL be flagged as lowConfidence: false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(learnerEntryArb(highConfidenceArb), { minLength: 1, maxLength: 10 }),
        async (entries) => {
          const fetchMock = mockGeminiFetch(entries);

          const result = await service.extractLearners('Some document text with student data');

          // All entries have valid phones, so they should be in validEntries
          for (const entry of result.validEntries) {
            expect(entry.lowConfidence).toBe(false);
          }
          expect(result.validEntries.length).toBe(entries.length);

          fetchMock.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mixed confidence entries: each is flagged correctly based on threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(learnerEntryArb(confidenceArb), { minLength: 1, maxLength: 15 }),
        async (entries) => {
          const fetchMock = mockGeminiFetch(entries);

          const result = await service.extractLearners('Some document text with student data');

          // Build a lookup from the input entries by phone
          const inputByPhone = new Map(entries.map((e) => [e.phone, e.confidence]));

          for (const entry of result.validEntries) {
            const inputConfidence = inputByPhone.get(entry.phone);
            if (inputConfidence !== undefined) {
              if (inputConfidence < LOW_CONFIDENCE_THRESHOLD) {
                expect(entry.lowConfidence).toBe(true);
              } else {
                expect(entry.lowConfidence).toBe(false);
              }
            }
          }

          fetchMock.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('low-confidence entries with valid phones appear in validEntries (not excluded)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(learnerEntryArb(lowConfidenceArb), { minLength: 1, maxLength: 5 }),
        async (entries) => {
          const fetchMock = mockGeminiFetch(entries);

          const result = await service.extractLearners('Some document text with student data');

          // Low-confidence entries with valid phones should still be in validEntries
          // (they are flagged, not excluded)
          expect(result.validEntries.length).toBe(entries.length);
          expect(result.invalidEntries.length).toBe(0);

          fetchMock.mockRestore();
        }
      ),
      { numRuns: 50 }
    );
  });
});
