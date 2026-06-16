'use client';

import React from 'react';
import { trpc } from '../../../../lib/trpc/client';
import { BarChart3, Users, Briefcase, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AnalyticsPage() {
  const { data, isLoading } = trpc.employer.analytics.overview.useQuery();

  if (isLoading) return <div style={{ padding: 40, color: '#615f5c' }}>Loading analytics...</div>;

  const maxFunnelCount = Math.max(...(data?.stage_funnel.map(f => f.count) || [1]));

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: '#0f161e', margin: '0 0 8px' }}>Analytics & Reports</h1>
      <p style={{ color: '#615f5c', margin: '0 0 32px' }}>Track your hiring funnel and conversion rates.</p>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
        {[
          { title: 'Total Sourced', val: data?.total_matches, icon: Users, color: '#2563eb' },
          { title: 'Active Pipeline', val: data?.in_pipeline, icon: TrendingUp, color: '#fa5d00' },
          { title: 'Total Hired', val: data?.hired, icon: Briefcase, color: '#16a34a' },
          { title: 'Rejected / Dropped', val: data?.rejected, icon: BarChart3, color: '#dc2626' },
        ].map(s => (
          <div key={s.title} style={{ background: '#fff', padding: 20, borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, color: '#615f5c', fontSize: 13, fontWeight: 600 }}>
              <s.icon size={16} color={s.color} /> {s.title}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#0f161e', fontFamily: "'DM Serif Display', serif" }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        
        {/* Pipeline Funnel */}
        <div style={{ background: '#fff', padding: 32, borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 24px', color: '#0f161e' }}>Hiring Funnel</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data?.stage_funnel.map((stage, idx) => {
              const width = Math.max(5, (stage.count / (maxFunnelCount || 1)) * 100);
              return (
                <div key={stage.stage} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 140, fontSize: 13, fontWeight: 600, color: '#615f5c', textAlign: 'right', textTransform: 'capitalize' }}>
                    {stage.stage.replace(/_/g, ' ')}
                  </div>
                  <div style={{ flex: 1, height: 32, background: '#f5f4f2', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${width}%` }} transition={{ duration: 0.8, delay: idx * 0.1 }}
                      style={{ height: '100%', background: `hsl(${25 + idx * 15}, 80%, 50%)`, borderRadius: 8 }}
                    />
                  </div>
                  <div style={{ width: 40, fontSize: 14, fontWeight: 700, color: '#0f161e' }}>
                    {stage.count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Insights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ background: '#fff8f1', padding: 24, borderRadius: 16, border: '1px solid rgba(250,93,0,0.1)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: '#0f161e' }}>Conversion Rate</h3>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#fa5d00', fontFamily: "'DM Serif Display', serif", marginBottom: 8 }}>
              {data?.total_matches ? Math.round(((data.hired || 0) / data.total_matches) * 100) : 0}%
            </div>
            <p style={{ fontSize: 13, color: '#615f5c', margin: 0, lineHeight: 1.5 }}>
              Of the {data?.total_matches} candidates sourced, you have successfully hired {data?.hired}. 
              Industry average is 15%.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
