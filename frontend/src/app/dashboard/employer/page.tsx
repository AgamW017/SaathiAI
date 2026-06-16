'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Users, UserCheck, ShieldCheck, ArrowRight, Clock, Info } from 'lucide-react';
import Link from 'next/link';
import { trpc } from '../../../lib/trpc/client';

function KPICard({ title, value, sub, icon: Icon, color }: any) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          <Icon size={20} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#615f5c' }}>{title}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'DM Serif Display', serif", color: '#0f161e', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, color: '#8a8886' }}>{sub}</div>
    </div>
  );
}

export default function EmployerOverviewPage() {
  const { data: analytics, isLoading } = trpc.employer.analytics.overview.useQuery();

  if (isLoading) {
    return <div style={{ padding: 40, color: '#615f5c' }}>Loading dashboard...</div>;
  }

  const kpis = [
    { title: 'Active Vacancies', value: analytics?.vacancies.active ?? 0, sub: `${analytics?.vacancies.draft ?? 0} in draft`, icon: Briefcase, color: '#2563eb' },
    { title: 'Total Candidates', value: analytics?.total_matches ?? 0, sub: 'In pipeline', icon: Users, color: '#fa5d00' },
    { title: 'Hired This Month', value: analytics?.hired ?? 0, sub: 'Total successful hires', icon: UserCheck, color: '#16a34a' },
    { title: 'NAPS Eligible', value: analytics?.vacancies.active ? 'Yes' : 'Pending', sub: 'Reimbursement active', icon: ShieldCheck, color: '#6b21a8' },
  ];

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: '#0f161e', margin: '0 0 8px' }}>Dashboard</h1>
      <p style={{ color: '#615f5c', margin: '0 0 32px' }}>Welcome to the Employer Portal. Here is what is happening today.</p>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 40 }}>
        {kpis.map(k => <KPICard key={k.title} {...k} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Priority Inbox */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Priority Actions</h3>
              <Link href="/dashboard/employer/pipeline" style={{ fontSize: 13, color: '#fa5d00', fontWeight: 600, textDecoration: 'none' }}>View all Pipeline</Link>
            </div>
            {analytics?.in_pipeline === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#8a8886', fontSize: 14 }}>
                No pending actions. You are all caught up!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {analytics?.stage_funnel.filter((f: any) => f.stage === 'interest_expressed' && f.count > 0).map((f: any) => (
                  <div key={f.stage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: '#fff8f1', borderRadius: 12, border: '1px solid rgba(250,93,0,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fa5d00' }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f161e' }}>{f.count} candidates expressed interest</div>
                        <div style={{ fontSize: 12, color: '#615f5c' }}>Review their skill cards and schedule interviews.</div>
                      </div>
                    </div>
                    <Link href="/dashboard/employer/pipeline" style={{ padding: '8px 16px', background: '#fa5d00', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Local Market Snapshot */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Info size={16} color="#615f5c" />
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#615f5c' }}>Labour Market Snapshot</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#8a8886', marginBottom: 4 }}>Top Trade Demand (Your District)</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f161e' }}>Electrician, Welder</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#8a8886', marginBottom: 4 }}>Average Salary Range</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f161e' }}>₹12,000 - ₹15,000 / month</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
