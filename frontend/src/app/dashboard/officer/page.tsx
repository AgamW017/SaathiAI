'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { trpc } from '../../../lib/trpc/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type UrgencyLevel = 'critical' | 'follow_up' | 'check_in';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = '20px', radius = '8px' }: { width?: string; height?: string; radius?: string }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, #f0f0ee 25%, #e8e8e5 50%, #f0f0ee 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
  icon: React.ReactNode;
  delay?: number;
}

function KpiCard({ label, value, sub, color = '#004038', icon, delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '20px 24px',
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        border: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative tint */}
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: `${color}10`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f161e', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#615f5c' }}>{label}</div>
      {sub && <div style={{ fontSize: '12px', color: '#a09d99' }}>{sub}</div>}
    </motion.div>
  );
}

// ─── Urgency Badge ────────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; bg: string; color: string }> = {
  critical: { label: 'Critical', bg: '#fee2e2', color: '#dc2626' },
  follow_up: { label: 'Follow Up', bg: '#fef3c7', color: '#d97706' },
  check_in: { label: 'Check In', bg: '#dbeafe', color: '#2563eb' },
};

function UrgencyBadge({ urgency }: { urgency: UrgencyLevel }) {
  const cfg = URGENCY_CONFIG[urgency];
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.color,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Priority Inbox ───────────────────────────────────────────────────────────

function PriorityInbox() {
  const router = useRouter();
  const { data, isLoading, error } = trpc.dashboard.priorityInbox.useQuery({ limit: 10 });

  return (
    <div
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
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f161e', margin: 0 }}>Priority Action Inbox</h2>
          <p style={{ fontSize: '12px', color: '#615f5c', margin: '2px 0 0', lineHeight: 1 }}>Learners needing your attention today</p>
        </div>
        <div
          style={{
            background: '#fee2e2',
            color: '#dc2626',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 700,
            padding: '3px 10px',
          }}
        >
          {isLoading ? '—' : (data?.length ?? 0)} urgent
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <Skeleton width="36px" height="36px" radius="50%" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Skeleton height="14px" width="60%" />
                <Skeleton height="12px" width="80%" />
              </div>
              <Skeleton width="70px" height="22px" radius="999px" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#dc2626', fontSize: '13px' }}>
          Failed to load inbox. Check your auth token.
        </div>
      ) : data?.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#615f5c', fontSize: '14px' }}>
          🎉 No urgent actions right now.
        </div>
      ) : (
        <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
          {(data as any[])?.map((item: any, idx: number) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              whileHover={{ backgroundColor: '#fefefefe' }}
              onClick={() => router.push(`/dashboard/officer/learners/${item.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 24px',
                borderBottom: idx < (data.length - 1) ? '1px solid rgba(0,0,0,0.04)' : 'none',
                cursor: 'pointer',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: item.urgency === 'critical' ? '#fee2e2' : item.urgency === 'follow_up' ? '#fef3c7' : '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: item.urgency === 'critical' ? '#dc2626' : item.urgency === 'follow_up' ? '#d97706' : '#2563eb',
                  flexShrink: 0,
                }}
              >
                {item.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>

              {/* Info */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f161e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.full_name ?? 'Unknown'}
                </div>
                <div style={{ fontSize: '12px', color: '#615f5c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.reason} {item.trade ? `• ${item.trade}` : ''}
                </div>
              </div>

              {/* Risk score */}
              <div style={{ fontSize: '13px', fontWeight: 700, color: item.risk_score > 70 ? '#dc2626' : item.risk_score > 40 ? '#d97706' : '#16a34a', width: '28px', textAlign: 'right', flexShrink: 0 }}>
                {item.risk_score}
              </div>

              <UrgencyBadge urgency={item.urgency as UrgencyLevel} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stage Bar ────────────────────────────────────────────────────────────────

const STAGE_LABELS = ['Onboarded', 'Verified', 'Match Sent', 'Interested', 'Interview', 'Placed'];

function CohortTimeline() {
  const { data, isLoading } = trpc.dashboard.cohortTimeline.useQuery({});

  // Group by stage
  const stageBuckets = React.useMemo(() => {
    const buckets: Record<string, Array<{ stage: string;[key: string]: unknown }>> = {};
    for (const learner of data ?? []) {
      if (!buckets[learner.stage]) buckets[learner.stage] = [];
      buckets[learner.stage].push(learner);
    }
    return buckets;
  }, [data]);

  const stageKeys = ['onboarded', 'verified', 'first_match_sent', 'interest_expressed', 'interview_confirmed', 'placed'];
  const total = data?.length ?? 0;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f161e', margin: 0 }}>Cohort Journey Timeline</h2>
        <p style={{ fontSize: '12px', color: '#615f5c', margin: '2px 0 0' }}>Distribution across placement stages</p>
      </div>

      {isLoading ? (
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height="44px" radius="10px" />)}
        </div>
      ) : total === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#615f5c', fontSize: '14px' }}>
          No learner data yet.
        </div>
      ) : (
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {stageKeys.map((stage, i) => {
            const count = stageBuckets[stage]?.length ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <motion.div
                key={stage}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div style={{ width: '108px', fontSize: '12px', fontWeight: 500, color: '#615f5c', flexShrink: 0, textAlign: 'right' }}>
                  {STAGE_LABELS[i]}
                </div>
                <div style={{ flex: 1, height: '28px', background: '#f0f0ee', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, delay: i * 0.06 + 0.2, ease: 'easeOut' }}
                    style={{
                      height: '100%',
                      background: i === 5 ? '#16a34a' : i === 4 ? '#dcfce7' : i === 3 ? '#fde8ce' : i >= 1 ? '#bee9f4' : '#e0e0dc',
                      borderRadius: '6px',
                      minWidth: count > 0 ? '4px' : '0',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: '8px',
                    }}
                  />
                </div>
                <div style={{ width: '48px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#0f161e', flexShrink: 0 }}>
                  {count}
                </div>
                <div style={{ width: '36px', textAlign: 'right', fontSize: '12px', color: '#a09d99', flexShrink: 0 }}>
                  {pct}%
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Health Score ─────────────────────────────────────────────────────────────

function HealthScore() {
  const { data, isLoading } = trpc.dashboard.reports.cohortHealth.useQuery({});

  const score = data?.health_score ?? 0;
  const label = data?.health_label ?? '';
  const circumference = 2 * Math.PI * 36;
  const offset = circumference * (1 - score / 100);

  const scoreColor = score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f161e', margin: 0 }}>Cohort Health</h2>
        <p style={{ fontSize: '12px', color: '#615f5c', margin: '2px 0 0' }}>Weighted placement + at-risk score</p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Skeleton width="96px" height="96px" radius="50%" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton height="20px" width="60%" />
            <Skeleton height="14px" width="40%" />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="36" fill="none" stroke="#f0f0ee" strokeWidth="8" />
            <motion.circle
              cx="48"
              cy="48"
              r="36"
              fill="none"
              stroke={scoreColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              transform="rotate(-90 48 48)"
            />
            <text x="48" y="53" textAnchor="middle" fontSize="18" fontWeight="700" fill={scoreColor}>{score}</text>
          </svg>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: scoreColor }}>{label}</div>
            <div style={{ fontSize: '12px', color: '#615f5c', marginTop: '4px' }}>
              Placement rate: {data?.placement_rate ?? 0}%
            </div>
            <div style={{ fontSize: '12px', color: '#615f5c' }}>
              At-risk: {data?.at_risk ?? 0} learners
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OfficerOverviewPage() {
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.cohortStats.useQuery({});

  const kpiCards: KpiCardProps[] = [
    {
      label: 'Total Learners',
      value: statsLoading ? '—' : (stats?.total ?? 0),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      color: '#004038',
      delay: 0.05,
    },
    {
      label: 'Placed',
      value: statsLoading ? '—' : (stats?.placed ?? 0),
      sub: `${stats?.placement_rate ?? 0}% placement rate`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 7l-8 8-4-4-4 4" />
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
      color: '#16a34a',
      delay: 0.1,
    },
    {
      label: 'At Risk',
      value: statsLoading ? '—' : (stats?.at_risk ?? 0),
      sub: 'Needs immediate attention',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      color: '#dc2626',
      delay: 0.15,
    },
    {
      label: 'Active',
      value: statsLoading ? '—' : (stats?.active ?? 0),
      sub: 'Seeking placements',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      color: '#2563eb',
      delay: 0.2,
    },
  ];

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
          transition={{ duration: 0.35 }}
          style={{ marginBottom: '28px' }}
        >
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f161e', margin: 0 }}>
            Dashboard Overview
          </h1>
          <p style={{ fontSize: '14px', color: '#615f5c', margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </motion.div>

        {/* KPI Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {kpiCards.map((card) => (
            <KpiCard key={card.label} {...card} />
          ))}
        </div>

        {/* Main grid: Priority Inbox + Health Score side-by-side */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gap: '20px',
            marginBottom: '24px',
          }}
        >
          <PriorityInbox />
          <HealthScore />
        </div>

        {/* Cohort Timeline full width */}
        <CohortTimeline />
      </div>
    </>
  );
}
