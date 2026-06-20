import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { documentParserService } from '../services/documentParserService.js';
import { logger } from '../config/logger.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * POST /api/documents/parse-cohort
 *
 * Accepts one or more files (CSV, PDF, JPEG, PNG) via multipart/form-data.
 * Routes processing by MIME type:
 *   - CSV: bypasses Docling, uses built-in CSV parser
 *   - PDF: Docling → LLM
 *   - JPEG/PNG: concurrent Docling for all images → concatenated text → LLM
 *
 * @returns ExtractionResult { validEntries, invalidEntries, totalExtracted }
 */
router.post(
  '/parse-cohort',
  authenticate,
  upload.array('file'),
  async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const mimeType = files[0].mimetype;
      const filenames = files.map((f) => f.originalname);
      const buffers = files.map((f) => f.buffer);

      // Validate all images share the same MIME type when multiple files sent
      const isImages = mimeType === 'image/jpeg' || mimeType === 'image/png';
      if (!isImages && files.length > 1) {
        res.status(400).json({ error: 'Multiple files are only supported for JPEG/PNG images' });
        return;
      }

      const result = await documentParserService.extractLearnersFromDocument(
        buffers,
        mimeType,
        filenames
      );

      if (result.error) {
        res.status(422).json({ error: result.error });
        return;
      }

      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Document parsing failed';
      logger.error({ err }, 'POST /api/documents/parse-cohort failed');
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /api/documents/extract-fields
 *
 * Accepts a single file via multipart/form-data plus a JSON string array
 * in the `fields` form field. Runs Docling → LLM to extract the named fields.
 *
 * @body file          - multipart file (PDF, JPEG, PNG, DOCX)
 * @body fields        - JSON-stringified string[] of field names to extract
 * @returns { extracted: Record<string, string | null>, confidence: Record<string, number>, rawText: string }
 */
router.post(
  '/extract-fields',
  authenticate,
  upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const rawFields = req.body?.fields;
      if (!rawFields) {
        res.status(400).json({ error: '`fields` body parameter is required' });
        return;
      }

      let fields: string[];
      try {
        fields = JSON.parse(rawFields);
        if (!Array.isArray(fields) || fields.some((f) => typeof f !== 'string')) {
          throw new Error('`fields` must be a JSON array of strings');
        }
      } catch (parseErr) {
        res.status(400).json({ error: 'Invalid `fields` parameter — must be a JSON string array' });
        return;
      }

      const result = await documentParserService.extractFields(
        file.buffer,
        file.mimetype,
        fields,
        file.originalname
      );

      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Field extraction failed';
      logger.error({ err }, 'POST /api/documents/extract-fields failed');
      res.status(500).json({ error: message });
    }
  }
);

export { router as documentsRouter };
