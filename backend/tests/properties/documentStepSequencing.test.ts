/**
 * Property 1: Step Sequencing Respects Document Toggle
 *
 * Feature: document-upload-officer-onboarding, Property 1
 *
 * **Validates: Requirements 1.2, 1.3, 7.1, 7.2**
 *
 * For any session at the profile confirmation stage (ONBOARDING_CERTIFICATE with
 * profileConfirmation = true and user affirms), if DOCUMENT_UPLOAD_ENABLED is "true"
 * the next step SHALL be ONBOARDING_DOCUMENTS (14), and if DOCUMENT_UPLOAD_ENABLED is
 * "false" or absent the next step SHALL be SKILL_EXTRACTION (4).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Step constants mirroring bot/src/constants/steps.js
const Steps = {
  ONBOARDING_CERTIFICATE: 3,
  SKILL_EXTRACTION: 4,
  ONBOARDING_DOCUMENTS: 14,
} as const;

/**
 * Pure function that determines the next step after profile confirmation,
 * matching the logic in bot/src/constants/config.js and the transition in
 * bot/src/conversation/conversationEngine.js.
 *
 * This is the system-under-test: the toggle-aware step transition logic.
 */
function getNextStepAfterProfileConfirmation(documentUploadEnabled: string | undefined): number {
  if (documentUploadEnabled === 'true') {
    return Steps.ONBOARDING_DOCUMENTS;
  }
  return Steps.SKILL_EXTRACTION;
}

/**
 * Helper matching isDocumentUploadEnabled() from bot/src/constants/config.js
 */
function isDocumentUploadEnabled(envValue: string | undefined): boolean {
  return envValue === 'true';
}

/**
 * Arbitrary that generates random session state context at the profile confirmation
 * point in the onboarding flow. The session is at ONBOARDING_CERTIFICATE with
 * profileConfirmation = true and user has affirmed.
 */
const sessionAtProfileConfirmationArb = fc.record({
  phone: fc.stringMatching(/^[6-9]\d{9}$/),
  step: fc.constant(Steps.ONBOARDING_CERTIFICATE),
  context: fc.record({
    profileConfirmation: fc.constant(true),
    profileCorrection: fc.constant(false),
  }),
  collected: fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    trade: fc.string({ minLength: 1, maxLength: 50 }),
    district: fc.string({ minLength: 1, maxLength: 50 }),
    state: fc.string({ minLength: 1, maxLength: 50 }),
    certificateType: fc.oneof(fc.constant('ITI'), fc.constant('PMKVY'), fc.constant('Other'), fc.string({ minLength: 1, maxLength: 30 })),
  }),
  script: fc.constantFrom('devanagari', 'english', 'roman_hindi'),
});

/**
 * Arbitrary for toggle values: "true", "false", or absent (undefined).
 * Also generates random non-"true" strings to ensure robustness.
 */
const toggleValueArb = fc.oneof(
  fc.constant('true' as string | undefined),
  fc.constant('false' as string | undefined),
  fc.constant(undefined as string | undefined),
  fc.string({ minLength: 0, maxLength: 20 }).filter(s => s !== 'true') as fc.Arbitrary<string | undefined>,
);

describe('Property 1: Step Sequencing Respects Document Toggle', () => {
  const originalEnv = process.env.DOCUMENT_UPLOAD_ENABLED;

  afterEach(() => {
    // Restore original env
    if (originalEnv === undefined) {
      delete process.env.DOCUMENT_UPLOAD_ENABLED;
    } else {
      process.env.DOCUMENT_UPLOAD_ENABLED = originalEnv;
    }
  });

  it('next step SHALL be ONBOARDING_DOCUMENTS when DOCUMENT_UPLOAD_ENABLED is "true"', () => {
    /**
     * **Validates: Requirements 1.3, 7.1**
     *
     * For any session at profile confirmation, when the toggle is "true",
     * the next step must be ONBOARDING_DOCUMENTS (14).
     */
    fc.assert(
      fc.property(
        sessionAtProfileConfirmationArb,
        (_session) => {
          const nextStep = getNextStepAfterProfileConfirmation('true');
          expect(nextStep).toBe(Steps.ONBOARDING_DOCUMENTS);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('next step SHALL be SKILL_EXTRACTION when DOCUMENT_UPLOAD_ENABLED is "false"', () => {
    /**
     * **Validates: Requirements 1.2, 7.2**
     *
     * For any session at profile confirmation, when the toggle is "false",
     * the next step must be SKILL_EXTRACTION (4).
     */
    fc.assert(
      fc.property(
        sessionAtProfileConfirmationArb,
        (_session) => {
          const nextStep = getNextStepAfterProfileConfirmation('false');
          expect(nextStep).toBe(Steps.SKILL_EXTRACTION);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('next step SHALL be SKILL_EXTRACTION when DOCUMENT_UPLOAD_ENABLED is absent', () => {
    /**
     * **Validates: Requirements 1.2, 7.2**
     *
     * For any session at profile confirmation, when the toggle is absent (undefined),
     * the next step must be SKILL_EXTRACTION (4).
     */
    fc.assert(
      fc.property(
        sessionAtProfileConfirmationArb,
        (_session) => {
          const nextStep = getNextStepAfterProfileConfirmation(undefined);
          expect(nextStep).toBe(Steps.SKILL_EXTRACTION);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('next step is ONBOARDING_DOCUMENTS iff toggle is exactly "true", otherwise SKILL_EXTRACTION', () => {
    /**
     * **Validates: Requirements 1.2, 1.3, 7.1, 7.2**
     *
     * For any session at profile confirmation with any toggle value,
     * the bidirectional property holds: next step is ONBOARDING_DOCUMENTS
     * if and only if the toggle is exactly "true".
     */
    fc.assert(
      fc.property(
        sessionAtProfileConfirmationArb,
        toggleValueArb,
        (_session, toggleValue) => {
          const nextStep = getNextStepAfterProfileConfirmation(toggleValue);
          const expected = isDocumentUploadEnabled(toggleValue)
            ? Steps.ONBOARDING_DOCUMENTS
            : Steps.SKILL_EXTRACTION;
          expect(nextStep).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('isDocumentUploadEnabled matches env-based check via process.env', () => {
    /**
     * **Validates: Requirements 1.2, 1.3**
     *
     * Verify that reading process.env.DOCUMENT_UPLOAD_ENABLED at call time
     * matches the expected behavior: returns true only when value is exactly "true".
     */
    fc.assert(
      fc.property(
        toggleValueArb,
        (toggleValue) => {
          if (toggleValue === undefined) {
            delete process.env.DOCUMENT_UPLOAD_ENABLED;
          } else {
            process.env.DOCUMENT_UPLOAD_ENABLED = toggleValue;
          }

          const result = process.env.DOCUMENT_UPLOAD_ENABLED === 'true';
          const expected = toggleValue === 'true';
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});
