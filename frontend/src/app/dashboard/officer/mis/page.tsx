'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '../../../../lib/trpc/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = '16px', radius = '6px' }: { width?: string; height?: string; radius?: string }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg,#f0f0ee 25%,#e8e8e5 50%,#f0f0ee 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    ready: { bg: '#dcfce7', fg: '#16a34a' },
    failed: { bg: '#fee2e2', fg: '#dc2626' },
    pending: { bg: '#fef9c3', fg: '#ca8a04' },
  };
  const s = map[status] ?? { bg: '#f1f0ee', fg: '#a09d99' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.fg, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}

// ─── Generate Form ────────────────────────────────────────────────────────────

function GenerateForm({ onGenerated }: { onGenerated: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const firstOfYear = `${new Date().getFullYear()}-01-01`;

  const [periodFrom, setPeriodFrom] = useState(firstOfYear);
  const [periodTo, setPeriodTo] = useState(today);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [success, setSuccess] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const { data: cohortsData, isLoading: cohortsLoading } = trpc.cohort.listCohorts.useQuery({ page: 1, limit: 100 });

  const generateMutation = trpc.reports.generateMISReport.useMutation({
    onSuccess: (data) => {
      setSuccess(true);
      setAiAnalysis(data.report?.aiAnalysis ?? null);
      onGenerated();
      setTimeout(() => setSuccess(false), 8000);
    },
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1.5px solid #e0e0dc',
    fontSize: '14px',
    color: '#0f161e',
    background: '#fff',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: '#615f5c',
    display: 'block',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodFrom || !periodTo) return;
    generateMutation.mutate({
      periodFrom,
      periodTo,
      cohort: selectedCohort || undefined,
    });
  };

  const cohorts = cohortsData?.data ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #004038, #006b5a)',
        padding: '20px 24px',
      }}>
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', margin: 0 }}>Generate MIS Report</h2>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', margin: '2px 0 0' }}>
          Generate a placement & retention summary report for DSSDO submission
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Cohort selector */}
        <div>
          <label style={labelStyle}>Cohort (optional — leave blank for all your cohorts)</label>
          {cohortsLoading ? (
            <Skeleton height="42px" radius="10px" />
          ) : (
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
            >
              <option value="">All my cohorts</option>
              {cohorts.map((c: any) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Date range */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Period From *</label>
            <input
              type="date"
              style={inputStyle}
              value={periodFrom}
              max={periodTo}
              onChange={(e) => setPeriodFrom(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Period To *</label>
            <input
              type="date"
              style={inputStyle}
              value={periodTo}
              min={periodFrom}
              max={today}
              onChange={(e) => setPeriodTo(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Info banner */}
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          background: '#f0f9ff', border: '1px solid #bae6fd',
          fontSize: '13px', color: '#0369a1',
        }}>
          Report includes: placement rate, average salary, retention at 30/60/90 days, trade distribution, and employer breakdown — all scoped to your cohorts only.
        </div>

        <AnimatePresence>
          {generateMutation.isError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ padding: '10px 14px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', fontSize: '13px' }}
            >
              {generateMutation.error.message}
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ padding: '10px 14px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a', fontSize: '13px', fontWeight: 600 }}
            >
              ✅ Report generated! See it below in the history.
            </motion.div>
          )}
          {success && aiAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                borderRadius: '12px',
                border: '1.5px solid #a5f3fc',
                background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                overflow: 'hidden',
              }}
            >
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #bae6fd',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ fontSize: '16px' }}>🤖</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0369a1' }}>AI Analysis</span>
                <span style={{ fontSize: '11px', color: '#7dd3fc', marginLeft: 'auto' }}>Verify before submission</span>
              </div>
              <div style={{ padding: '14px 16px' }}>
                {aiAnalysis.split('\n').filter(Boolean).map((line, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#0c4a6e', lineHeight: 1.6, marginBottom: '6px' }}>
                    {line}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          {generateMutation.data?.hasData === false && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ padding: '10px 14px', borderRadius: '10px', background: '#fef9c3', color: '#ca8a04', fontSize: '13px' }}
            >
              No data found for these filters. Try a broader date range or different cohort.
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={generateMutation.isPending || !periodFrom || !periodTo}
            style={{
              padding: '11px 28px',
              borderRadius: '12px',
              border: 'none',
              background: generateMutation.isPending ? 'rgba(0,64,56,0.4)' : '#004038',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: generateMutation.isPending ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {generateMutation.isPending ? (
              <>
                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Generating…
              </>
            ) : 'Generate Report'}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── Reports History ──────────────────────────────────────────────────────────

function ReportHistory({ refreshKey }: { refreshKey: number }) {
  const { data, isLoading, error, refetch } = trpc.reports.getReportsList.useQuery(undefined, {
    queryKey: ['reports.getReportsList', refreshKey],
  } as any);

  // Trigger refetch when refreshKey changes
  React.useEffect(() => { void refetch(); }, [refreshKey, refetch]);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const handleDownload = async (reportId: string) => {
    setDownloadingId(reportId);
    try {
      const result = await utils.reports.downloadReport.fetch({ reportId });
      if (result?.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      }
    } catch (err: any) {
      alert(err?.message ?? 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 700,
    color: '#a09d99',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '13px 16px',
    fontSize: '13px',
    color: '#333942',
    verticalAlign: 'middle',
    borderTop: '1px solid rgba(0,0,0,0.04)',
  };

  const reports = data?.reports ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f161e', margin: 0 }}>Report History</h2>
          <p style={{ fontSize: '12px', color: '#615f5c', margin: '2px 0 0' }}>Download links expire after 24 hours</p>
        </div>
        <div style={{ background: '#f1f0ee', color: '#615f5c', borderRadius: '999px', fontSize: '12px', fontWeight: 600, padding: '3px 12px' }}>
          {isLoading ? '…' : reports.length} reports
        </div>
      </div>

      {error ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626', fontSize: '14px' }}>
          Failed to load — {error.message}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f7f5' }}>
                <th style={thStyle}>Period</th>
                <th style={thStyle}>Cohort</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Generated</th>
                <th style={thStyle}>Download</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      {[180, 120, 80, 120, 100].map((w, j) => (
                        <td key={j} style={tdStyle}><Skeleton width={`${w}px`} /></td>
                      ))}
                    </tr>
                  ))
                : reports.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '48px', color: '#a09d99' }}>
                        No reports generated yet. Use the form above to create one.
                      </td>
                    </tr>
                  )
                : reports.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#0f161e' }}>
                        {new Date(r.period_from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' — '}
                        {new Date(r.period_to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={tdStyle}>
                        {r.cohort ? (
                          <span style={{ padding: '2px 10px', borderRadius: '999px', background: '#bee9f4', color: '#2563eb', fontSize: '12px', fontWeight: 500 }}>
                            {r.cohort}
                          </span>
                        ) : (
                          <span style={{ color: '#a09d99' }}>All cohorts</span>
                        )}
                      </td>
                      <td style={tdStyle}><StatusBadge status={r.status} /></td>
                      <td style={{ ...tdStyle, color: '#615f5c' }}>
                        {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={tdStyle}>
                        {r.status === 'ready' && r.file_url ? (
                          <button
                            onClick={() => void handleDownload(r.id)}
                            disabled={downloadingId === r.id}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '8px',
                              border: 'none',
                              background: downloadingId === r.id ? 'rgba(0,64,56,0.4)' : '#004038',
                              color: '#fff',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: downloadingId === r.id ? 'not-allowed' : 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            {downloadingId === r.id ? 'Opening…' : 'Download PDF'}
                          </button>
                        ) : r.status === 'failed' ? (
                          <span style={{ color: '#dc2626', fontSize: '12px' }}>Generation failed</span>
                        ) : (
                          <span style={{ color: '#a09d99', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MISPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ padding: '32px', maxWidth: '1000px' }}>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '24px' }}
        >
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f161e', margin: 0 }}>MIS Reports</h1>
          <p style={{ fontSize: '14px', color: '#615f5c', margin: '4px 0 0' }}>
            Generate monthly information system reports for DSSDO submission
          </p>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <GenerateForm onGenerated={() => setRefreshKey((k) => k + 1)} />
          <ReportHistory refreshKey={refreshKey} />
        </div>
      </div>
    </>
  );
}
