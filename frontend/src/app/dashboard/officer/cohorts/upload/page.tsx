'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { authStore } from '../../../../../lib/auth/authStore';

// --- Types ---

interface LearnerRow {
  id: string;
  name: string;
  phone: string;
  trade: string;
  confidence: number;
  valid: boolean;
  lowConfidence: boolean;
  invalidReason?: string;
}

type LoadingStage = 'idle' | 'reading' | 'extracting' | 'done' | 'error';
type FilterMode = 'all' | 'issues';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

// --- Helpers ---

function genId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

function rowStatus(row: LearnerRow): 'valid' | 'invalid-phone' | 'low-confidence' {
  if (!isValidPhone(row.phone)) return 'invalid-phone';
  if (row.lowConfidence) return 'low-confidence';
  return 'valid';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Confidence Badge ---

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const [bg, color] =
    confidence >= 0.9
      ? ['#dcfce7', '#16a34a']
      : confidence >= 0.7
        ? ['#fef9c3', '#ca8a04']
        : ['#fee2e2', '#dc2626'];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        background: bg,
        color,
      }}
    >
      {pct}%
    </span>
  );
}

// --- Status Cell ---

function StatusCell({ row }: { row: LearnerRow }) {
  const status = rowStatus(row);
  const [label, bg, color] =
    status === 'valid'
      ? ['Valid', '#dcfce7', '#16a34a']
      : status === 'low-confidence'
        ? ['Low confidence', '#fef9c3', '#ca8a04']
        : ['Invalid phone', '#fee2e2', '#dc2626'];

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// --- Upload Zone ---

function UploadZone({
  files,
  onFiles,
  disabled,
}: {
  files: File[];
  onFiles: (files: File[]) => void;
  disabled: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED = '.csv,.pdf,.jpg,.jpeg,.png';

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const dropped = Array.from(e.dataTransfer.files).filter((f) =>
        /\.(csv|pdf|jpe?g|png)$/i.test(f.name)
      );
      if (dropped.length) onFiles(dropped);
    },
    [disabled, onFiles]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length) onFiles(selected);
    e.target.value = '';
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragOver ? '#004038' : '#d1d5db'}`,
        borderRadius: '12px',
        padding: '32px 20px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: dragOver ? '#f0fdf4' : '#fafafa',
        transition: 'border-color 0.15s, background 0.15s',
        userSelect: 'none',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📎</div>
      {files.length === 0 ? (
        <>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#374151' }}>
            Drag & drop files here, or click to browse
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>
            CSV · PDF · JPG · PNG — max 10 MB each
          </p>
        </>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {files.map((f) => (
            <li
              key={f.name}
              style={{ fontSize: '13px', color: '#374151', marginTop: '4px' }}
            >
              {f.name}{' '}
              <span style={{ color: '#9ca3af' }}>({formatBytes(f.size)})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Loading Bar ---

function LoadingBar({ stage }: { stage: LoadingStage }) {
  const labels: Record<LoadingStage, string> = {
    idle: '',
    reading: 'Reading document...',
    extracting: 'Extracting records...',
    done: 'Done',
    error: '',
  };

  if (stage === 'idle' || stage === 'error') return null;

  return (
    <div style={{ marginTop: '16px' }}>
      <p style={{ fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
        {labels[stage]}
      </p>
      <div
        style={{
          height: '4px',
          background: '#e5e7eb',
          borderRadius: '999px',
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{ height: '100%', background: '#004038', borderRadius: '999px' }}
          animate={{ width: stage === 'reading' ? '40%' : stage === 'extracting' ? '80%' : '100%' }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}

// --- Main Page ---

export default function CohortUploadPage() {
  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [stage, setStage] = useState<LoadingStage>('idle');
  const [stageError, setStageError] = useState<string | null>(null);

  const [rows, setRows] = useState<LearnerRow[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [cohortName, setCohortName] = useState('');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // --- Process Document ---

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStage('reading');
    setStageError(null);
    setRows([]);

    try {
      const token = authStore.getAccessToken();

      const formData = new FormData();
      for (const f of files) {
        formData.append('file', f, f.name);
      }

      const res = await fetch(`${BACKEND_URL}/api/documents/parse-cohort`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      setStage('extracting');

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body?.error ?? `Server error ${res.status}`);
      }

      const data = await res.json() as {
        validEntries: Array<{ name: string; phone: string; trade: string; confidence: number; valid: boolean; lowConfidence: boolean; invalidReason?: string }>;
        invalidEntries: Array<{ name: string; phone: string; trade: string; confidence: number; valid: boolean; lowConfidence: boolean; invalidReason?: string }>;
        totalExtracted: number;
      };

      const allRows: LearnerRow[] = [
        ...data.validEntries,
        ...data.invalidEntries,
      ].map((e) => ({ ...e, id: genId() }));

      setRows(allRows);
      setStage('done');
    } catch (err: unknown) {
      setStageError(err instanceof Error ? err.message : 'Unknown error');
      setStage('error');
    }
  };

  // --- Inline edit ---

  const updateRow = (id: string, field: keyof LearnerRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        const phoneOk = isValidPhone(updated.phone);
        return { ...updated, valid: phoneOk, invalidReason: phoneOk ? undefined : r.invalidReason };
      })
    );
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // --- Derived stats ---

  const validRows = rows.filter((r) => isValidPhone(r.phone));
  const issueRows = rows.filter((r) => !isValidPhone(r.phone) || r.lowConfidence);
  const displayRows = filter === 'issues' ? issueRows : rows;

  // --- Create cohort ---

  const handleCreate = async () => {
    if (!cohortName.trim() || validRows.length === 0) return;

    setCreating(true);
    try {
      const token = authStore.getAccessToken();
      const res = await fetch(`${BACKEND_URL}/api/cohorts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: cohortName.trim(),
          learners: validRows.map((r) => ({
            name: r.name,
            phone: r.phone,
            trade: r.trade,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body?.error ?? `Server error ${res.status}`);
      }

      const result = await res.json() as { cohortId: string; inserted: number };
      setToast(`Cohort created. ${result.inserted} learners onboarded.`);
      setTimeout(() => {
        router.push(`/dashboard/officer/cohorts/${result.cohortId}`);
      }, 1800);
    } catch (err: unknown) {
      setStageError(err instanceof Error ? err.message : 'Failed to create cohort');
    } finally {
      setCreating(false);
    }
  };

  // --- Styles ---

  const thStyle: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
  };

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: '13px',
    color: '#374151',
    verticalAlign: 'middle',
    borderBottom: '1px solid #f3f4f6',
  };

  const inputCell: React.CSSProperties = {
    width: '100%',
    padding: '4px 6px',
    fontSize: '13px',
    border: '1px solid transparent',
    borderRadius: '6px',
    background: 'transparent',
    outline: 'none',
    fontFamily: 'inherit',
    color: '#0f161e',
  };

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .editable-cell:hover {
          border-color: #d1d5db !important;
          background: #f9fafb !important;
        }
        .editable-cell:focus {
          border-color: #004038 !important;
          background: #fff !important;
        }
        .row-invalid {
          border-left: 3px solid #ef4444;
        }
        .row-low {
          border-left: 3px solid #f59e0b;
        }
        .row-valid {
          border-left: 3px solid transparent;
        }
        .delete-btn:hover {
          background: #fecaca !important;
        }
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed',
              top: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#004038',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              zIndex: 9999,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ padding: '32px', maxWidth: '1100px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <button
            onClick={() => router.push('/dashboard/officer/cohorts')}
            style={{
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px',
              background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              color: '#004038', fontSize: '16px', fontWeight: 700,
            }}
            aria-label="Back to cohorts"
          >
            ←
          </button>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f161e', margin: 0 }}>
              Upload Cohort
            </h1>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0' }}>
              Upload a CSV, PDF, or image to extract and review learner records.
            </p>
          </div>
        </motion.div>

        {/* Upload card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <UploadZone
            files={files}
            onFiles={setFiles}
            disabled={stage === 'reading' || stage === 'extracting'}
          />

          <LoadingBar stage={stage} />

          {stageError && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: '#fee2e2',
                color: '#b91c1c',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            >
              {stageError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              onClick={handleProcess}
              disabled={
                files.length === 0 ||
                stage === 'reading' ||
                stage === 'extracting'
              }
              style={{
                padding: '10px 24px',
                background:
                  files.length === 0 ||
                  stage === 'reading' ||
                  stage === 'extracting'
                    ? '#9ca3af'
                    : '#004038',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor:
                  files.length === 0 ||
                  stage === 'reading' ||
                  stage === 'extracting'
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {stage === 'reading' || stage === 'extracting'
                ? 'Processing…'
                : 'Process Document'}
            </button>
          </div>
        </motion.div>

        {/* Verification table */}
        {rows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            style={{
              background: '#fff',
              borderRadius: '16px',
              border: '1px solid rgba(0,0,0,0.07)',
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
              overflow: 'hidden',
              marginBottom: '24px',
            }}
          >
            {/* Summary bar */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '13px', color: '#374151' }}>
                <strong>{rows.length}</strong> records found
                {' · '}
                <span style={{ color: '#16a34a', fontWeight: 600 }}>
                  {validRows.length} valid
                </span>
                {issueRows.length > 0 && (
                  <>
                    {' · '}
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                      {issueRows.length} need review
                    </span>
                  </>
                )}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['all', 'issues'] as FilterMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setFilter(m)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid',
                      borderColor: filter === m ? '#004038' : '#e5e7eb',
                      background: filter === m ? '#004038' : '#fff',
                      color: filter === m ? '#fff' : '#374151',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {m === 'all' ? 'Show all' : 'Show issues only'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '40px' }}>#</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Trade</th>
                    <th style={thStyle}>Confidence</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, idx) => {
                    const status = rowStatus(row);
                    const rowClass =
                      status === 'invalid-phone'
                        ? 'row-invalid'
                        : status === 'low-confidence'
                          ? 'row-low'
                          : 'row-valid';

                    return (
                      <tr key={row.id} className={rowClass}>
                        <td style={{ ...tdStyle, color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
                          {rows.indexOf(row) + 1}
                        </td>
                        <td style={tdStyle}>
                          <input
                            className="editable-cell"
                            style={inputCell}
                            value={row.name}
                            onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            className="editable-cell"
                            style={{
                              ...inputCell,
                              color: isValidPhone(row.phone) ? '#0f161e' : '#dc2626',
                            }}
                            value={row.phone}
                            onChange={(e) => updateRow(row.id, 'phone', e.target.value)}
                            maxLength={10}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            className="editable-cell"
                            style={inputCell}
                            value={row.trade}
                            onChange={(e) => updateRow(row.id, 'trade', e.target.value)}
                            placeholder="—"
                          />
                        </td>
                        <td style={tdStyle}>
                          <ConfidenceBadge confidence={row.confidence} />
                        </td>
                        <td style={tdStyle}>
                          <StatusCell row={row} />
                        </td>
                        <td style={tdStyle}>
                          <button
                            className="delete-btn"
                            onClick={() => deleteRow(row.id)}
                            title="Remove row"
                            style={{
                              width: '24px',
                              height: '24px',
                              border: 'none',
                              borderRadius: '6px',
                              background: '#fee2e2',
                              color: '#dc2626',
                              cursor: 'pointer',
                              fontSize: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                            }}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Cohort creation */}
        {rows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              background: '#fff',
              borderRadius: '16px',
              border: '1px solid rgba(0,0,0,0.07)',
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
              padding: '24px',
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f161e', margin: '0 0 16px' }}>
              Create Cohort
            </h2>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Cohort Name
            </label>
            <input
              value={cohortName}
              onChange={(e) => setCohortName(e.target.value)}
              placeholder="e.g. Batch 2024 – Ranchi"
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '10px 12px',
                border: '1.5px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
                color: '#0f161e',
                boxSizing: 'border-box',
              }}
            />

            {stageError && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  background: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '8px',
                  fontSize: '13px',
                  maxWidth: '400px',
                }}
              >
                {stageError}
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={handleCreate}
                disabled={!cohortName.trim() || validRows.length === 0 || creating}
                style={{
                  padding: '11px 24px',
                  background:
                    !cohortName.trim() || validRows.length === 0 || creating
                      ? '#9ca3af'
                      : '#004038',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor:
                    !cohortName.trim() || validRows.length === 0 || creating
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {creating ? 'Creating…' : 'Create Cohort & Onboard Learners'}
              </button>
              {validRows.length > 0 && (
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  {validRows.length} valid learner{validRows.length !== 1 ? 's' : ''} will be onboarded
                </span>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
}
