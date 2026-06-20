/**
 * DocumentStorageService — handles document upload to Supabase Storage
 * and file validation for the bot's document upload step.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

const BUCKET = 'cohort-documents';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'application/pdf'
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB = 10,485,760 bytes

/**
 * Map MIME type to a human-readable document type label.
 * @param {string} mimeType
 * @returns {string}
 */
function getDocumentTypeLabel(mimeType) {
  switch (mimeType) {
    case 'image/png':
      return 'PNG Image';
    case 'image/jpeg':
      return 'JPEG Image';
    case 'application/pdf':
      return 'PDF Document';
    default:
      return 'Unknown';
  }
}

export class DocumentStorageService {
  /**
   * @param {object} params
   * @param {object} params.supabaseClient - Supabase JS client instance (with .storage access)
   * @param {object} [params.logger] - Optional pino logger instance
   */
  constructor({ supabaseClient, logger }) {
    if (!supabaseClient) {
      throw new Error('supabaseClient is required for DocumentStorageService');
    }
    this.supabase = supabaseClient;
    this.logger = logger || console;
  }

  /**
   * Validate that a file's MIME type and size are acceptable.
   *
   * Accepts only image/png, image/jpeg, application/pdf and size ≤ 10MB.
   *
   * @param {string} mimeType - The file's MIME type
   * @param {number} sizeBytes - The file's size in bytes
   * @returns {{ valid: boolean, error?: string }}
   */
  validateFile(mimeType, sizeBytes) {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return {
        valid: false,
        error: `Unsupported file format "${mimeType}". Only PNG, JPEG, and PDF files are accepted.`
      };
    }

    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File size (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB) exceeds the 10 MB limit.`
      };
    }

    return { valid: true };
  }

  /**
   * Generate the storage path for a document.
   *
   * Path format: documents/{phone}/{timestamp}_{filename}
   *
   * @param {string} phone - Learner's phone number
   * @param {string} filename - Original filename
   * @returns {string} The storage path
   */
  generateStoragePath(phone, filename) {
    const timestamp = Date.now();
    return `documents/${phone}/${timestamp}_${filename}`;
  }

  /**
   * Upload a base64-encoded JPEG photo (e.g. from Sandbox Aadhaar verify) to Supabase Storage.
   *
   * @param {string} phone - Learner's phone number
   * @param {string} base64String - Base64-encoded JPEG content (no data-URI prefix)
   * @returns {Promise<string>} The public URL of the uploaded photo
   * @throws {Error} If upload fails
   */
  async uploadBase64Photo(phone, base64String) {
    const buffer = Buffer.from(base64String, 'base64');
    const storagePath = `documents/${phone}/aadhaar_photo.jpg`;

    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true    // overwrite if re-verified
      });

    if (error) {
      this.logger.error?.({ error, phone, path: storagePath }, 'Aadhaar photo upload failed');
      throw new Error(`Aadhaar photo upload failed: ${error.message}`);
    }

    const { data: urlData } = this.supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const url = urlData?.publicUrl ?? storagePath;
    this.logger.info?.({ phone, path: storagePath }, 'Aadhaar photo uploaded successfully');
    return url;
  }

  /**
   * Upload a document to Supabase Storage with one retry on failure.
   *
   * @param {object} params
   * @param {string} params.phone - Learner's phone number
   * @param {string} params.filename - Original filename
   * @param {Buffer} params.buffer - File content as a Buffer
   * @param {string} params.mimeType - File MIME type
   * @returns {Promise<{ url: string, path: string, metadata: { mimeType: string, sizeBytes: number, documentType: string } }>}
   * @throws {Error} If upload fails after retry
   */
  async uploadDocument({ phone, filename, buffer, mimeType }) {
    const storagePath = this.generateStoragePath(phone, filename);
    const sizeBytes = buffer.length;

    // Attempt upload with one retry on failure
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await this.supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false
        });

      if (!error) {
        // Upload succeeded — get public URL
        const { data: urlData } = this.supabase.storage
          .from(BUCKET)
          .getPublicUrl(storagePath);

        const url = urlData?.publicUrl || storagePath;

        const metadata = {
          mimeType,
          sizeBytes,
          documentType: getDocumentTypeLabel(mimeType)
        };

        this.logger.info?.({ phone, path: storagePath }, 'Document uploaded successfully');

        return { url, path: storagePath, metadata };
      }

      // Upload failed
      lastError = error;
      if (attempt === 0) {
        this.logger.warn?.({ error, phone, path: storagePath }, 'Document upload failed, retrying once');
      }
    }

    // Both attempts failed
    this.logger.error?.({ error: lastError, phone, path: storagePath }, 'Document upload failed after retry');
    throw new Error(`Document upload failed: ${lastError?.message || 'Unknown storage error'}`);
  }
}
