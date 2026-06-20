import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentStorageService } from '../../src/services/documentStorageService.js';

function createMockSupabase({ uploadError = null, publicUrl = 'https://storage.example.com/file.png' } = {}) {
  return {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: uploadError }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl } })
      })
    }
  };
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

describe('DocumentStorageService', () => {
  let service;
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    service = new DocumentStorageService({ supabaseClient: mockSupabase, logger: mockLogger });
  });

  describe('constructor', () => {
    it('throws if supabaseClient is not provided', () => {
      expect(() => new DocumentStorageService({ supabaseClient: null, logger: mockLogger }))
        .toThrow('supabaseClient is required');
    });
  });

  describe('validateFile', () => {
    it('accepts image/png within size limit', () => {
      const result = service.validateFile('image/png', 5 * 1024 * 1024);
      expect(result).toEqual({ valid: true });
    });

    it('accepts image/jpeg within size limit', () => {
      const result = service.validateFile('image/jpeg', 1024);
      expect(result).toEqual({ valid: true });
    });

    it('accepts application/pdf within size limit', () => {
      const result = service.validateFile('application/pdf', 10 * 1024 * 1024);
      expect(result).toEqual({ valid: true });
    });

    it('rejects unsupported MIME type', () => {
      const result = service.validateFile('image/gif', 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported file format');
    });

    it('rejects file exceeding 10MB', () => {
      const result = service.validateFile('image/png', 10 * 1024 * 1024 + 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('10 MB limit');
    });

    it('accepts file at exactly 10MB boundary', () => {
      const result = service.validateFile('image/png', 10 * 1024 * 1024);
      expect(result).toEqual({ valid: true });
    });

    it('rejects application/msword', () => {
      const result = service.validateFile('application/msword', 1024);
      expect(result.valid).toBe(false);
    });
  });

  describe('generateStoragePath', () => {
    it('generates path in format documents/{phone}/{timestamp}_{filename}', () => {
      const path = service.generateStoragePath('9876543210', 'aadhaar.jpg');
      expect(path).toMatch(/^documents\/9876543210\/\d+_aadhaar\.jpg$/);
    });

    it('includes the phone number in the path', () => {
      const path = service.generateStoragePath('8001234567', 'cert.pdf');
      expect(path).toContain('8001234567');
    });

    it('includes the filename in the path', () => {
      const path = service.generateStoragePath('9876543210', 'my_certificate.pdf');
      expect(path).toContain('my_certificate.pdf');
    });
  });

  describe('uploadDocument', () => {
    it('uploads to cohort-documents bucket and returns url, path, metadata', async () => {
      const result = await service.uploadDocument({
        phone: '9876543210',
        filename: 'aadhaar.jpg',
        buffer: Buffer.from('fake-image-data'),
        mimeType: 'image/jpeg'
      });

      expect(result.url).toBe('https://storage.example.com/file.png');
      expect(result.path).toMatch(/^documents\/9876543210\/\d+_aadhaar\.jpg$/);
      expect(result.metadata).toEqual({
        mimeType: 'image/jpeg',
        sizeBytes: Buffer.from('fake-image-data').length,
        documentType: 'JPEG Image'
      });

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('cohort-documents');
    });

    it('retries once on upload failure and succeeds on second attempt', async () => {
      let callCount = 0;
      const storageFrom = {
        upload: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve({ error: { message: 'Network error' } });
          return Promise.resolve({ error: null });
        }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file.pdf' } })
      };
      mockSupabase.storage.from = vi.fn().mockReturnValue(storageFrom);

      const result = await service.uploadDocument({
        phone: '9876543210',
        filename: 'cert.pdf',
        buffer: Buffer.from('pdf-content'),
        mimeType: 'application/pdf'
      });

      expect(storageFrom.upload).toHaveBeenCalledTimes(2);
      expect(result.url).toBe('https://example.com/file.pdf');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('throws after two consecutive upload failures', async () => {
      const storageFrom = {
        upload: vi.fn().mockResolvedValue({ error: { message: 'Storage unavailable' } }),
        getPublicUrl: vi.fn()
      };
      mockSupabase.storage.from = vi.fn().mockReturnValue(storageFrom);

      await expect(
        service.uploadDocument({
          phone: '9876543210',
          filename: 'doc.png',
          buffer: Buffer.from('data'),
          mimeType: 'image/png'
        })
      ).rejects.toThrow('Document upload failed: Storage unavailable');

      expect(storageFrom.upload).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('returns correct metadata for PDF uploads', async () => {
      const result = await service.uploadDocument({
        phone: '7001234567',
        filename: 'certificate.pdf',
        buffer: Buffer.from('pdf-data'),
        mimeType: 'application/pdf'
      });

      expect(result.metadata.documentType).toBe('PDF Document');
      expect(result.metadata.mimeType).toBe('application/pdf');
    });
  });
});
