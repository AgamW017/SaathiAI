'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '../../../../../lib/trpc/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'active' | 'placed' | 'dropped' | 'at_risk' | undefined;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = '16px', radius = '6px' }: { width?: string; height?: string; radius?: string }) {
  return (
    <div
      style={{
        width, height, borderRadius: radius,
        background: 'linear-gradient(90deg,#f0f0ee 25%,#e8e8e5 50%,#f0f0ee 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  );
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  active:   { label: 'Active',    bg: '#dbeafe', color: '#2563eb' },
  placed:   { label: 'Placed',    bg: '#dcfce7', color: '#16a34a' },
  at_risk:  { label: 'At Risk',   bg: '#fee2e2', color: '#dc2626' },
  dropped:  { label: 'Dropped',   bg: '#f3f4f6', color: '#6b7280' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#f0f0ee', color: '#615f5c' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function RiskBar({ score }: { score: number }) {
  const color = score > 70 ? '#dc2626' : score > 40 ? '#d97706' : '#16a34a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '64px', height: '6px', background: '#f0f0ee', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color, width: '24px' }}>{score}</span>
    </div>
  );
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────

function StatsSection({ cohortId }: { cohortId: string }) {
  const { data, isLoading } = trpc.cohort.getCohortDetail.useQuery(
    { cohortId },
    { enabled: !!cohortId }
  );

  // Fetch cohort list to get average salary (computed server-side from placements)
  const { data: cohortListData } = trpc.cohort.listCohorts.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!cohortId }
  );

  const cohortWithSalary = cohortListData?.data?.find((c: any) => c.id === cohortId);
  const averageSalary = cohortWithSalary?.stats?.averageSalary ?? null;

  const cardStyle: React.CSSProperties = {
    flex: '1 1 0',
    minWidth: '140px',
    padding: '16px 20px',
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={cardStyle}>
            <Skeleton width="60px" height="12px" />
            <div style={{ marginTop: '8px' }}><Skeleton width="80px" height="24px" /></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}
    >
      <div style={cardStyle}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Learner Count</span>
        <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f161e', marginTop: '4px' }}>
          {data?.stats.total ?? '—'}
        </div>
      </div>
      <div style={cardStyle}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Placement Rate</span>
        <div style={{ fontSize: '24px', fontWeight: 700, color: '#004038', marginTop: '4px' }}>
          {data?.stats.placementRate != null ? `${data.stats.placementRate}%` : '—'}
        </div>
      </div>
      <div style={cardStyle}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Average Salary</span>
        <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f161e', marginTop: '4px' }}>
          {averageSalary != null ? `₹${averageSalary.toLocaleString('en-IN')}` : '—'}
        </div>
      </div>
      <div style={cardStyle}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created</span>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f161e', marginTop: '8px' }}>
          {data?.cohort.createdAt
            ? new Date(data.cohort.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—'}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface Filters {
  status: StatusFilter;
  trade: string;
  district: string;
}

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: undefined, label: 'All Statuses' },
    { value: 'active',  label: 'Active' },
    { value: 'placed',  label: 'Placed' },
    { value: 'at_risk', label: 'At Risk' },
    { value: 'dropped', label: 'Dropped' },
  ];

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1.5px solid #e0e0dc',
    fontSize: '13px',
    color: '#333942',
    background: '#fff',
    cursor: 'pointer',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1.5px solid #e0e0dc',
    fontSize: '13px',
    color: '#333942',
    background: '#fff',
    outline: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      <select
        style={selectStyle}
        value={filters.status ?? ''}
        onChange={(e) => onChange({ ...filters, status: (e.target.value as StatusFilter) || undefined })}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.label} value={o.value ?? ''}>{o.label}</option>
        ))}
      </select>
      <input
        style={inputStyle}
        placeholder="Filter by trade…"
        value={filters.trade}
        onChange={(e) => onChange({ ...filters, trade: e.target.value })}
      />
      <input
        style={inputStyle}
        placeholder="Filter by district…"
        value={filters.district}
        onChange={(e) => onChange({ ...filters, district: e.target.value })}
      />
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

function LearnersTable({ cohortId, page, filters, onTotalChange }: { cohortId: string; page: number; filters: Filters; onTotalChange: (total: number, totalPages: number) => void }) {
  const router = useRouter();

  const { data, isLoading, error } = trpc.dashboard.learner.list.useQuery(
    {
      page,
      limit: 20,
      status: filters.status,
      trade: filters.trade || undefined,
      district: filters.district || undefined,
      cohort_id: cohortId,
    },
    {
      keepPreviousData: true,
      onSuccess: (d: { total: number; totalPages: number }) => onTotalChange(d.total, d.totalPages),
    } as any
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

  if (error) return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626', fontSize: '14px' }}>
      Failed to load learners — {error.message}
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f7f7f5' }}>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Phone</th>
            <th style={thStyle}>Trade</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Risk Score</th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {[140, 100, 100, 80, 100].map((w, j) => (
                    <td key={j} style={tdStyle}><Skeleton width={`${w}px`} /></td>
                  ))}
                </tr>
              ))
            : data?.data?.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#a09d99', fontSize: '14px' }}>
                    No learners found in this cohort.
                  </td>
                </tr>
              ) : data?.data?.map((learner: any, idx: number) => (
                <motion.tr
                  key={learner.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  style={{ cursor: 'pointer', transition: 'background 0.12s ease' }}
                  onClick={() => router.push(`/dashboard/officer/learners/${learner.id}`)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f7f7f5'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ ...tdStyle, fontWeight: 600, color: '#0f161e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg,#004038,#006b5a)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#fff',
                          flexShrink: 0,
                        }}
                      >
                        {(learner.full_name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <span>{learner.full_name ?? '—'}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{learner.phone ?? '—'}</td>
                  <td style={tdStyle}>{learner.trade ?? '—'}</td>
                  <td style={tdStyle}><StatusBadge status={learner.status} /></td>
                  <td style={tdStyle}><RiskBar score={learner.risk_score ?? 0} /></td>
                </motion.tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  const btnStyle = (active: boolean, disabled?: boolean): React.CSSProperties => ({
    padding: '7px 14px',
    borderRadius: '8px',
    border: active ? 'none' : '1.5px solid #e0e0dc',
    background: active ? '#004038' : '#fff',
    color: active ? '#fff' : disabled ? '#d0cdc9' : '#333942',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <span style={{ fontSize: '13px', color: '#615f5c' }}>
        {total} learner{total !== 1 ? 's' : ''} total
      </span>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button style={btnStyle(false, page <= 1)} disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = i + 1;
          return (
            <button key={p} style={btnStyle(p === page)} onClick={() => onPage(p)}>{p}</button>
          );
        })}
        {totalPages > 5 && <span style={{ fontSize: '13px', color: '#a09d99' }}>…{totalPages}</span>}
        <button style={btnStyle(false, page >= totalPages)} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next →</button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CohortDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const cohortId = params.id as string;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<Filters>({ status: undefined, trade: '', district: '' });

  const handleFilterChange = (f: Filters) => {
    setFilters(f);
    setPage(1);
  };

  const { data: cohortData, isLoading: cohortLoading } = trpc.cohort.getCohortDetail.useQuery(
    { cohortId },
    { enabled: !!cohortId }
  );

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div style={{ padding: '32px 32px', maxWidth: '1200px' }}>
        {/* Header with back button */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '24px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => router.push('/dashboard/officer/cohorts')}
              style={{
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px', borderRadius: '8px', background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: '#004038', fontSize: '16px', fontWeight: 700,
              }}
              aria-label="Back to cohorts"
            >
              ←
            </button>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f161e', margin: 0 }}>
                {cohortLoading ? <Skeleton width="200px" height="24px" /> : (cohortData?.cohort?.name ?? 'Cohort Details')}
              </h1>
              <p style={{ fontSize: '14px', color: '#615f5c', margin: '4px 0 0' }}>
                View cohort statistics and manage learners
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <StatsSection cohortId={cohortId} />

        {/* Learner Table Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
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
          {/* Section heading */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f161e', margin: 0 }}>Learners</h2>
            <FilterBar filters={filters} onChange={handleFilterChange} />
          </div>

          <LearnersTable cohortId={cohortId} page={page} filters={filters} onTotalChange={(t, tp) => { setTotal(t); setTotalPages(tp); }} />
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </motion.div>
      </div>
    </>
  );
}
