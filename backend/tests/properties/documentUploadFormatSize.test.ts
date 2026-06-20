/**
 * Property 6: File Upload Validation (Format and Size)
 *
 * Feature: document-upload-officer-onboarding, Property 6
 *
 * **Validates: Requirements 3.4, 3.5, 4.5**
 *
 * For any file, the upload validation function SHALL accept it if and only if
 * its MIME type is one of {image/png, image/jpeg, application/pdf} AND its size
 * in bytes is at most 10,485,760 (10 MB). Files violating either condition
 * SHALL be rejected.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DocumentStorageService } from '../../../bot/src/services/documentStorageService.js';

// Mock supabase client (only needed for constructor, not used in validateFile)
const mockSupabaseClient = {
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'http://mock.url' } }),
    }),
  },
};

const service = new DocumentStorageService({
  supabaseClient: mockSupabaseClient,
  logger: { info: () => {}, warn: () => {}, error: () => {} },
});

const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'application/pdf'] as const;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10,485,760

describe('Property 6: File Upload Validation (Format and Size)', () => {
  it('SHALL accept a file if and only if MIME is in accepted set AND size ≤ 10MB', () => {
    /**
     * **Validates: Requirements 3.4, 3.5, 4.5**
     *
     * For any random MIME type string and file size, validateFile returns
     * valid: true exactly when the MIME is in {image/png, image/jpeg, application/pdf}
     * AND size ≤ 10,485,760.
     */
    const mimeArb = fc.oneof(
      // ~50% chance of accepted MIME type
      fc.constantFrom(...ACCEPTED_MIME_TYPES),
      // ~50% chance of arbitrary (likely rejected) MIME type
      fc.string({ minLength: 1, maxLength: 80 })
    );

    const sizeArb = fc.oneof(
      // Values around the boundary
      fc.constantFrom(0, 1, MAX_FILE_SIZE_BYTES - 1, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_BYTES + 1),
      // Random sizes up to 20MB
      fc.integer({ min: 0, max: 20 * 1024 * 1024 })
    );

    fc.assert(
      fc.property(mimeArb, sizeArb, (mimeType, sizeBytes) => {
        const result = service.validateFile(mimeType, sizeBytes);

        const isAcceptedMime = ACCEPTED_MIME_TYPES.includes(mimeType as any);
        const isAcceptedSize = sizeBytes <= MAX_FILE_SIZE_BYTES;
        const shouldBeValid = isAcceptedMime && isAcceptedSize;

        if (shouldBeValid) {
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        } else {
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.error!.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('SHALL always accept valid MIME types with size within limit', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * For any accepted MIME type and any size ≤ 10MB, validateFile returns valid: true.
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCEPTED_MIME_TYPES),
        fc.integer({ min: 0, max: MAX_FILE_SIZE_BYTES }),
        (mimeType, sizeBytes) => {
          const result = service.validateFile(mimeType, sizeBytes);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('SHALL always reject non-accepted MIME types regardless of size', () => {
    /**
     * **Validates: Requirements 3.5, 4.5**
     *
     * For any MIME type NOT in the accepted set, validateFile returns
     * valid: false regardless of the file size.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(
          (s) => !ACCEPTED_MIME_TYPES.includes(s as any)
        ),
        fc.integer({ min: 0, max: 20 * 1024 * 1024 }),
        (mimeType, sizeBytes) => {
          const result = service.validateFile(mimeType, sizeBytes);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('format');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('SHALL always reject files exceeding 10MB regardless of MIME type', () => {
    /**
     * **Validates: Requirements 3.5, 4.5**
     *
     * For any accepted MIME type with size > 10MB, validateFile returns valid: false.
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCEPTED_MIME_TYPES),
        fc.integer({ min: MAX_FILE_SIZE_BYTES + 1, max: 50 * 1024 * 1024 }),
        (mimeType, sizeBytes) => {
          const result = service.validateFile(mimeType, sizeBytes);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('size');
        }
      ),
      { numRuns: 100 }
    );
  });
});
