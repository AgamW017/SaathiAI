import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocumentParserService } from '../../src/services/documentParserService.js';

describe('DocumentParserService — extractLearners', () => {
  let service: DocumentParserService;
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    service = new DocumentParserService();
    process.env = { ...ORIGINAL_ENV, GEMINI_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  describe('Indian mobile phone validation', () => {
    it('accepts valid 10-digit numbers starting with 6-9', () => {
      expect(service.isValidIndianMobile('6123456789')).toBe(true);
      expect(service.isValidIndianMobile('7000000000')).toBe(true);
      expect(service.isValidIndianMobile('8999999999')).toBe(true);
      expect(service.isValidIndianMobile('9876543210')).toBe(true);
    });

    it('rejects numbers starting with 0-5', () => {
      expect(service.isValidIndianMobile('0123456789')).toBe(false);
      expect(service.isValidIndianMobile('1234567890')).toBe(false);
      expect(service.isValidIndianMobile('5555555555')).toBe(false);
    });

    it('rejects numbers with wrong length', () => {
      expect(service.isValidIndianMobile('912345678')).toBe(false); // 9 digits
      expect(service.isValidIndianMobile('91234567890')).toBe(false); // 11 digits
      expect(service.isValidIndianMobile('')).toBe(false);
    });

    it('rejects numbers with non-numeric characters', () => {
      expect(service.isValidIndianMobile('91234 5678')).toBe(false);
      expect(service.isValidIndianMobile('9123-45678')).toBe(false);
      expect(service.isValidIndianMobile('+919876543')).toBe(false);
    });
  });

  describe('extractLearners — error handling', () => {
    it('returns error when GEMINI_API_KEY is not set', async () => {
      delete process.env.GEMINI_API_KEY;

      const result = await service.extractLearners('Some student text');

      expect(result.validEntries).toEqual([]);
      expect(result.invalidEntries).toEqual([]);
      expect(result.totalExtracted).toBe(0);
      expect(result.error).toBe('Gemini API key not configured');
    });

    it('returns error when rawText is empty', async () => {
      const result = await service.extractLearners('');

      expect(result.validEntries).toEqual([]);
      expect(result.invalidEntries).toEqual([]);
      expect(result.totalExtracted).toBe(0);
      expect(result.error).toBe('No text provided for extraction');
    });

    it('returns error when rawText is whitespace-only', async () => {
      const result = await service.extractLearners('   \n\t  ');

      expect(result.validEntries).toEqual([]);
      expect(result.invalidEntries).toEqual([]);
      expect(result.totalExtracted).toBe(0);
      expect(result.error).toBe('No text provided for extraction');
    });

    it('handles Gemini API errors gracefully', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Quota exceeded' } }), {
          status: 429,
          statusText: 'Too Many Requests',
        })
      );

      const result = await service.extractLearners('Some student text');

      expect(result.validEntries).toEqual([]);
      expect(result.invalidEntries).toEqual([]);
      expect(result.totalExtracted).toBe(0);
      expect(result.error).toContain('429');

      mockFetch.mockRestore();
    });

    it('handles Gemini returning empty response', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ candidates: [] }), { status: 200 })
      );

      const result = await service.extractLearners('Some student text');

      expect(result.validEntries).toEqual([]);
      expect(result.invalidEntries).toEqual([]);
      expect(result.error).toContain('empty response');

      mockFetch.mockRestore();
    });

    it('handles malformed JSON from Gemini', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'not valid json at all' }] } }],
          }),
          { status: 200 }
        )
      );

      const result = await service.extractLearners('Some student text');

      expect(result.validEntries).toEqual([]);
      expect(result.invalidEntries).toEqual([]);
      expect(result.error).toBeDefined();

      mockFetch.mockRestore();
    });
  });

  describe('extractLearners — successful extraction', () => {
    it('separates valid and invalid entries correctly', async () => {
      const geminiResponse = JSON.stringify([
        { name: 'Ravi Kumar', phone: '9876543210', confidence: 0.95 },
        { name: 'Priya Singh', phone: '123456', confidence: 0.8 },
        { name: 'Amit Patel', phone: '7000000000', confidence: 0.6 },
      ]);

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: geminiResponse }] } }],
          }),
          { status: 200 }
        )
      );

      const result = await service.extractLearners('Student list...');

      expect(result.totalExtracted).toBe(3);
      expect(result.validEntries).toHaveLength(2); // Ravi and Amit (valid phones)
      expect(result.invalidEntries).toHaveLength(1); // Priya (invalid phone)

      // Check valid entry with high confidence
      const ravi = result.validEntries.find((e) => e.name === 'Ravi Kumar');
      expect(ravi).toBeDefined();
      expect(ravi!.phone).toBe('9876543210');
      expect(ravi!.valid).toBe(true);
      expect(ravi!.lowConfidence).toBe(false);

      // Check valid entry with low confidence
      const amit = result.validEntries.find((e) => e.name === 'Amit Patel');
      expect(amit).toBeDefined();
      expect(amit!.phone).toBe('7000000000');
      expect(amit!.valid).toBe(true);
      expect(amit!.lowConfidence).toBe(true); // confidence 0.6 < 0.7

      // Check invalid entry
      const priya = result.invalidEntries[0];
      expect(priya.name).toBe('Priya Singh');
      expect(priya.valid).toBe(false);
      expect(priya.invalidReason).toContain('digits');

      mockFetch.mockRestore();
    });

    it('handles Gemini response with markdown code fences', async () => {
      const geminiResponse = '```json\n[{"name": "Test Student", "phone": "9123456789", "confidence": 0.9}]\n```';

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: geminiResponse }] } }],
          }),
          { status: 200 }
        )
      );

      const result = await service.extractLearners('Some text');

      expect(result.totalExtracted).toBe(1);
      expect(result.validEntries).toHaveLength(1);
      expect(result.validEntries[0].name).toBe('Test Student');
      expect(result.validEntries[0].phone).toBe('9123456789');

      mockFetch.mockRestore();
    });

    it('strips non-digit characters from phone numbers', async () => {
      const geminiResponse = JSON.stringify([
        { name: 'Student A', phone: '91 9876-543210', confidence: 0.85 },
        { name: 'Student B', phone: '+91-7654321098', confidence: 0.9 },
      ]);

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: geminiResponse }] } }],
          }),
          { status: 200 }
        )
      );

      const result = await service.extractLearners('Some text');

      // "91 9876-543210" → "919876543210" (12 digits — invalid length)
      // "+91-7654321098" → "917654321098" (12 digits — invalid length)
      // Both will be invalid because after stripping non-digits, they have 12 digits
      expect(result.totalExtracted).toBe(2);
      expect(result.invalidEntries).toHaveLength(2);

      mockFetch.mockRestore();
    });

    it('flags entries with confidence below 0.7 as low-confidence', async () => {
      const geminiResponse = JSON.stringify([
        { name: 'High Conf', phone: '9000000001', confidence: 0.95 },
        { name: 'Med Conf', phone: '8000000002', confidence: 0.7 },
        { name: 'Low Conf', phone: '7000000003', confidence: 0.69 },
        { name: 'Very Low', phone: '6000000004', confidence: 0.3 },
      ]);

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: geminiResponse }] } }],
          }),
          { status: 200 }
        )
      );

      const result = await service.extractLearners('Some text');

      expect(result.validEntries).toHaveLength(4);

      const high = result.validEntries.find((e) => e.name === 'High Conf')!;
      expect(high.lowConfidence).toBe(false);

      const med = result.validEntries.find((e) => e.name === 'Med Conf')!;
      expect(med.lowConfidence).toBe(false); // 0.7 is exactly the threshold, not below

      const low = result.validEntries.find((e) => e.name === 'Low Conf')!;
      expect(low.lowConfidence).toBe(true); // 0.69 < 0.7

      const veryLow = result.validEntries.find((e) => e.name === 'Very Low')!;
      expect(veryLow.lowConfidence).toBe(true); // 0.3 < 0.7

      mockFetch.mockRestore();
    });

    it('returns no error on successful extraction', async () => {
      const geminiResponse = JSON.stringify([
        { name: 'Student', phone: '9876543210', confidence: 0.9 },
      ]);

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: geminiResponse }] } }],
          }),
          { status: 200 }
        )
      );

      const result = await service.extractLearners('Some text');

      expect(result.error).toBeUndefined();

      mockFetch.mockRestore();
    });
  });

  describe('phone invalidReason messages', () => {
    it('provides reason for empty phone', async () => {
      const geminiResponse = JSON.stringify([
        { name: 'No Phone', phone: '', confidence: 0.8 },
      ]);

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: geminiResponse }] } }],
          }),
          { status: 200 }
        )
      );

      const result = await service.extractLearners('Some text');

      expect(result.invalidEntries[0].invalidReason).toBe('Phone number is empty');

      mockFetch.mockRestore();
    });

    it('provides reason for wrong digit count', async () => {
      const geminiResponse = JSON.stringify([
        { name: 'Short Phone', phone: '98765', confidence: 0.8 },
      ]);

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: geminiResponse }] } }],
          }),
          { status: 200 }
        )
      );

      const result = await service.extractLearners('Some text');

      expect(result.invalidEntries[0].invalidReason).toContain('5 digits');
      expect(result.invalidEntries[0].invalidReason).toContain('expected 10');

      mockFetch.mockRestore();
    });

    it('provides reason for number starting with wrong digit', async () => {
      const geminiResponse = JSON.stringify([
        { name: 'Bad Start', phone: '5123456789', confidence: 0.8 },
      ]);

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: geminiResponse }] } }],
          }),
          { status: 200 }
        )
      );

      const result = await service.extractLearners('Some text');

      expect(result.invalidEntries[0].invalidReason).toContain('starts with 5');
      expect(result.invalidEntries[0].invalidReason).toContain('must start with 6-9');

      mockFetch.mockRestore();
    });
  });
});
