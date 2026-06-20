/**
 * Configuration helpers that read environment variables at call time.
 * Reading at point of use (not cached at import) means a restart picks up changes.
 */

/**
 * Returns true when the document upload step is enabled in the onboarding flow.
 * Controlled by the DOCUMENT_UPLOAD_ENABLED environment variable.
 * @returns {boolean}
 */
export const isDocumentUploadEnabled = () => process.env.DOCUMENT_UPLOAD_ENABLED === 'true';
