"use client";

import { useState } from "react";
import {
  FileText,
  Download,
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { trpc } from "../../lib/trpc/client";

type ReportStatus = "generating" | "ready" | "failed";

interface ReportItem {
  id: string;
  cohort: string | null;
  periodFrom: string;
  periodTo: string;
  status: ReportStatus;
  createdAt: string;
}

export default function ReportsPage() {
  const [cohortFilter, setCohortFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [noDataMessage, setNoDataMessage] = useState<string | null>(null);
  const [expiredReportId, setExpiredReportId] = useState<string | null>(null);

  // Fetch previously generated reports
  const reportsQuery = trpc.reports.getReportsList.useQuery(undefined, {
    refetchInterval: 10000, // Poll for status updates
  });

  // Generate report mutation
  const generateReport = trpc.reports.generateMISReport.useMutation({
    onSuccess: (data: { hasData: boolean }) => {
      if (!data.hasData) {
        setNoDataMessage("No data available for the selected period.");
      } else {
        setNoDataMessage(null);
      }
      reportsQuery.refetch();
    },
    onError: () => {
      setNoDataMessage(null);
    },
  });

  function validateDates(): boolean {
    setDateError(null);
    if (startDate && endDate && startDate > endDate) {
      setDateError("Start date must be on or before end date.");
      return false;
    }
    return true;
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setNoDataMessage(null);
    setExpiredReportId(null);

    if (!validateDates()) return;

    generateReport.mutate({
      cohort: cohortFilter.trim() || undefined,
      periodFrom: startDate || undefined,
      periodTo: endDate || undefined,
    } as any);
  }

  function handleDownload(reportId: string, format: "pdf" | "excel") {
    // Trigger download — in a real implementation this would call
    // the download endpoint and handle the response
    downloadReport(reportId, format);
  }

  async function downloadReport(reportId: string, format: "pdf" | "excel") {
    try {
      // @ts-expect-error — reports router not yet wired (task 16.1)
      const result = await trpc.reports.downloadReport.query({
        reportId,
        format,
      });

      if (result?.url) {
        window.open(result.url, "_blank");
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      if (error.message?.includes("expired")) {
        setExpiredReportId(reportId);
      }
    }
  }

  function handleRegenerate(report: ReportItem) {
    setExpiredReportId(null);
    generateReport.mutate({
      cohort: report.cohort || undefined,
      periodFrom: report.periodFrom || undefined,
      periodTo: report.periodTo || undefined,
    } as any);
  }

  const reports: ReportItem[] = reportsQuery.data?.reports ?? [];

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-teal-600" />
          <h1 className="text-2xl font-bold text-gray-900">MIS Reports</h1>
        </div>

        {/* Generate Report Form */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Generate Report
          </h2>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cohort Filter */}
              <div>
                <label
                  htmlFor="cohort-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Cohort (optional)
                </label>
                <input
                  id="cohort-filter"
                  type="text"
                  value={cohortFilter}
                  onChange={(e) => setCohortFilter(e.target.value)}
                  placeholder="All cohorts"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Start Date */}
              <div>
                <label
                  htmlFor="start-date"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Start Date
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDateError(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* End Date */}
              <div>
                <label
                  htmlFor="end-date"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  End Date
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDateError(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Date Validation Error */}
            {dateError && (
              <div
                className="flex items-center gap-2 text-sm text-red-600"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{dateError}</span>
              </div>
            )}

            {/* No Data Message */}
            {noDataMessage && (
              <div
                className="flex items-center gap-2 text-sm text-amber-600"
                role="status"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{noDataMessage}</span>
              </div>
            )}

            {/* Generate Button */}
            <div>
              <button
                type="submit"
                disabled={generateReport.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generateReport.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Generate Report
                  </>
                )}
              </button>
            </div>

            {/* Generation Error */}
            {generateReport.isError && (
              <div
                className="flex items-center gap-2 text-sm text-red-600"
                role="alert"
              >
                <XCircle className="h-4 w-4 shrink-0" />
                <span>
                  {generateReport.error?.message ??
                    "Failed to generate report. Please try again."}
                </span>
              </div>
            )}
          </form>
        </section>

        {/* Previous Reports List */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Previous Reports
          </h2>

          {reportsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading reports...
            </div>
          ) : reportsQuery.isError ? (
            <div className="flex items-center gap-2 text-sm text-red-600 py-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Failed to load reports. Please refresh the page.</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                No reports generated yet. Use the form above to create one.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {/* Report Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {report.periodFrom && report.periodTo
                          ? `${formatDate(report.periodFrom)} — ${formatDate(report.periodTo)}`
                          : "All time"}
                      </span>
                      {report.cohort && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {report.cohort}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>
                        Created:{" "}
                        {new Date(report.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge + Actions */}
                  <div className="flex items-center gap-3">
                    <StatusBadge status={report.status} />

                    {report.status === "ready" && (
                      <div className="flex items-center gap-2">
                        {expiredReportId === report.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-amber-600">
                              Link expired.
                            </span>
                            <button
                              onClick={() => handleRegenerate(report)}
                              disabled={generateReport.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                              aria-label="Regenerate report"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Regenerate
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleDownload(report.id, "pdf")}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                              aria-label="Download PDF report"
                            >
                              <Download className="h-3 w-3" />
                              PDF
                            </button>
                            <button
                              onClick={() => handleDownload(report.id, "excel")}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                              aria-label="Download Excel report"
                            >
                              <Download className="h-3 w-3" />
                              Excel
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Status badge component */
function StatusBadge({ status }: { status: ReportStatus }) {
  switch (status) {
    case "generating":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 rounded-full">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating
        </span>
      );
    case "ready":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full">
          <CheckCircle2 className="h-3 w-3" />
          Ready
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-full">
          <XCircle className="h-3 w-3" />
          Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
          <Clock className="h-3 w-3" />
          Unknown
        </span>
      );
  }
}

/** Format a date string to a readable format */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
