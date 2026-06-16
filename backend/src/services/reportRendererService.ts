import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { supabase as _supabase } from '../db/client.js';
import { logger } from '../config/logger.js';
import type { ReportData } from './misReportService.js';

// Use `any` cast since mis_reports table isn't in generated Database types yet
const db = _supabase as any;

// --- Types ---

export interface ReportRecord {
  id: string;
  officer_id: string;
  cohort: string | null;
  period_from: string;
  period_to: string;
  report_data: ReportData;
  file_url: string | null;
  status: 'generating' | 'ready' | 'failed';
  created_at: string;
}

export interface StoreReportParams {
  officerId: string;
  cohort: string | null;
  periodFrom: string;
  periodTo: string;
  reportData: ReportData;
  fileUrl: string | null;
  status: 'generating' | 'ready' | 'failed';
}

export interface RenderResult {
  pdfBuffer: Buffer;
  excelBuffer: Buffer;
  downloadUrl: string;
}

// --- Constants ---

const STORAGE_BUCKET = 'reports';
const SIGNED_URL_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

// --- PDF Rendering ---

/**
 * Render a PDF report from aggregated MIS report data.
 * Generates sections for status summary, placement rate, retention rates,
 * employer breakdown, and trade distribution.
 *
 * Validates: Requirements 7.6
 */
export async function renderPDF(data: ReportData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      // --- Title ---
      doc.fontSize(20).font('Helvetica-Bold').text('MIS Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica')
        .text(`Generated: ${new Date(data.generatedAt).toLocaleString()}`, { align: 'center' });
      doc.moveDown(0.3);

      // Filter info
      const { filters } = data;
      doc.fontSize(9).text(
        `Period: ${filters.periodFrom} to ${filters.periodTo}${filters.cohort ? ` | Cohort: ${filters.cohort}` : ''}`,
        { align: 'center' }
      );
      doc.moveDown(1.5);

      // --- Status Summary ---
      doc.fontSize(14).font('Helvetica-Bold').text('Status Summary');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      const { summary } = data;
      const statusRows = [
        ['Total Learners', String(summary.total)],
        ['Placed', String(summary.placed)],
        ['Active', String(summary.active)],
        ['At Risk', String(summary.at_risk)],
        ['Dropped', String(summary.dropped)],
      ];

      for (const [label, value] of statusRows) {
        doc.text(`${label}: ${value}`);
      }
      doc.moveDown(1);

      // --- Placement Rate & Salary ---
      doc.fontSize(14).font('Helvetica-Bold').text('Placement Metrics');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Placement Rate: ${data.placementRate}%`);
      doc.text(`Average Salary: ${data.averageSalary !== null ? `₹${data.averageSalary.toLocaleString()}` : 'N/A'}`);
      doc.moveDown(1);

      // --- Retention Rates ---
      doc.fontSize(14).font('Helvetica-Bold').text('Retention Rates');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      const { retentionRates } = data;
      doc.text(`30-day: ${retentionRates.day30 !== null ? `${retentionRates.day30}%` : 'N/A'}`);
      doc.text(`60-day: ${retentionRates.day60 !== null ? `${retentionRates.day60}%` : 'N/A'}`);
      doc.text(`90-day: ${retentionRates.day90 !== null ? `${retentionRates.day90}%` : 'N/A'}`);
      doc.moveDown(1);

      // --- Employer Breakdown ---
      doc.fontSize(14).font('Helvetica-Bold').text('Employer-wise Breakdown');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      if (data.employerBreakdown.length === 0) {
        doc.text('No employer data available.');
      } else {
        for (const entry of data.employerBreakdown) {
          doc.text(`${entry.employer}: ${entry.count} placement${entry.count !== 1 ? 's' : ''}`);
        }
      }
      doc.moveDown(1);

      // --- Trade Distribution ---
      doc.fontSize(14).font('Helvetica-Bold').text('Trade-wise Distribution');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      if (data.tradeDistribution.length === 0) {
        doc.text('No trade data available.');
      } else {
        for (const entry of data.tradeDistribution) {
          doc.text(`${entry.trade}: ${entry.count} learner${entry.count !== 1 ? 's' : ''}`);
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// --- Excel Rendering ---

/**
 * Render an Excel workbook from aggregated MIS report data.
 * Creates separate worksheets: Summary, Placement Details,
 * Employer Breakdown, and Trade Distribution.
 *
 * Validates: Requirements 7.7
 */
export async function renderExcel(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SaathiAI';
  workbook.created = new Date(data.generatedAt);

  // --- Summary Worksheet ---
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 25 },
    { header: 'Value', key: 'value', width: 20 },
  ];

  // Bold header row
  summarySheet.getRow(1).font = { bold: true };

  summarySheet.addRow({ metric: 'Report Period', value: `${data.filters.periodFrom} to ${data.filters.periodTo}` });
  summarySheet.addRow({ metric: 'Cohort', value: data.filters.cohort ?? 'All' });
  summarySheet.addRow({ metric: 'Generated At', value: new Date(data.generatedAt).toLocaleString() });
  summarySheet.addRow({ metric: '', value: '' }); // Spacer
  summarySheet.addRow({ metric: 'Total Learners', value: data.summary.total });
  summarySheet.addRow({ metric: 'Placed', value: data.summary.placed });
  summarySheet.addRow({ metric: 'Active', value: data.summary.active });
  summarySheet.addRow({ metric: 'At Risk', value: data.summary.at_risk });
  summarySheet.addRow({ metric: 'Dropped', value: data.summary.dropped });
  summarySheet.addRow({ metric: '', value: '' }); // Spacer
  summarySheet.addRow({ metric: 'Placement Rate', value: `${data.placementRate}%` });
  summarySheet.addRow({ metric: 'Average Salary', value: data.averageSalary !== null ? `₹${data.averageSalary}` : 'N/A' });

  // --- Placement Details Worksheet ---
  const placementSheet = workbook.addWorksheet('Placement Details');
  placementSheet.columns = [
    { header: 'Check Period', key: 'period', width: 20 },
    { header: 'Retention Rate', key: 'rate', width: 20 },
  ];

  placementSheet.getRow(1).font = { bold: true };

  const { retentionRates } = data;
  placementSheet.addRow({ period: '30-day', rate: retentionRates.day30 !== null ? `${retentionRates.day30}%` : 'N/A' });
  placementSheet.addRow({ period: '60-day', rate: retentionRates.day60 !== null ? `${retentionRates.day60}%` : 'N/A' });
  placementSheet.addRow({ period: '90-day', rate: retentionRates.day90 !== null ? `${retentionRates.day90}%` : 'N/A' });

  // --- Employer Breakdown Worksheet ---
  const employerSheet = workbook.addWorksheet('Employer Breakdown');
  employerSheet.columns = [
    { header: 'Employer', key: 'employer', width: 30 },
    { header: 'Placements', key: 'count', width: 15 },
  ];

  employerSheet.getRow(1).font = { bold: true };

  for (const entry of data.employerBreakdown) {
    employerSheet.addRow({ employer: entry.employer, count: entry.count });
  }

  // --- Trade Distribution Worksheet ---
  const tradeSheet = workbook.addWorksheet('Trade Distribution');
  tradeSheet.columns = [
    { header: 'Trade', key: 'trade', width: 30 },
    { header: 'Learners', key: 'count', width: 15 },
  ];

  tradeSheet.getRow(1).font = { bold: true };

  for (const entry of data.tradeDistribution) {
    tradeSheet.addRow({ trade: entry.trade, count: entry.count });
  }

  // Write to buffer
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// --- Upload to Supabase Storage ---

/**
 * Upload a generated report file to the Supabase Storage 'reports' bucket
 * and return a signed URL with 24-hour expiry.
 *
 * Validates: Requirements 7.9
 */
export async function uploadReport(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const filePath = `mis-reports/${filename}`;

  // Upload file to storage
  const { error: uploadError } = await db.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    logger.error({ error: uploadError, filePath }, 'Failed to upload report to storage');
    throw new Error(`Failed to upload report: ${uploadError.message}`);
  }

  // Generate signed URL with 24-hour expiry
  const { data: signedUrlData, error: signedUrlError } = await db.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    logger.error({ error: signedUrlError, filePath }, 'Failed to generate signed URL');
    throw new Error(`Failed to generate download link: ${signedUrlError?.message ?? 'Unknown error'}`);
  }

  return signedUrlData.signedUrl;
}

// --- Store Report Record ---

/**
 * Insert a report record into the mis_reports table with officer_id,
 * applied filters, status, file URL, and generation timestamp.
 *
 * Validates: Requirements 7.10
 */
export async function storeReportRecord(params: StoreReportParams): Promise<ReportRecord> {
  const { data, error } = await db
    .from('mis_reports')
    .insert({
      officer_id: params.officerId,
      cohort: params.cohort,
      period_from: params.periodFrom,
      period_to: params.periodTo,
      report_data: params.reportData,
      file_url: params.fileUrl,
      status: params.status,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error, params: { officerId: params.officerId } }, 'Failed to store report record');
    throw new Error(`Failed to store report record: ${error.message}`);
  }

  return data as ReportRecord;
}

// --- Report Renderer Service (Singleton) ---

/**
 * Orchestrates rendering a MIS report into both PDF and Excel formats,
 * uploading to Supabase Storage, and returning the download URL.
 */
class ReportRendererService {
  /**
   * Render report data to PDF and Excel, upload PDF to storage,
   * and return the signed download URL.
   */
  async render(data: ReportData): Promise<RenderResult> {
    const timestamp = Date.now();
    const pdfFilename = `report_${timestamp}.pdf`;

    // Render both formats
    const [pdfBuffer, excelBuffer] = await Promise.all([
      renderPDF(data),
      renderExcel(data),
    ]);

    // Upload PDF to storage (primary download format)
    const downloadUrl = await uploadReport(
      pdfBuffer,
      pdfFilename,
      'application/pdf'
    );

    // Also upload Excel
    const excelFilename = `report_${timestamp}.xlsx`;
    await uploadReport(
      excelBuffer,
      excelFilename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    return { pdfBuffer, excelBuffer, downloadUrl };
  }
}

// --- Singleton export ---

export const reportRendererService = new ReportRendererService();
