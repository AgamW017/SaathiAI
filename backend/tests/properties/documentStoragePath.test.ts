/**
 * Property 4: Storage Path Format
 *
 * **Validates: Requirements 3.1, 5.2**
 *
 * For any valid phone number and original filename, the generated storage path
 * SHALL match the pattern `documents/{phone}/{timestamp}_{filename}` where
 * {timestamp} is a numeric millisecond epoch value and {phone} and {filename}
 * are the provided inputs.
 *
 * Feature: document-upload-officer-onboarding, Property 4
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DocumentStorageService } from '../../../bot/src/services/documentStorageService.js';

// Instantiate with a mock supabase client (only generateStoragePath is used, no storage calls)
const mockSupabaseClient = {
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'http://mock-url' } }),
    }),
  },
};

const service = new DocumentStorageService({
  supabaseClient: mockSupabaseClient,
  logger: { info: () => {}, warn: () => {}, error: () => {} },
});

/**
 * Generator for valid Indian phone numbers: 10 digits starting with 6-9.
 */
const validPhoneArb = fc
  .tuple(
    fc.constantFrom('6', '7', '8', '9'),
    fc.array(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 9, maxLength: 9 })
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generator for random filenames: non-empty strings with typical filename characters.
 */
const filenameArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0 && !s.includes('/') && !s.includes('\\'));

const STORAGE_PATH_REGEX = /^documents\/\d{10}\/\d+_.+$/;

describe('Property 4: Storage Path Format', () => {
  it('SHALL generate a path matching documents/{phone}/{timestamp}_{filename} for any valid phone and filename', () => {
    fc.assert(
      fc.property(validPhoneArb, filenameArb, (phone, filename) => {
        const path = service.generateStoragePath(phone, filename);

        // Path must match the overall regex pattern
        expect(path).toMatch(STORAGE_PATH_REGEX);

        // Path must start with 'documents/' followed by the exact phone
        expect(path.startsWith(`documents/${phone}/`)).toBe(true);

        // Path must end with the exact filename after the timestamp separator
        const afterPhone = path.slice(`documents/${phone}/`.length);
        const underscoreIdx = afterPhone.indexOf('_');
        expect(underscoreIdx).toBeGreaterThan(0);

        const timestampPart = afterPhone.slice(0, underscoreIdx);
        const filenamePart = afterPhone.slice(underscoreIdx + 1);

        // Timestamp must be a positive integer (millisecond epoch)
        expect(/^\d+$/.test(timestampPart)).toBe(true);
        const ts = Number(timestampPart);
        expect(ts).toBeGreaterThan(0);

        // Filename part must exactly match the input filename
        expect(filenamePart).toBe(filename);
      }),
      { numRuns: 100 }
    );
  });

  it('SHALL produce a timestamp that is a reasonable epoch millisecond value', () => {
    fc.assert(
      fc.property(validPhoneArb, filenameArb, (phone, filename) => {
        const path = service.generateStoragePath(phone, filename);
        const afterPhone = path.slice(`documents/${phone}/`.length);
        const timestampPart = afterPhone.slice(0, afterPhone.indexOf('_'));
        const ts = Number(timestampPart);

        // Timestamp should be a plausible epoch ms (after 2020-01-01 and before 2100-01-01)
        const minEpoch = new Date('2020-01-01').getTime(); // 1577836800000
        const maxEpoch = new Date('2100-01-01').getTime(); // 4102444800000
        expect(ts).toBeGreaterThanOrEqual(minEpoch);
        expect(ts).toBeLessThanOrEqual(maxEpoch);
      }),
      { numRuns: 100 }
    );
  });
});
