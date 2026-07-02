'use client';

import React, { useState, useRef, useEffect } from 'react';
import { trpc } from '../../lib/trpc/client';

interface JobOption {
  id: string;
  title: string | null;
  company: string | null;
  district: string | null;
  trade: string | null;
}

interface JobSearchProps {
  value: string;
  onChange: (id: string, job: JobOption | null) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export default function JobSearch({ value, onChange, placeholder = 'Search job by title or company…', style }: JobSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = trpc.dashboard.jobs.search.useQuery(
    { q: query },
    { enabled: query.length >= 2, keepPreviousData: true } as any
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    ...style,
  };

  const handleSelect = (job: JobOption) => {
    const label = `${job.title ?? 'Untitled'} — ${job.company ?? 'Unknown Company'}`;
    setSelectedLabel(label);
    setQuery('');
    setOpen(false);
    onChange(job.id, job);
  };

  const handleClear = () => {
    setSelectedLabel('');
    setQuery('');
    onChange('', null);
  };

  const jobs = (data?.data ?? []) as JobOption[];

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {value && selectedLabel ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            flex: 1, padding: '10px 12px', borderRadius: '10px',
            border: '1.5px solid #004038', fontSize: '14px', color: '#0f161e',
            background: '#f0faf8', fontFamily: 'inherit', boxSizing: 'border-box',
          }}>
            {selectedLabel}
          </div>
          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e0e0dc',
              background: '#fff', color: '#615f5c', fontSize: '13px', cursor: 'pointer',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            style={inputStyle}
            placeholder={placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => { if (query.length >= 2) setOpen(true); }}
            autoComplete="off"
          />
          {open && query.length >= 2 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: '#fff', borderRadius: '12px',
              border: '1.5px solid #e0e0dc',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 100, overflow: 'hidden', maxHeight: '260px', overflowY: 'auto',
            }}>
              {isFetching && jobs.length === 0 ? (
                <div style={{ padding: '14px 16px', color: '#a09d99', fontSize: '13px' }}>Searching…</div>
              ) : jobs.length === 0 ? (
                <div style={{ padding: '14px 16px', color: '#a09d99', fontSize: '13px' }}>No jobs found</div>
              ) : jobs.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => handleSelect(j)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '12px 16px',
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    fontFamily: 'inherit', borderBottom: '1px solid rgba(0,0,0,0.05)',
                    display: 'block',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f7f7f5'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f161e' }}>
                    {j.title ?? 'Untitled Job'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#615f5c', marginTop: '2px' }}>
                    {j.company ?? 'Unknown Company'}{j.district ? ` · ${j.district}` : ''}{j.trade ? ` · ${j.trade}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
