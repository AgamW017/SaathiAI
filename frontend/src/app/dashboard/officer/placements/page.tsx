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

// ─── Confirm Placement Form ───────────────────────────────────────────────────

function ConfirmPlacementForm() {
  const [form, setForm] = useState({
    learner_id: '',
    job_id: '',
    placement_date: new Date().toISOString().split('T')[0],
    salary: '',
    notes: '',
    source: 'saathai_match' as 'saathai_match' | 'officer_direct' | 'learner_self',
  });
  const [success, setSuccess] = useState(false);
  const utils = trpc.useUtils();

  const confirmMutation = trpc.dashboard.placements.confirm.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setForm({ learner_id: '', job_id: '', placement_date: new Date().toISOString().split('T')[0], salary: '', notes: '', source: 'saathai_match' });
      void utils.dashboard.placements.list.invalidate();
      setTimeout(() => setSuccess(false), 4000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.learner_id.trim() || !form.job_id.trim() || !form.placement_date) return;
    confirmMutation.mutate({
      learner_id: form.learner_id.trim(),
      job_id: form.job_id.trim(),
      placement_date: form.placement_date,
      salary: form.salary ? Number(form.salary) : undefined,
      notes: form.notes || undefined,
      source: form.source,
    });
  };

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
    transition: 'border-color 0.15s ease',
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

  const SOURCE_OPTIONS: { value: typeof form.source; label: string }[] = [
    { value: 'saathai_match', label: 'SaathiAI Match' },
    { value: 'officer_direct', label: 'Officer Direct' },
    { value: 'learner_self', label: 'Self-Sourced' },
  ];

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
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', margin: 0 }}>Confirm Placement</h2>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', margin: '2px 0 0' }}>
          Record a verified learner placement in the database
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Learner ID *</label>
            <input
              style={inputStyle}
              placeholder="UUID of the learner"
              value={form.learner_id}
              onChange={(e) => setForm((f) => ({ ...f, learner_id: e.target.value }))}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Job ID *</label>
            <input
              style={inputStyle}
              placeholder="UUID of the job"
              value={form.job_id}
              onChange={(e) => setForm((f) => ({ ...f, job_id: e.target.value }))}
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Placement Date *</label>
            <input
              type="date"
              style={inputStyle}
              value={form.placement_date}
              onChange={(e) => setForm((f) => ({ ...f, placement_date: e.target.value }))}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Monthly Salary (₹)</label>
            <input
              type="number"
              style={inputStyle}
              placeholder="e.g. 18000"
              value={form.salary}
              onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
              min="0"
            />
          </div>
          <div>
            <label style={labelStyle}>Source</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as typeof form.source }))}
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
            placeholder="Any notes about this placement…"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <AnimatePresence>
          {confirmMutation.isError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ padding: '10px 14px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', fontSize: '13px' }}
            >
              {confirmMutation.error.message}
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ padding: '10px 14px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a', fontSize: '13px', fontWeight: 600 }}
            >
              ✅ Placement confirmed and learner status updated to Placed!
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={confirmMutation.isPending || !form.learner_id.trim() || !form.job_id.trim()}
            style={{
              padding: '11px 28px',
              borderRadius: '12px',
              border: 'none',
              background: (confirmMutation.isPending || !form.learner_id.trim() || !form.job_id.trim()) ? 'rgba(0,64,56,0.4)' : '#004038',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: (confirmMutation.isPending || !form.learner_id.trim() || !form.job_id.trim()) ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease',
              fontFamily: 'inherit',
            }}
          >
            {confirmMutation.isPending ? 'Confirming…' : 'Confirm Placement'}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── Placement History ────────────────────────────────────────────────────────

function PlacementHistory() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = trpc.dashboard.placements.list.useQuery(
    { page, limit: 15 }
  );

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
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
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f161e', margin: 0 }}>Placement History</h2>
          <p style={{ fontSize: '12px', color: '#615f5c', margin: '2px 0 0' }}>All confirmed placements</p>
        </div>
        <div style={{ background: '#dcfce7', color: '#16a34a', borderRadius: '999px', fontSize: '12px', fontWeight: 700, padding: '3px 12px' }}>
          {isLoading ? '…' : (data?.total ?? 0)} total
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
                <th style={thStyle}>Learner</th>
                <th style={thStyle}>Job / Company</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Claimed</th>
                <th style={thStyle}>Reported</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Source</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {[120, 140, 80, 70, 70, 80, 90].map((w, j) => (
                        <td key={j} style={tdStyle}><Skeleton width={`${w}px`} /></td>
                      ))}
                    </tr>
                  ))
                : data?.data?.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '40px', color: '#a09d99' }}>
                        No placements recorded yet.
                      </td>
                    </tr>
                  )
                : data?.data?.map((p: any, i: number) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#0f161e' }}>
                        {(p.learners as any)?.full_name ?? p.learner_id?.slice(0, 8) ?? '—'}
                        {(p.learners as any)?.trade && (
                          <div style={{ fontSize: '11px', color: '#615f5c', fontWeight: 400 }}>{(p.learners as any).trade}</div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {(p.jobs as any)?.title ?? `Job ${p.job_id?.slice(0, 8) ?? '—'}`}
                        {(p.jobs as any)?.company && (
                          <div style={{ fontSize: '11px', color: '#615f5c' }}>{(p.jobs as any).company}</div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: '#615f5c' }}>
                        {p.placement_date ? new Date(p.placement_date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td style={tdStyle}>
                        {(p.salary_claimed ?? p.salary) ? (
                          <span style={{ fontWeight: 600, color: '#333942' }}>₹{Number(p.salary_claimed ?? p.salary).toLocaleString('en-IN')}</span>
                        ) : '—'}
                      </td>
                      <td style={tdStyle}>
                        {p.reported_salary != null ? (
                          <span
                            title={p.discrepancy?.flagged ? `Reported ${Math.round((p.discrepancy.shortfallPct ?? 0) * 100)}% below claim` : undefined}
                            style={{ fontWeight: 700, color: p.discrepancy?.flagged ? '#dc2626' : '#16a34a' }}
                          >
                            ₹{Number(p.reported_salary).toLocaleString('en-IN')}
                            {p.discrepancy?.flagged && ' ⚠️'}
                          </span>
                        ) : <span style={{ color: '#a09d99' }}>pending</span>}
                      </td>
                      <td style={tdStyle}>
                        {(() => {
                          const rs = p.retention_status ?? 'unknown';
                          const map: Record<string, { bg: string; fg: string; label: string }> = {
                            active: { bg: '#dcfce7', fg: '#16a34a', label: 'Working' },
                            left: { bg: '#fee2e2', fg: '#dc2626', label: 'Left' },
                            unknown: { bg: '#f1f0ee', fg: '#a09d99', label: 'Unknown' },
                          };
                          const m = map[rs] ?? map.unknown;
                          return <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: m.bg, color: m.fg }}>{m.label}</span>;
                        })()}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: p.source === 'saathai_match' ? '#dbeafe' : p.source === 'officer_direct' ? '#fde8ce' : '#dcfce7',
                          color: p.source === 'saathai_match' ? '#2563eb' : p.source === 'officer_direct' ? '#d97706' : '#16a34a',
                        }}>
                          {p.source === 'saathai_match' ? 'AI Match' : p.source === 'officer_direct' ? 'Officer' : 'Self'}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(data?.totalPages ?? 0) > 1 && (
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            style={{ padding: '7px 14px', borderRadius: '8px', border: '1.5px solid #e0e0dc', background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', color: page <= 1 ? '#d0cdc9' : '#333942', fontSize: '13px', fontFamily: 'inherit' }}
          >
            ← Prev
          </button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: '#615f5c' }}>
            {page} / {data?.totalPages}
          </span>
          <button
            disabled={page >= (data?.totalPages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
            style={{ padding: '7px 14px', borderRadius: '8px', border: '1.5px solid #e0e0dc', background: '#fff', cursor: page >= (data?.totalPages ?? 1) ? 'not-allowed' : 'pointer', color: page >= (data?.totalPages ?? 1) ? '#d0cdc9' : '#333942', fontSize: '13px', fontFamily: 'inherit' }}
          >
            Next →
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlacementsPage() {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div style={{ padding: '32px', maxWidth: '1100px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '24px' }}
        >
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f161e', margin: 0 }}>Placements</h1>
          <p style={{ fontSize: '14px', color: '#615f5c', margin: '4px 0 0' }}>
            Confirm and track learner placements
          </p>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <ConfirmPlacementForm />
          <PlacementHistory />
        </div>
      </div>
    </>
  );
}
