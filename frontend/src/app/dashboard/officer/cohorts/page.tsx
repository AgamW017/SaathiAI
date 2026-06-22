'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { trpc } from '../../../../lib/trpc/client';

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

// ─── Segmented Toggle ─────────────────────────────────────────────────────────

function SegmentedToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const base: React.CSSProperties = {
    padding: '6px 16px',
    fontSize: '13px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s ease, color 0.15s ease',
    lineHeight: 1,
  };
  return (
    <div
      style={{
        display: 'inline-flex',
        background: '#eef1f0',
        borderRadius: '10px',
        padding: '3px',
        gap: '2px',
      }}
    >
      <button
        onClick={() => onChange(false)}
        style={{
          ...base,
          background: !value ? '#004038' : 'transparent',
          color: !value ? '#fff' : '#615f5c',
          borderRadius: '8px',
        }}
      >
        My Cohorts
      </button>
      <button
        onClick={() => onChange(true)}
        style={{
          ...base,
          background: value ? '#004038' : 'transparent',
          color: value ? '#fff' : '#615f5c',
          borderRadius: '8px',
        }}
      >
        All Cohorts
      </button>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

function CohortsTable({ showAll }: { showAll: boolean }) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = trpc.cohorts.list.useQuery({ all: showAll });
  const deleteMutation = trpc.cohorts.delete.useMutation();

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
    fontSize: '14px',
    color: '#333942',
    verticalAlign: 'middle',
    borderTop: '1px solid rgba(0,0,0,0.04)',
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this cohort? This action cannot be undone.')) {
      await deleteMutation.mutateAsync({ id });
      refetch();
    }
  };

  if (error) return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626', fontSize: '14px' }}>
      Failed to load cohorts — {error.message}
    </div>
  );

  const colCount = showAll ? 6 : 5;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f7f7f5' }}>
            <th style={thStyle}>Cohort Name</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Learners</th>
            <th style={thStyle}>Created On</th>
            {showAll && <th style={thStyle}>Owner</th>}
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {(showAll ? [180, 80, 60, 100, 120, 80] : [180, 80, 60, 100, 80]).map((w, j) => (
                    <td key={j} style={tdStyle}><Skeleton width={`${w}px`} /></td>
                  ))}
                </tr>
              ))
            : data?.length === 0 ? (
                <tr>
                  <td colSpan={colCount} style={{ padding: '40px', textAlign: 'center', color: '#a09d99', fontSize: '14px' }}>
                    No cohorts found. Add one to get started.
                  </td>
                </tr>
            ) : data?.map((cohort: any, idx: number) => (
                <motion.tr
                  key={cohort.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  style={{ cursor: 'pointer', transition: 'background 0.12s ease' }}
                  onClick={() => router.push(`/dashboard/officer/cohorts/${cohort.id}`)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f7f7f5'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ ...tdStyle, fontWeight: 600, color: '#0f161e' }}>
                    {cohort.name}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: '#dcfce7', color: '#16a34a' }}>
                      {cohort.status}
                    </span>
                  </td>
                  <td style={tdStyle}>{cohort.learnerCount} learners</td>
                  <td style={{ ...tdStyle, color: '#a09d99', fontSize: '13px' }}>
                    {new Date(cohort.created_at).toLocaleDateString('en-IN')}
                  </td>
                  {showAll && (
                    <td style={tdStyle}>
                      <span style={{ fontSize: '12px', color: '#615f5c' }}>
                        {cohort.officer_name ?? '—'}
                      </span>
                    </td>
                  )}
                  <td style={tdStyle}>
                    <button
                      onClick={(e) => handleDelete(e, cohort.id)}
                      style={{ padding: '6px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    >
                      Delete
                    </button>
                  </td>
                </motion.tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CohortsPage() {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div style={{ padding: '32px 32px', maxWidth: '1200px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f161e', margin: 0 }}>Cohorts</h1>
            <p style={{ fontSize: '14px', color: '#615f5c', margin: '4px 0 0' }}>
              Manage your ITI batches and upload new cohorts.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SegmentedToggle value={showAll} onChange={setShowAll} />
            <button
              onClick={() => router.push('/dashboard/officer/cohorts/upload')}
              style={{
                background: '#004038', color: '#fff', border: 'none', padding: '10px 20px',
                borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,64,56,0.2)',
              }}
            >
              + Upload Document
            </button>
          </div>
        </motion.div>

        {/* Card wrapper */}
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
          <CohortsTable showAll={showAll} />
        </motion.div>
      </div>
    </>
  );
}
