'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '../../../../lib/trpc/client';
import VerificationBadge from '../../../../components/ui/VerificationBadge';

// Global officer search across learners + employers (Req3).
export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data, isLoading } = trpc.dashboard.search.useQuery(
    { q: submitted },
    { enabled: submitted.length > 0 }
  );

  const card: React.CSSProperties = {
    background: '#fff', borderRadius: '12px', padding: '14px 16px',
    border: '1px solid rgba(0,0,0,0.07)', cursor: 'pointer', marginBottom: '10px',
  };

  return (
    <div style={{ padding: '32px', maxWidth: '900px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f161e', margin: '0 0 4px' }}>Search</h1>
      <p style={{ fontSize: '14px', color: '#615f5c', margin: '0 0 20px' }}>Find any learner or employer by name, phone, trade, or company.</p>

      <form onSubmit={(e) => { e.preventDefault(); setSubmitted(q.trim()); }} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search learners and employers…"
          style={{ flex: 1, padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #e0e0dc', fontSize: '14px', color: '#0f161e', background: '#fff', outline: 'none', fontFamily: 'inherit' }}
        />
        <button type="submit" style={{ padding: '11px 22px', borderRadius: '12px', border: 'none', background: '#004038', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Search</button>
      </form>

      {submitted && isLoading && <div style={{ color: '#615f5c', fontSize: '14px' }}>Searching…</div>}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>Learners ({data.learners.length})</h2>
            {data.learners.length === 0 && <div style={{ color: '#a09d99', fontSize: '13px' }}>No learners.</div>}
            {data.learners.map((l: any) => (
              <div key={l.id} style={card} onClick={() => router.push(`/dashboard/officer/learners/${l.id}`)}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f161e' }}>{l.full_name ?? l.phone}</div>
                <div style={{ fontSize: '12px', color: '#615f5c' }}>{l.trade ?? '—'} • {l.district ?? '—'} • {l.phone}</div>
                <div style={{ fontSize: '11px', color: l.risk_score > 70 ? '#dc2626' : '#615f5c', marginTop: '4px' }}>Risk {l.risk_score} • {l.status}</div>
              </div>
            ))}
          </div>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>Employers ({data.employers.length})</h2>
            {data.employers.length === 0 && <div style={{ color: '#a09d99', fontSize: '13px' }}>No employers.</div>}
            {data.employers.map((e: any) => (
              <div key={e.id} style={{ ...card, cursor: 'default' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f161e' }}>{e.company_name ?? e.full_name ?? e.email}</div>
                <div style={{ fontSize: '12px', color: '#615f5c', marginBottom: '6px' }}>{e.district ?? '—'} • {e.phone ?? e.email}</div>
                <VerificationBadge status={e.verification_status} compact />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
