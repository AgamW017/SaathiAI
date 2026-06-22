'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { trpc } from '../../../../lib/trpc/client';
import IndiaLearnerMap from '../../../../components/district/IndiaLearnerMap';

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
  sub?: React.ReactNode;
  color?: string;
  icon: React.ReactNode;
  delay?: number;
  hero?: boolean;
}

function KpiCard({ label, value, sub, color = '#004038', icon, delay = 0, hero = false }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      style={{
        background: hero ? `linear-gradient(135deg, ${color}08, ${color}14)` : '#fff',
        borderRadius: '16px',
        padding: hero ? '24px 28px' : '20px 24px',
        boxShadow: hero ? `0 2px 12px ${color}20` : '0 1px 6px rgba(0,0,0,0.06)',
        border: hero ? `1.5px solid ${color}30` : '1px solid rgba(0,0,0,0.06)',
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
          width: hero ? '120px' : '80px',
          height: hero ? '120px' : '80px',
          borderRadius: '50%',
          background: `${color}10`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          width: hero ? '40px' : '36px',
          height: hero ? '40px' : '36px',
          borderRadius: '10px',
          background: `${color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: hero ? '36px' : '28px', fontWeight: 700, color: hero ? color : '#0f161e', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: hero ? '14px' : '13px', fontWeight: 600, color: hero ? color : '#615f5c' }}>{label}</div>
      {sub && <div style={{ fontSize: '12px', color: '#a09d99' }}>{sub}</div>}
    </motion.div>
  );
}

// ─── Delta Badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ pct }: { pct: number }) {
  const positive = pct >= 0;
  return (
    <span style={{ color: positive ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
      {positive ? '▲' : '▼'} {Math.abs(pct)}% vs last 30d
    </span>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  caption,
  children,
  tint = false,
  rightSlot,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
  tint?: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: tint ? 'linear-gradient(135deg, #f0faf8, #e6f5f2)' : '#fff',
        borderRadius: '16px',
        border: tint ? '1.5px solid rgba(0,64,56,0.12)' : '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f161e', margin: 0 }}>{title}</h2>
          {caption && (
            <p style={{ fontSize: '12px', color: '#615f5c', margin: '2px 0 0', lineHeight: 1.3 }}>{caption}</p>
          )}
        </div>
        {rightSlot}
      </div>
      <div style={{ padding: '20px 24px' }}>{children}</div>
    </div>
  );
}

// ─── Snapshot Section ─────────────────────────────────────────────────────────

function SnapshotSection() {
  const { data, isLoading } = trpc.district.snapshot.useQuery();

  const cards: KpiCardProps[] = [
    {
      label: 'Enrolled',
      value: isLoading ? '—' : (data?.enrolled ?? 0),
      sub: isLoading ? undefined : <DeltaBadge pct={data?.enrolled_delta_pct ?? 0} />,
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
      value: isLoading ? '—' : (data?.placed ?? 0),
      sub: isLoading ? undefined : <DeltaBadge pct={data?.placed_delta_pct ?? 0} />,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      color: '#16a34a',
      delay: 0.1,
    },
    {
      label: 'Placement Rate',
      value: isLoading ? '—' : `${data?.placement_rate ?? 0}%`,
      sub: 'District hero metric',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ),
      color: '#fa5d00',
      delay: 0.15,
      hero: true,
    },
    {
      label: 'Avg Days to Placement',
      value: isLoading ? '—' : (data?.avg_time_to_placement_days == null ? '—' : `${data.avg_time_to_placement_days}d`),
      sub: 'Median onboarding speed',
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1.3fr 1fr',
        gap: '16px',
        marginBottom: '24px',
      }}
    >
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
}

// ─── Monthly Summary ──────────────────────────────────────────────────────────

function MonthlySummary() {
  const { data, isLoading, error } = trpc.district.monthlySummary.useQuery();

  const renderSummary = (text: string) => {
    const lines = text.split('\n').filter(Boolean);
    return lines.map((line, i) => {
      if (/^Recommended actions:/i.test(line)) {
        return (
          <p key={i} style={{ fontWeight: 700, color: '#004038', margin: '12px 0 4px', fontSize: '14px' }}>
            {line}
          </p>
        );
      }
      if (/^\d+\./.test(line.trim())) {
        return (
          <p key={i} style={{ margin: '4px 0 4px 12px', fontSize: '14px', color: '#0f161e', lineHeight: 1.6 }}>
            {line}
          </p>
        );
      }
      return (
        <p key={i} style={{ margin: '0 0 8px', fontSize: '14px', color: '#0f161e', lineHeight: 1.7 }}>
          {line}
        </p>
      );
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      style={{
        background: 'linear-gradient(135deg, #f0faf8, #e8f5f0)',
        borderRadius: '16px',
        border: '1.5px solid rgba(0,64,56,0.15)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        marginBottom: '24px',
      }}
    >
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(0,64,56,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f161e', margin: 0, flex: 1 }}>
          Monthly District Briefing
        </h2>
        <span
          style={{
            background: '#004038',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '999px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          AI
        </span>
      </div>
      <div style={{ padding: '20px 24px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Skeleton height="16px" width="90%" />
            <Skeleton height="16px" width="85%" />
            <Skeleton height="16px" width="75%" />
            <Skeleton height="16px" width="88%" />
            <p style={{ fontSize: '13px', color: '#615f5c', margin: '8px 0 0', fontStyle: 'italic' }}>
              Generating your monthly briefing...
            </p>
          </div>
        ) : error ? (
          <p style={{ fontSize: '13px', color: '#a09d99', margin: 0 }}>Could not load monthly summary.</p>
        ) : (
          <>
            <div>{renderSummary(data?.summary ?? '')}</div>
            {data?.generated_at && (
              <p style={{ fontSize: '11px', color: '#a09d99', margin: '12px 0 0', borderTop: '1px solid rgba(0,64,56,0.08)', paddingTop: '10px' }}>
                Generated{' '}
                {new Date(data.generated_at).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Centre Leaderboard ───────────────────────────────────────────────────────

function CentreLeaderboard() {
  const { data, isLoading, error } = trpc.district.centreLeaderboard.useQuery();

  const maxRate = React.useMemo(() => {
    if (!data?.length) return 100;
    return Math.max(...data.map((c) => c.placement_rate), 1);
  }, [data]);

  const bottomThree = React.useMemo(() => {
    if (!data?.length) return new Set<string>();
    const sorted = [...data].sort((a, b) => a.placement_rate - b.placement_rate);
    return new Set(sorted.slice(0, 3).map((c) => c.centre));
  }, [data]);

  return (
    <SectionCard title="Centre Leaderboard" caption="Ranked by placement rate">
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height="48px" radius="10px" />
          ))}
        </div>
      ) : error ? (
        <p style={{ fontSize: '13px', color: '#a09d99', margin: 0 }}>Could not load leaderboard.</p>
      ) : !data?.length ? (
        <p style={{ fontSize: '13px', color: '#615f5c', margin: 0, textAlign: 'center', padding: '20px 0' }}>No centre data yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 70px 60px 180px 70px',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '8px',
              background: '#f7f7f5',
              marginBottom: '6px',
            }}
          >
            {['#', 'Centre', 'Enrolled', 'Placed', 'Placement Rate', 'Avg Risk'].map((h) => (
              <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {h}
              </div>
            ))}
          </div>
          {data.map((centre, idx) => {
            const isTop = idx === 0;
            const isBottom = bottomThree.has(centre.centre);
            return (
              <motion.div
                key={centre.centre}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr 70px 60px 180px 70px',
                  gap: '8px',
                  padding: '10px 10px',
                  borderRadius: '10px',
                  marginBottom: '4px',
                  background: isTop ? 'rgba(0,64,56,0.04)' : 'transparent',
                  borderLeft: isBottom ? '3px solid rgba(220,38,38,0.35)' : isTop ? '3px solid rgba(0,64,56,0.35)' : '3px solid transparent',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: isTop ? '#004038' : '#a09d99' }}>
                  {idx + 1}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f161e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {centre.centre}
                  {isTop && (
                    <span style={{ marginLeft: '6px', fontSize: '10px', background: '#004038', color: '#fff', padding: '1px 6px', borderRadius: '999px', fontWeight: 600 }}>
                      Top
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: '#0f161e' }}>{centre.enrolled}</div>
                <div style={{ fontSize: '13px', color: '#0f161e' }}>{centre.placed}</div>
                {/* Rate bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '8px', background: '#f0f0ee', borderRadius: '999px', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(centre.placement_rate / maxRate) * 100}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.04 + 0.2, ease: 'easeOut' }}
                      style={{ height: '100%', background: '#004038', borderRadius: '999px', minWidth: centre.placement_rate > 0 ? '3px' : '0' }}
                    />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f161e', whiteSpace: 'nowrap', minWidth: '34px', textAlign: 'right' }}>
                    {centre.placement_rate}%
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: centre.avg_risk_score != null && centre.avg_risk_score > 60 ? '#dc2626' : centre.avg_risk_score != null && centre.avg_risk_score > 40 ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                  {centre.avg_risk_score != null ? centre.avg_risk_score : '—'}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Trade Performance ────────────────────────────────────────────────────────

function TradePerformance() {
  const { data, isLoading, error } = trpc.district.tradePerformance.useQuery();

  const maxRate = React.useMemo(() => {
    if (!data?.length) return 100;
    return Math.max(...data.map((t) => t.placement_rate), 1);
  }, [data]);

  return (
    <SectionCard title="Trade Performance" caption="Sorted by placement rate">
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height="42px" radius="8px" />)}
        </div>
      ) : error ? (
        <p style={{ fontSize: '13px', color: '#a09d99', margin: 0 }}>Could not load trade data.</p>
      ) : !data?.length ? (
        <p style={{ fontSize: '13px', color: '#615f5c', margin: 0, textAlign: 'center', padding: '20px 0' }}>No trade data yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.map((trade, idx) => {
            const isStrong = trade.placement_rate >= 60;
            const isStalled = trade.placement_rate < 25;
            return (
              <motion.div
                key={trade.trade}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f161e', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {trade.trade}
                  </span>
                  {isStrong && (
                    <span style={{ fontSize: '10px', fontWeight: 700, background: '#dcfce7', color: '#16a34a', padding: '2px 7px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                      Strong
                    </span>
                  )}
                  {isStalled && (
                    <span style={{ fontSize: '10px', fontWeight: 700, background: '#fef3c7', color: '#d97706', padding: '2px 7px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                      Stalled
                    </span>
                  )}
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f161e', minWidth: '34px', textAlign: 'right' }}>
                    {trade.placement_rate}%
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '7px', background: '#f0f0ee', borderRadius: '999px', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(trade.placement_rate / maxRate) * 100}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.05 + 0.2, ease: 'easeOut' }}
                      style={{
                        height: '100%',
                        background: isStrong ? '#16a34a' : isStalled ? '#f59e0b' : '#004038',
                        borderRadius: '999px',
                        minWidth: trade.placement_rate > 0 ? '3px' : '0',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: '#a09d99', minWidth: '48px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {trade.avg_time_to_placement_days != null ? `${trade.avg_time_to_placement_days}d avg` : 'no data'}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Labour Market Gap ────────────────────────────────────────────────────────

function LabourMarketGap() {
  const { data, isLoading, error } = trpc.district.labourMarket.useQuery();

  const sorted = React.useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.gap - a.gap);
  }, [data]);

  return (
    <SectionCard
      title="Demand–Supply Gap"
      caption="Where employers want workers but the district isn't training enough."
    >
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height="52px" radius="8px" />)}
        </div>
      ) : error ? (
        <p style={{ fontSize: '13px', color: '#a09d99', margin: 0 }}>Could not load market data.</p>
      ) : !sorted.length ? (
        <p style={{ fontSize: '13px', color: '#615f5c', margin: 0, textAlign: 'center', padding: '20px 0' }}>No labour market data yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sorted.map((row, idx) => {
            const positive = row.gap > 0;
            return (
              <motion.div
                key={row.trade}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                style={{
                  background: positive ? 'rgba(250,93,0,0.04)' : '#fafafa',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  border: positive ? '1px solid rgba(250,93,0,0.12)' : '1px solid rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f161e', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.trade}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: positive ? '#fa5d00' : '#a09d99',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {positive ? `+${row.gap} unmet` : row.gap === 0 ? 'Balanced' : `${row.gap} surplus`}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: '#615f5c' }}>
                    Demand: <strong style={{ color: '#0f161e' }}>{row.demand}</strong>
                  </span>
                  <span style={{ fontSize: '11px', color: '#615f5c' }}>
                    Supply: <strong style={{ color: '#0f161e' }}>{row.supply}</strong>
                  </span>
                  {row.avg_salary != null && (
                    <span style={{ fontSize: '11px', color: '#615f5c' }}>
                      Avg: <strong style={{ color: '#0f161e' }}>
                        {'₹'}{row.avg_salary.toLocaleString('en-IN')}
                      </strong>
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Geo Distribution ─────────────────────────────────────────────────────────

function GeoDistributionSection() {
  const { data, isLoading, error } = trpc.district.geoDistribution.useQuery();

  const officerKey = (data?.officer_district ?? '').trim().toLowerCase();

  // Pin officer's district at top; fill zeros if absent from byDistrict
  const topDistricts = React.useMemo(() => {
    if (!data) return [];
    const list = [...(data.byDistrict ?? [])].sort((a, b) => b.count - a.count);
    const officerInList = list.find(
      (d) => d.district.trim().toLowerCase() === officerKey,
    );
    const top8 = list.filter((d) => d.district.trim().toLowerCase() !== officerKey).slice(0, 8);
    if (data.officer_district) {
      const pinned = officerInList ?? {
        district: data.officer_district,
        state: data.officer_state ?? null,
        count: 0,
        placed: 0,
      };
      return [pinned, ...top8];
    }
    return list.slice(0, 8);
  }, [data, officerKey]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.28 }}
      style={{ marginBottom: '24px' }}
    >
      <SectionCard
        title="Where learners are"
        caption="Learner distribution across districts — your district highlighted."
      >
        {error ? (
          <p style={{ fontSize: '13px', color: '#a09d99', margin: 0 }}>
            Could not load geographic data.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 300px',
              gap: '24px',
              alignItems: 'flex-start',
            }}
          >
            {/* Left: map */}
            <div>
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Skeleton height="400px" radius="12px" />
                </div>
              ) : (
                <IndiaLearnerMap
                  data={data?.byDistrict ?? []}
                  officerDistrict={data?.officer_district ?? null}
                />
              )}
            </div>

            {/* Right: top district list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#a09d99',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '8px',
                }}
              >
                Top Districts
              </div>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} height="44px" radius="8px" />
                  ))
                : topDistricts.map((d, idx) => {
                    const isOfficer =
                      !!data?.officer_district &&
                      d.district.trim().toLowerCase() === officerKey;
                    return (
                      <div
                        key={d.district}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '10px',
                          background: isOfficer
                            ? 'rgba(250,93,0,0.06)'
                            : idx % 2 === 0
                            ? '#fafafa'
                            : 'transparent',
                          border: isOfficer
                            ? '1px solid rgba(250,93,0,0.18)'
                            : '1px solid transparent',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: isOfficer ? '#fa5d00' : '#0f161e',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              {d.district}
                              {isOfficer && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    background: '#fa5d00',
                                    color: '#fff',
                                    padding: '1px 6px',
                                    borderRadius: '999px',
                                    flexShrink: 0,
                                  }}
                                >
                                  You
                                </span>
                              )}
                            </div>
                            {d.state && (
                              <div style={{ fontSize: '11px', color: '#a09d99' }}>{d.state}</div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                color: '#0f161e',
                              }}
                            >
                              {d.count}
                            </div>
                            <div style={{ fontSize: '11px', color: '#a09d99' }}>
                              {d.placed} placed
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DistrictIntelligencePage() {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div style={{ padding: '32px 40px', maxWidth: '1200px' }}>
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
        >
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f161e', margin: 0 }}>
              District Intelligence
            </h1>
            <p style={{ fontSize: '14px', color: '#615f5c', margin: '4px 0 0' }}>
              Skill development outcomes across your district
            </p>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#a09d99',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginTop: '6px',
            }}
          >
            DSSDO Console
          </span>
        </motion.div>

        {/* 1. Snapshot KPIs */}
        <SnapshotSection />

        {/* 2. AI Monthly Summary */}
        <MonthlySummary />

        {/* 3. Geo Distribution Map */}
        <GeoDistributionSection />

        {/* 4. Centre Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={{ marginBottom: '24px' }}
        >
          <CentreLeaderboard />
        </motion.div>

        {/* 4. Two-column row: Trade Performance + Labour Market Gap */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
          }}
        >
          <TradePerformance />
          <LabourMarketGap />
        </motion.div>
      </div>
    </>
  );
}
