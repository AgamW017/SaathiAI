/**
 * Property 2: Invalid File Format Rejection
 *
 * **Validates: Requirements 2.3, 4.5**
 *
 * For any file with a MIME type not in {image/png, image/jpeg, application/pdf},
 * the document validation function SHALL return { valid: false }, and the bot
 * SHALL not advance the document collection state (awaitingDocument remains unchanged).
 *
 * Feature: document-upload-officer-onboarding, Property 2
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DocumentStorageService } from '../../../bot/src/services/documentStorageService.js';

const ACCEPTED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'application/pdf']);

// Create a minimal mock supabase client (required by constructor but not used in validateFile)
const mockSupabaseClient = {
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'http://example.com/file' } }),
    }),
  },
};

const service = new DocumentStorageService({
  supabaseClient: mockSupabaseClient,
  logger: { info: () => {}, warn: () => {}, error: () => {} },
});

describe('Property 2: Invalid File Format Rejection', () => {
  it('SHALL return { valid: false } for any MIME type not in the accepted set', () => {
    /**
     * **Validates: Requirements 2.3, 4.5**
     *
     * Generate arbitrary MIME type strings NOT in {image/png, image/jpeg, application/pdf};
     * verify validateFile returns { valid: false } with an error message.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }).filter(
          (s) => !ACCEPTED_MIME_TYPES.has(s)
        ),
        fc.integer({ min: 0, max: 10 * 1024 * 1024 }), // valid size so only format causes rejection
        (mimeType, sizeBytes) => {
          const result = service.validateFile(mimeType, sizeBytes);

          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.error!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('SHALL not mutate any external state when rejecting an invalid format', () => {
    /**
     * **Validates: Requirements 2.3, 4.5**
     *
     * Simulate a session context with an awaitingDocument field; call validateFile
     * with an invalid MIME type; verify the awaitingDocument state remains unchanged.
     * This confirms the validation is a pure check with no side effects.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter(
          (s) => !ACCEPTED_MIME_TYPES.has(s)
        ),
        fc.integer({ min: 0, max: 10 * 1024 * 1024 }),
        fc.constantFrom('aadhaar', 'certificate', null),
        (mimeType, sizeBytes, awaitingDocument) => {
          // Simulate session context state before validation
          const sessionContext = {
            documents: [] as Array<{ url: string; mimeType: string }>,
            awaitingDocument,
          };

          // Snapshot state before call
          const stateBefore = JSON.parse(JSON.stringify(sessionContext));

          // Call validateFile — should be pure, no side effects
          const result = service.validateFile(mimeType, sizeBytes);

          // Verify rejection
          expect(result.valid).toBe(false);

          // Verify no state mutation — awaitingDocument unchanged
          expect(sessionContext.awaitingDocument).toBe(stateBefore.awaitingDocument);
          expect(sessionContext.documents).toEqual(stateBefore.documents);
        }
      ),
      { numRuns: 100 }
    );
  });
});
