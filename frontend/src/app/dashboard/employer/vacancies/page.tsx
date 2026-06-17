'use client';

import React from 'react';
import { trpc } from '../../../../lib/trpc/client';
import { Plus, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import VacancyActionsMenu from '../../../../components/employer/VacancyActionsMenu';

export default function VacanciesPage() {
  const { data, isLoading } = trpc.employer.vacancies.list.useQuery({});

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string, color: string, label: string }> = {
      active: { bg: '#dcfce7', color: '#16a34a', label: 'Active' },
      draft: { bg: '#f3f4f6', color: '#4b5563', label: 'Draft' },
      paused: { bg: '#fef9c3', color: '#ca8a04', label: 'Paused' },
      closed: { bg: '#fee2e2', color: '#dc2626', label: 'Closed' },
      flagged: { bg: '#ffedd5', color: '#c2410c', label: 'Flagged (Compliance)' },
    };
    const s = map[status] || map.draft;
    return (
      <span style={{ background: s.bg, color: s.color, padding: '4px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
        {s.label}
      </span>
    );
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: '#0f161e', margin: '0 0 8px' }}>Vacancies</h1>
          <p style={{ color: '#615f5c', margin: 0 }}>Manage your job postings and requirements.</p>
        </div>
        <Link href="/dashboard/employer/vacancies/new" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fa5d00', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none', transition: 'background 0.2s' }}>
          <Plus size={18} /> Post New Vacancy
        </Link>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <div style={{ padding: 20, borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f4f2', padding: '8px 12px', borderRadius: 8, flex: 1 }}>
            <Search size={16} color="#8a8886" />
            <input type="text" placeholder="Search vacancies..." style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14, width: '100%' }} />
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#fff', border: '1px solid #d1d0cd', borderRadius: 8, fontSize: 14, fontWeight: 500, color: '#333942', cursor: 'pointer' }}>
            <Filter size={16} /> Filter
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8a8886' }}>Loading vacancies...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9f9f8', borderBottom: '1px solid rgba(0,0,0,0.07)', textAlign: 'left' }}>
                <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600, color: '#615f5c' }}>Role</th>
                <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600, color: '#615f5c' }}>Salary Range</th>
                <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600, color: '#615f5c' }}>NAPS</th>
                <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600, color: '#615f5c' }}>Openings</th>
                <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600, color: '#615f5c' }}>Status</th>
                <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600, color: '#615f5c', width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {data?.vacancies.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#8a8886' }}>No vacancies found. Create one to get started.</td></tr>
              ) : (
                data?.vacancies.map((v: any) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f161e', marginBottom: 2 }}>{v.title}</div>
                      <div style={{ fontSize: 12, color: '#615f5c' }}>{v.trade_required} • {v.district}</div>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: 14, color: '#333942' }}>
                      ₹{v.salary_min.toLocaleString()} - ₹{v.salary_max.toLocaleString()}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: 14 }}>
                      {v.naps_eligible ? <span style={{ color: '#16a34a', fontWeight: 500 }}>Eligible</span> : <span style={{ color: '#8a8886' }}>No</span>}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: 14, color: '#333942' }}>{v.openings}</td>
                    <td style={{ padding: '16px 20px' }}>{getStatusBadge(v.status)}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <VacancyActionsMenu vacancy={{ id: v.id, title: v.title, trade_required: v.trade_required, status: v.status }} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
