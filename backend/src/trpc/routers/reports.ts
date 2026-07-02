import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, officerProcedure } from '../trpc.js';
import { supabase as _supabase } from '../../db/client.js';
import { misReportService } from '../../services/misReportService.js';
import { renderPDF, renderExcel, uploadReport } from '../../services/reportRendererService.js';
import { logger } from '../../config/logger.js';
import { handleSupabaseError } from '../errors.js';

const supabase = _supabase as any;

/**
 * Report download links expire after 24 hours.
 */
const REPORT_LINK_EXPIRY_MS = 24 * 60 * 60 * 1000;

// ─── Reports Router ───────────────────────────────────────────────────────────

export const reportsRouter = router({
  /**
   * Generate a MIS report: orchestrate aggregation → rendering → storage.
   * Returns hasData: false if no learners match the filters.
   * On success, stores report record and returns reportId with status 'ready'.
   *
   * Requirements: 7.1, 7.9, 7.10
   */
  generateMISReport: officerProcedure
    .input(
      z.object({
        cohort: z.string().optional(),
        periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date (YYYY-MM-DD)'),
        periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date (YYYY-MM-DD)'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const officerId = ctx.user.sub;

      // 1. Run data aggregation via misReportService
      const result = await misReportService.generateReport({
        officerId,
        cohort: input.cohort,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
      });

      // 2. If no data, return early without generating files
      if (!result.hasData || !result.data) {
        return { hasData: false, report: null };
      }

      // 3. Render PDF and upload to storage
      let fileUrl: string;
      try {
        const pdfBuffer = await renderPDF(result.data);
        const timestamp = Date.now();
        const filename = `report_${officerId}_${timestamp}.pdf`;
        fileUrl = await uploadReport(pdfBuffer, filename, 'application/pdf');
      } catch (error) {
        // Mark report as failed if rendering errors out
        logger.error({ error, officerId }, 'Report rendering failed');
        await supabase
          .from('mis_reports')
          .insert({
            officer_id: officerId,
            cohort: input.cohort ?? null,
            period_from: input.periodFrom,
            period_to: input.periodTo,
            report_data: result.data,
            file_url: null,
            status: 'failed',
          });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Report rendering failed. Please try again later.',
        });
      }

      // 4. Store report record in mis_reports table
      const { data: reportRecord, error: insertError } = await supabase
        .from('mis_reports')
        .insert({
          officer_id: officerId,
          cohort: input.cohort ?? null,
          period_from: input.periodFrom,
          period_to: input.periodTo,
          report_data: result.data,
          file_url: fileUrl,
          status: 'ready',
        })
        .select('id, status, created_at')
        .single();

      if (insertError) {
        logger.error({ error: insertError, officerId }, 'Failed to store report record');
        handleSupabaseError(insertError, 'reports.generateMISReport.insert');
      }

      return {
        hasData: true,
        report: {
          reportId: reportRecord.id,
          status: reportRecord.status,
          createdAt: reportRecord.created_at,
          aiAnalysis: result.data.aiAnalysis ?? null,
        },
      };
    }),

  /**
   * List MIS reports for the requesting officer, ordered by most recent first.
   *
   * Requirements: 7.9, 7.10
   */
  getReportsList: officerProcedure
    .query(async ({ ctx }) => {
      const officerId = ctx.user.sub;

      const { data: reports, error } = await supabase
        .from('mis_reports')
        .select('id, cohort, period_from, period_to, status, file_url, created_at')
        .eq('officer_id', officerId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error({ error, officerId }, 'Failed to fetch reports list');
        handleSupabaseError(error, 'reports.getReportsList');
      }

      return { reports: reports ?? [] };
    }),

  /**
   * Get download URL for a report. Validates ownership and link expiry.
   * Returns error if link has expired (24 hours from creation).
   *
   * Requirements: 7.9
   */
  downloadReport: officerProcedure
    .input(
      z.object({
        reportId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const officerId = ctx.user.sub;

      // 1. Fetch report record
      const { data: report, error } = await supabase
        .from('mis_reports')
        .select('id, officer_id, file_url, status, created_at')
        .eq('id', input.reportId)
        .single();

      if (error || !report) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Report not found',
        });
      }

      // 2. Validate ownership
      if (report.officer_id !== officerId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this report',
        });
      }

      // 3. Check report status
      if (report.status !== 'ready') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Report is not ready for download (status: ${report.status})`,
        });
      }

      // 4. Check if file_url exists
      if (!report.file_url) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Report file is not available',
        });
      }

      // 5. Check if the download link has expired (24 hours from creation)
      const createdAt = new Date(report.created_at).getTime();
      const now = Date.now();
      if (now - createdAt > REPORT_LINK_EXPIRY_MS) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Download link has expired. Please regenerate the report.',
        });
      }

      return { downloadUrl: report.file_url };
    }),
});
