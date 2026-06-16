import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, officerProcedure } from '../trpc.js';
import { supabase as _supabase } from '../../db/client.js';
import { documentParserService } from '../../services/documentParserService.js';
import { config } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { handleSupabaseError } from '../errors.js';

const supabase = _supabase as any;

/**
 * Bot internal API base URL for triggering onboarding.
 */
const BOT_INTERNAL_URL =
  process.env.BOT_INTERNAL_URL || `http://localhost:${config.bot.adminWsPort}`;

/**
 * Supabase Storage bucket for uploaded cohort documents.
 */
const COHORT_DOCUMENTS_BUCKET = 'cohort-documents';

// ─── Input schemas ────────────────────────────────────────────────────────────

const uploadDocumentInput = z.object({
  /** Base64-encoded file content */
  fileBase64: z.string().min(1),
  /** MIME type of the uploaded file */
  mimeType: z.string().min(1),
  /** Officer-provided cohort name */
  cohortName: z.string().min(1).max(200),
  /** Original filename */
  filename: z.string().min(1),
});

const validEntrySchema = z.object({
  name: z.string(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
});

const confirmCohortInput = z.object({
  /** Cohort name (officer may have edited it) */
  cohortName: z.string().min(1).max(200),
  /** Validated entries the officer confirmed (after editing) */
  validEntries: z.array(validEntrySchema).min(1),
  /** Base64-encoded file content for storage */
  fileBase64: z.string().min(1),
  /** MIME type of the uploaded file */
  mimeType: z.string().min(1),
  /** Original filename */
  filename: z.string().min(1),
});

// ─── Cohort Router ────────────────────────────────────────────────────────────

export const cohortRouter = router({
  /**
   * Upload a document, parse it via Docling, extract learner data via LLM,
   * and return a preview for officer review. Does NOT commit anything to DB.
   *
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9
   */
  uploadDocument: officerProcedure
    .input(uploadDocumentInput)
    .mutation(async ({ input }) => {
      const { fileBase64, mimeType, cohortName, filename } = input;

      // 1. Decode the base64 file content into a buffer
      const fileBuffer = Buffer.from(fileBase64, 'base64');

      // 2. Parse the document via Docling (validates format + size internally)
      const parseResult = await documentParserService.parseDocument(
        fileBuffer,
        mimeType,
        filename
      );

      // 3. Extract learner data from the parsed text via Gemini LLM
      const extractionResult = await documentParserService.extractLearners(
        parseResult.text
      );

      if (extractionResult.error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Learner extraction failed: ${extractionResult.error}`,
        });
      }

      // 4. Return the preview (valid + invalid entries) for officer review
      return {
        cohortName,
        filename,
        pages: parseResult.pages ?? null,
        totalExtracted: extractionResult.totalExtracted,
        validEntries: extractionResult.validEntries,
        invalidEntries: extractionResult.invalidEntries,
      };
    }),

  /**
   * Confirm cohort creation after officer review/edits.
   * Creates the cohort record, upserts learners (skip existing),
   * uploads document to storage, and triggers bot onboarding.
   *
   * Requirements: 5.10, 5.11, 5.12, 5.13
   */
  confirmCohort: officerProcedure
    .input(confirmCohortInput)
    .mutation(async ({ ctx, input }) => {
      const officerId = ctx.user.sub;
      const { cohortName, validEntries, fileBase64, mimeType, filename } = input;

      // 1. Upload document to Supabase Storage (private bucket)
      const fileBuffer = Buffer.from(fileBase64, 'base64');
      const storagePath = `${officerId}/${Date.now()}_${filename}`;

      const { error: uploadError } = await supabase.storage
        .from(COHORT_DOCUMENTS_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        logger.error({ error: uploadError }, 'Failed to upload cohort document to storage');
        // Non-fatal: proceed with cohort creation even if storage fails
      }

      const sourceDocumentUrl = uploadError ? null : storagePath;

      // 2. Create cohort record
      const { data: cohort, error: cohortError } = await supabase
        .from('cohorts')
        .insert({
          name: cohortName,
          officer_id: officerId,
          source_document_url: sourceDocumentUrl,
          extraction_metadata: {
            total_extracted: validEntries.length,
            filename,
            uploaded_at: new Date().toISOString(),
          },
        })
        .select('id, name, created_at')
        .single();

      if (cohortError) {
        handleSupabaseError(cohortError, 'cohort.confirmCohort.createCohort');
      }

      // 3. Upsert learner records — skip existing (ON CONFLICT phone DO NOTHING)
      let learnersCreated = 0;
      let skipped = 0;
      const errors: Array<{ phone: string; reason: string }> = [];
      const newLearners: Array<{ id: string; phone: string }> = [];

      for (const entry of validEntries) {
        // Check if learner with this phone already exists
        const { data: existing } = await supabase
          .from('learners')
          .select('id')
          .eq('phone', entry.phone)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        // Create new learner record
        const { data: inserted, error: insertError } = await supabase
          .from('learners')
          .insert({
            phone: entry.phone,
            full_name: entry.name || null,
            cohort: cohortName,
            status: 'active',
            risk_score: 0,
            officer_id: officerId,
          })
          .select('id, phone')
          .single();

        if (insertError) {
          errors.push({ phone: entry.phone, reason: insertError.message });
        } else {
          learnersCreated++;
          newLearners.push({ id: inserted.id, phone: inserted.phone });
        }
      }

      // 4. Trigger bot onboarding for newly created learners
      //    Bot expects: { learners: [{ id, phone }] }
      //    Non-fatal: if bot is unavailable, log and continue (cohort was still created)
      if (newLearners.length > 0) {
        try {
          const response = await fetch(
            `${BOT_INTERNAL_URL}/internal/trigger-onboarding`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                learners: newLearners,
              }),
            }
          );

          if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            logger.error(
              { status: response.status, errorBody },
              'Bot onboarding trigger returned non-OK status'
            );
            // Non-fatal: cohort was still created. Onboarding can be retried.
          }
        } catch (error) {
          logger.error(
            { error },
            'Failed to reach bot service for onboarding trigger'
          );
          // Non-fatal: cohort was still created.
        }
      }

      // 5. Return summary
      return {
        cohortId: cohort.id,
        cohortName: cohort.name,
        learnersCreated,
        skipped,
        errors,
      };
    }),

  /**
   * List all cohorts for the requesting officer with aggregate stats.
   *
   * Requirements: 6.1, 6.3
   */
  listCohorts: officerProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const officerId = ctx.user.sub;
      const { page, limit } = input;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Fetch cohorts for this officer
      const { data: cohorts, error, count } = await supabase
        .from('cohorts')
        .select('id, name, source_document_url, extraction_metadata, created_at', {
          count: 'exact',
        })
        .eq('officer_id', officerId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        handleSupabaseError(error, 'cohort.listCohorts');
      }

      // For each cohort, compute aggregate stats from learners table
      const enrichedCohorts = await Promise.all(
        (cohorts ?? []).map(async (cohort: any) => {
          const { data: learners } = await supabase
            .from('learners')
            .select('status')
            .eq('cohort', cohort.name)
            .eq('officer_id', officerId);

          const allLearners = learners ?? [];
          const total = allLearners.length;
          const placed = allLearners.filter(
            (l: any) => l.status === 'placed'
          ).length;

          // Get salary data for placed learners
          const { data: placements } = await supabase
            .from('placements')
            .select('salary')
            .in(
              'learner_id',
              allLearners
                .filter((l: any) => l.status === 'placed')
                .map((_: any, i: number) => _.id)
                .length > 0
                ? []
                : ['__none__']
            );

          // Compute average salary from placements with non-null salary
          // (simplified: we query by cohort learner_ids)
          let averageSalary: number | null = null;
          if (placed > 0) {
            const { data: placedLearners } = await supabase
              .from('learners')
              .select('id')
              .eq('cohort', cohort.name)
              .eq('status', 'placed');

            if (placedLearners && placedLearners.length > 0) {
              const placedIds = placedLearners.map((l: any) => l.id);
              const { data: salaryData } = await supabase
                .from('placements')
                .select('salary, salary_reported, current_salary')
                .in('learner_id', placedIds);

              if (salaryData && salaryData.length > 0) {
                // Prefer bot-captured salary over officer-confirmed salary
                const validSalaries = salaryData
                  .map((p: any) => p.current_salary ?? p.salary_reported ?? p.salary)
                  .filter((s: any) => s !== null && s > 0);
                if (validSalaries.length > 0) {
                  const salarySum = validSalaries.reduce(
                    (sum: number, s: number) => sum + s,
                    0
                  );
                  averageSalary = Math.round(salarySum / validSalaries.length);
                }
              }
            }
          }

          return {
            id: cohort.id,
            name: cohort.name,
            createdAt: cohort.created_at,
            sourceDocumentUrl: cohort.source_document_url,
            stats: {
              total,
              placed,
              placementRate: total > 0 ? Math.round((placed / total) * 100) : 0,
              averageSalary,
            },
          };
        })
      );

      return {
        data: enrichedCohorts,
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      };
    }),

  /**
   * Get a specific cohort's details with full learner list.
   *
   * Requirements: 6.2, 6.4
   */
  getCohortDetail: officerProcedure
    .input(z.object({ cohortId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const officerId = ctx.user.sub;

      // 1. Fetch cohort — scoped to the requesting officer
      const { data: cohort, error: cohortError } = await supabase
        .from('cohorts')
        .select('*')
        .eq('id', input.cohortId)
        .eq('officer_id', officerId)
        .single();

      if (cohortError || !cohort) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cohort not found',
        });
      }

      // 2. Fetch learners in this cohort
      const { data: learners, error: learnersError } = await supabase
        .from('learners')
        .select('id, phone, full_name, status, trade, district, created_at, updated_at')
        .eq('cohort', cohort.name)
        .eq('officer_id', officerId)
        .order('created_at', { ascending: true });

      if (learnersError) {
        handleSupabaseError(learnersError, 'cohort.getCohortDetail.learners');
      }

      const allLearners = learners ?? [];
      const total = allLearners.length;
      const placed = allLearners.filter((l: any) => l.status === 'placed').length;
      const active = allLearners.filter((l: any) => l.status === 'active').length;
      const atRisk = allLearners.filter((l: any) => l.status === 'at_risk').length;
      const dropped = allLearners.filter((l: any) => l.status === 'dropped').length;

      return {
        cohort: {
          id: cohort.id,
          name: cohort.name,
          createdAt: cohort.created_at,
          sourceDocumentUrl: cohort.source_document_url,
          extractionMetadata: cohort.extraction_metadata,
        },
        learners: allLearners,
        stats: {
          total,
          placed,
          active,
          atRisk,
          dropped,
          placementRate: total > 0 ? Math.round((placed / total) * 100) : 0,
        },
      };
    }),
});
