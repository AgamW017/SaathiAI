'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { trpc } from '../../../../lib/trpc/client';
import Papa from 'papaparse';

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

// ─── Modal ────────────────────────────────────────────────────────────────────

function UploadCsvModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [cohortName, setCohortName] = useState('');
  const [trade, setTrade] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.cohorts.uploadCsv.useMutation();

  if (!isOpen) return null;

  const handleUpload = () => {
    if (!cohortName) {
      setError('Cohort name is required.');
      return;
    }
    if (!file) {
      setError('Please select a CSV file.');
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const learners = results.data.map((row: any) => {
          const normalizedRow: Record<string, string> = {};
          for (const key in row) {
            const normKey = key.toLowerCase().replace(/[\s_]/g, '');
            normalizedRow[normKey] = row[key];
          }
          
          return {
            phone: normalizedRow.phone || normalizedRow.phonenumber || normalizedRow.number || '',
            full_name: normalizedRow.name || normalizedRow.fullname || '',
          };
        }).filter(l => l.phone);

        if (learners.length === 0) {
          setError('No valid learners found. Ensure the CSV has a "phone" or "number" column.');
          return;
        }

        uploadMutation.mutate({ cohort_name: cohortName, trade: trade || undefined, learners }, {
          onSuccess: () => {
            setCohortName('');
            setTrade('');
            setFile(null);
            setError(null);
            onSuccess();
          },
          onError: (err) => setError(err.message),
        });
      },
      error: (err) => setError(`CSV Parse error: ${err.message}`),
    });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          background: '#fff', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '400px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: '20px', color: '#0f161e' }}>Upload Cohort CSV</h2>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333942', marginBottom: '8px' }}>Cohort Name</label>
          <input
            value={cohortName}
            onChange={e => setCohortName(e.target.value)}
            placeholder="e.g. Batch 2024 - Ranchi"
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e0e0dc', fontSize: '14px', outline: 'none' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333942', marginBottom: '8px' }}>Trade (Optional)</label>
          <input
            value={trade}
            onChange={e => setTrade(e.target.value)}
            placeholder="e.g. Fitter"
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e0e0dc', fontSize: '14px', outline: 'none' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333942', marginBottom: '8px' }}>CSV File</label>
          <div 
            onClick={() => fileInputRef.current?.click()}
            style={{ 
              border: '2px dashed #e0e0dc', borderRadius: '8px', padding: '24px', textAlign: 'center', 
              cursor: 'pointer', background: '#fafafa', color: '#615f5c', fontSize: '14px'
            }}
          >
            {file ? file.name : 'Click to select CSV file'}
          </div>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
              }
            }}
          />
          <p style={{ fontSize: '12px', color: '#a09d99', marginTop: '8px' }}>Expected columns: name, phone</p>
        </div>

        {error && <div style={{ padding: '10px', background: '#fee2e2', color: '#dc2626', fontSize: '13px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose}
            style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#f3f4f6', color: '#374151', fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button 
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
            style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#004038', color: '#fff', fontWeight: 600, cursor: uploadMutation.isPending ? 'not-allowed' : 'pointer' }}
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

function CohortsTable() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = trpc.cohorts.list.useQuery();
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

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f7f7f5' }}>
            <th style={thStyle}>Cohort Name</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Learners</th>
            <th style={thStyle}>Created On</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {[180, 80, 60, 100, 80].map((w, j) => (
                    <td key={j} style={tdStyle}><Skeleton width={`${w}px`} /></td>
                  ))}
                </tr>
              ))
            : data?.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#a09d99', fontSize: '14px' }}>
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const utils = trpc.useUtils();

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
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{
              background: '#004038', color: '#fff', border: 'none', padding: '10px 20px',
              borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,64,56,0.2)'
            }}
          >
            + Upload CSV
          </button>
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
          <CohortsTable />
        </motion.div>
      </div>

      <UploadCsvModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
          setIsModalOpen(false);
          utils.cohorts.list.invalidate();
          utils.dashboard.cohortStats.invalidate();
          utils.dashboard.priorityInbox.invalidate();
        }}
      />
    </>
  );
}
