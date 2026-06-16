/**
 * Property 11: Document Upload Format Validation
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 *
 * For any uploaded file, the Backend SHALL accept it if and only if its MIME type
 * is one of application/pdf, image/jpeg, image/png, or
 * application/vnd.openxmlformats-officedocument.wordprocessingml.document,
 * AND its size is at most 10 megabytes.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DocumentParserService } from '../../src/services/documentParserService.js';

const service = new DocumentParserService();

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

describe('Property 11: Document Upload Format Validation', () => {
  it('SHALL accept any file with an accepted MIME type via validateFormat', () => {
    /**
     * **Validates: Requirements 5.1**
     *
     * For any MIME type in the accepted set (PDF, JPEG, PNG, DOCX),
     * validateFormat SHALL return true.
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCEPTED_MIME_TYPES),
        (mimeType) => {
          expect(service.validateFormat(mimeType)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('SHALL reject any file with a non-accepted MIME type via validateFormat', () => {
    /**
     * **Validates: Requirements 5.2**
     *
     * For any MIME type string NOT in the accepted set,
     * validateFormat SHALL return false.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(
          (s) => !ACCEPTED_MIME_TYPES.includes(s as any)
        ),
        (mimeType) => {
          expect(service.validateFormat(mimeType)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('SHALL accept any file with size at most 10MB via validateSize', () => {
    /**
     * **Validates: Requirements 5.3**
     *
     * For any Buffer of size <= 10MB, validateSize SHALL return true.
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_FILE_SIZE_BYTES }),
        (size) => {
          const buffer = Buffer.alloc(size);
          expect(service.validateSize(buffer)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('SHALL reject any file with size exceeding 10MB via validateSize', () => {
    /**
     * **Validates: Requirements 5.4**
     *
     * For any Buffer of size > 10MB, validateSize SHALL return false.
     */
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_FILE_SIZE_BYTES + 1, max: MAX_FILE_SIZE_BYTES + 1024 * 1024 }),
        (size) => {
          const buffer = Buffer.alloc(size);
          expect(service.validateSize(buffer)).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('SHALL accept when MIME type is accepted AND size is at most 10MB (combined)', () => {
    /**
     * **Validates: Requirements 5.1, 5.3**
     *
     * For any file with an accepted MIME type and size <= 10MB,
     * both validateFormat and validateSize SHALL return true.
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCEPTED_MIME_TYPES),
        fc.integer({ min: 0, max: MAX_FILE_SIZE_BYTES }),
        (mimeType, size) => {
          const buffer = Buffer.alloc(size);
          expect(service.validateFormat(mimeType)).toBe(true);
          expect(service.validateSize(buffer)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('SHALL reject when MIME type is not accepted regardless of file size', () => {
    /**
     * **Validates: Requirements 5.2**
     *
     * For any non-accepted MIME type, validateFormat SHALL return false
     * regardless of the file size.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(
          (s) => !ACCEPTED_MIME_TYPES.includes(s as any)
        ),
        fc.integer({ min: 0, max: MAX_FILE_SIZE_BYTES + 1024 * 1024 }),
        (mimeType, size) => {
          const buffer = Buffer.alloc(size);
          // Format check fails regardless of size
          expect(service.validateFormat(mimeType)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
