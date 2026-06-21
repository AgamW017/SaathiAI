'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '../../../../lib/trpc/client';
import VerificationBadge from '../../../../components/ui/VerificationBadge';

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

// ─── Employer Card ────────────────────────────────────────────────────────────

interface EmployerCardProps {
  employer: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    district: string | null;
    created_at: string | null;
    total_jobs: number;
    active_jobs: number;
    trades: string[];
    verification_status?: string | null;
    company_name?: string | null;
  };
  onClick: () => void;
}

function EmployerCard({ employer, onClick }: EmployerCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        background: '#fff',
        borderRadius: '14px',
        padding: '20px',
        border: `1.5px solid ${hovered ? '#004038' : 'rgba(0,0,0,0.07)'}`,
        boxShadow: hovered ? '0 4px 16px rgba(0,64,56,0.1)' : '0 1px 6px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div
          style={{
            width: '42px', height: '42px', borderRadius: '10px',
            background: 'linear-gradient(135deg,#fa5d00,#ff7a33)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 700, color: '#fff', flexShrink: 0,
          }}
        >
          {(employer.full_name ?? employer.email ?? 'E').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f161e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {employer.company_name ?? employer.full_name ?? employer.email ?? 'Unnamed Employer'}
          </div>
          <div style={{ fontSize: '12px', color: '#615f5c', marginBottom: '6px' }}>
            {employer.district ?? 'No district'}
          </div>
          <VerificationBadge status={employer.verification_status} compact />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1, background: '#f7f7f5', borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#004038' }}>{employer.active_jobs}</div>
          <div style={{ fontSize: '11px', color: '#615f5c', fontWeight: 500 }}>Active Jobs</div>
        </div>
        <div style={{ flex: 1, background: '#f7f7f5', borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#333942' }}>{employer.total_jobs}</div>
          <div style={{ fontSize: '11px', color: '#615f5c', fontWeight: 500 }}>Total Jobs</div>
        </div>
      </div>

      {/* Trades */}
      {employer.trades?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {employer.trades.slice(0, 3).map((trade: string) => (
            <span
              key={trade}
              style={{
                padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 500,
                background: '#bee9f4', color: '#2563eb',
              }}
            >
              {trade}
            </span>
          ))}
          {employer.trades.length > 3 && (
            <span style={{ fontSize: '11px', color: '#a09d99', padding: '2px 0' }}>+{employer.trades.length - 3}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Manual Match Modal ───────────────────────────────────────────────────────

function ManualMatchModal({
  employerId,
  onClose,
}: {
  employerId: string;
  onClose: () => void;
}) {
  const [learnerId, setLearnerId] = useState('');
  const [jobId, setJobId] = useState('');
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);

  const matchMutation = trpc.dashboard.employers.createManualMatch.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 2000);
    },
  });

  // Fetch employer details to get their job IDs
  const { data: detail } = trpc.dashboard.employers.byId.useQuery({ id: employerId });

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

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: '20px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          background: '#fff', borderRadius: '20px', padding: '28px',
          width: '100%', maxWidth: '480px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f161e', margin: '0 0 4px' }}>Create Manual Match</h2>
        <p style={{ fontSize: '13px', color: '#615f5c', margin: '0 0 20px' }}>
          Match a learner to a job at {detail?.employer?.full_name ?? detail?.employer?.email ?? 'this employer'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#615f5c', display: 'block', marginBottom: '6px' }}>Learner ID</label>
            <input style={inputStyle} placeholder="Paste learner UUID…" value={learnerId} onChange={(e) => setLearnerId(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#615f5c', display: 'block', marginBottom: '6px' }}>Job</label>
            {detail?.jobs && detail.jobs.length > 0 ? (
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              >
                <option value="">Select a job…</option>
                {detail.jobs.map((job: any) => (
                  <option key={job.id} value={job.id}>{job.title ?? `Job ${job.id.slice(0, 8)}`}</option>
                ))}
              </select>
            ) : (
              <input style={inputStyle} placeholder="Paste job UUID…" value={jobId} onChange={(e) => setJobId(e.target.value)} />
            )}
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#615f5c', display: 'block', marginBottom: '6px' }}>Officer Note (optional)</label>
            <textarea
              style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
              placeholder="Reason for this match…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {matchMutation.isError && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', fontSize: '13px' }}>
              {matchMutation.error.message}
            </div>
          )}
          {success && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a', fontSize: '13px', fontWeight: 600 }}>
              ✅ Match created successfully!
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              onClick={onClose}
              style={{ padding: '10px 20px', borderRadius: '10px', border: '1.5px solid #e0e0dc', background: 'transparent', color: '#615f5c', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!learnerId.trim() || !jobId.trim()) return;
                matchMutation.mutate({ learner_id: learnerId.trim(), job_id: jobId.trim(), officer_note: note || undefined });
              }}
              disabled={matchMutation.isPending || !learnerId.trim() || !jobId.trim()}
              style={{
                padding: '10px 20px', borderRadius: '10px', border: 'none',
                background: matchMutation.isPending ? 'rgba(0,64,56,0.5)' : '#004038',
                color: '#fff', fontSize: '14px', fontWeight: 600,
                cursor: (matchMutation.isPending || !learnerId.trim() || !jobId.trim()) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {matchMutation.isPending ? 'Creating…' : 'Create Match'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const { data, isLoading } = trpc.dashboard.employers.list.useQuery(
    { page, limit: 12, search: search || undefined },
    {
      keepPreviousData: true,
      onSuccess: (d: any) => { setTotal(d.total); setTotalPages(d.totalPages); },
    } as any
  );

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div style={{ padding: '32px', maxWidth: '1200px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}
        >
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f161e', margin: 0 }}>Employers</h1>
            <p style={{ fontSize: '14px', color: '#615f5c', margin: '4px 0 0' }}>
              {total} employer{total !== 1 ? 's' : ''} in your directory
            </p>
          </div>
        </motion.div>

        {/* Search */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a09d99" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                borderRadius: '12px',
                border: '1.5px solid #e0e0dc',
                fontSize: '14px',
                color: '#0f161e',
                background: '#fff',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              placeholder="Search employers…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: '14px', padding: '20px', border: '1.5px solid rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <Skeleton width="42px" height="42px" radius="10px" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <Skeleton height="16px" width="70%" />
                    <Skeleton height="12px" width="40%" />
                  </div>
                </div>
                <Skeleton height="50px" radius="8px" />
              </div>
            ))}
          </div>
        ) : data?.data?.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#615f5c', fontSize: '14px' }}>
            No employers found.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {data?.data?.map((employer: any) => (
              <div key={employer.id} style={{ position: 'relative' }}>
                <EmployerCard employer={employer} onClick={() => {}} />
                <button
                  onClick={() => setSelectedEmployerId(employer.id)}
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    right: '16px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#004038',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#005c50'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#004038'; }}
                >
                  + Match
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #e0e0dc', background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', color: page <= 1 ? '#d0cdc9' : '#333942', fontSize: '13px', fontFamily: 'inherit' }}
            >
              ← Prev
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: '#615f5c', padding: '0 8px' }}>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #e0e0dc', background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: page >= totalPages ? '#d0cdc9' : '#333942', fontSize: '13px', fontFamily: 'inherit' }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Manual Match Modal */}
      <AnimatePresence>
        {selectedEmployerId && (
          <ManualMatchModal
            employerId={selectedEmployerId}
            onClose={() => setSelectedEmployerId(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
