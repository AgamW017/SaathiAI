'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '../../../../../lib/trpc/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = '16px', radius = '6px' }: { width?: string; height?: string; radius?: string }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg,#f0f0ee 25%,#e8e8e5 50%,#f0f0ee 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  );
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  active:   { label: 'Active',    bg: '#dbeafe', color: '#2563eb' },
  placed:   { label: 'Placed',    bg: '#dcfce7', color: '#16a34a' },
  at_risk:  { label: 'At Risk',   bg: '#fee2e2', color: '#dc2626' },
  dropped:  { label: 'Dropped',   bg: '#f3f4f6', color: '#6b7280' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#f0f0ee', color: '#615f5c' };
  return (
    <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function RiskMeter({ score }: { score: number }) {
  const color = score > 70 ? '#dc2626' : score > 40 ? '#d97706' : '#16a34a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ flex: 1, height: '8px', background: '#f0f0ee', borderRadius: '999px', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          style={{ height: '100%', background: color, borderRadius: '999px' }}
        />
      </div>
      <span style={{ fontSize: '14px', fontWeight: 700, color, width: '30px' }}>{score}</span>
    </div>
  );
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#a09d99', width: '110px', flexShrink: 0, paddingTop: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
      <span style={{ fontSize: '14px', color: '#0f161e', flex: 1 }}>{value ?? '—'}</span>
    </div>
  );
}

// ─── Application Status Badge ─────────────────────────────────────────────────

const APP_STATUS: Record<string, { label: string; color: string }> = {
  applied:     { label: 'Applied',     color: '#2563eb' },
  shortlisted: { label: 'Shortlisted', color: '#d97706' },
  interviewed: { label: 'Interviewed', color: '#7c3aed' },
  hired:       { label: 'Hired',       color: '#16a34a' },
  rejected:    { label: 'Rejected',    color: '#dc2626' },
};

// ─── Update Status Form ───────────────────────────────────────────────────────

type StatusMutation = 'active' | 'placed' | 'dropped' | 'at_risk';

function UpdateStatusPanel({ learnerId, currentStatus, onSuccess }: { learnerId: string; currentStatus: string; onSuccess: () => void }) {
  const [newStatus, setNewStatus] = useState<StatusMutation>(currentStatus as StatusMutation);
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);

  const updateMutation = trpc.dashboard.learner.updateStatus.useMutation({
    onSuccess: () => { setSuccess(true); onSuccess(); setTimeout(() => setSuccess(false), 3000); },
  });

  const noteMutation = trpc.dashboard.learner.addNote.useMutation({
    onSuccess: () => { setNote(''); },
  });

  const handleUpdate = () => {
    updateMutation.mutate({ id: learnerId, status: newStatus });
    if (note.trim()) {
      noteMutation.mutate({ id: learnerId, note: note.trim() });
    }
  };

  const STATUS_OPTIONS: { value: StatusMutation; label: string }[] = [
    { value: 'active',  label: 'Active'   },
    { value: 'placed',  label: 'Placed'   },
    { value: 'at_risk', label: 'At Risk'  },
    { value: 'dropped', label: 'Dropped'  },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#615f5c', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Update Status</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = newStatus === opt.value;
            const cfg = STATUS_CONFIG[opt.value];
            return (
              <button
                key={opt.value}
                onClick={() => setNewStatus(opt.value)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '999px',
                  border: `2px solid ${isSelected ? cfg.color : 'transparent'}`,
                  background: isSelected ? cfg.bg : '#f0f0ee',
                  color: isSelected ? cfg.color : '#615f5c',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#615f5c', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Officer Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note about this learner…"
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1.5px solid #e0e0dc',
            fontSize: '13px',
            color: '#0f161e',
            background: '#fff',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ padding: '10px 14px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a', fontSize: '13px', fontWeight: 600 }}
          >
            ✅ Status updated successfully
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={handleUpdate}
        disabled={updateMutation.isPending}
        style={{
          padding: '11px 20px',
          borderRadius: '12px',
          border: 'none',
          background: updateMutation.isPending ? 'rgba(0,64,56,0.5)' : '#004038',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 600,
          cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s ease',
          fontFamily: 'inherit',
          alignSelf: 'flex-start',
        }}
      >
        {updateMutation.isPending ? 'Saving…' : 'Save Update'}
      </button>
    </div>
  );
}

// ─── Ping Panel (Req3: nudge inactive/high-risk learner via bot) ───────────────

function PingPanel({ learnerId, suggestInactive }: { learnerId: string; suggestInactive: boolean }) {
  const [msg, setMsg] = useState(suggestInactive
    ? 'Namaste! We noticed you have been inactive. Are you still looking for work? Reply to continue.'
    : '');
  const [sent, setSent] = useState(false);
  const ping = trpc.messaging.sendPing.useMutation({
    onSuccess: () => { setSent(true); setMsg(''); setTimeout(() => setSent(false), 3000); },
  });
  return (
    <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#615f5c', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        Ping via Bot {suggestInactive && <span style={{ color: '#dc2626' }}>• inactive</span>}
      </label>
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="Message to send over WhatsApp…"
        style={{ width: '100%', minHeight: '60px', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e0e0dc', fontSize: '13px', color: '#0f161e', background: '#fff', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
      {ping.isError && <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626' }}>{ping.error.message}</div>}
      {sent && <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 600, color: '#16a34a' }}>✅ Ping sent</div>}
      <button
        onClick={() => msg.trim() && ping.mutate({ learnerId, message: msg.trim() })}
        disabled={ping.isPending || !msg.trim()}
        style={{ marginTop: '10px', padding: '9px 18px', borderRadius: '10px', border: 'none', background: (ping.isPending || !msg.trim()) ? 'rgba(250,93,0,0.5)' : '#fa5d00', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: (ping.isPending || !msg.trim()) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
      >
        {ping.isPending ? 'Sending…' : 'Send WhatsApp Ping'}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LearnerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data, isLoading, error, refetch } = trpc.dashboard.learner.byId.useQuery(
    { id },
    { enabled: !!id }
  );

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#dc2626', fontSize: '16px', fontWeight: 600 }}>Learner not found</div>
        <button
          onClick={() => router.back()}
          style={{ marginTop: '16px', padding: '8px 20px', borderRadius: '8px', border: '1.5px solid #004038', background: 'transparent', color: '#004038', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}
        >
          ← Back
        </button>
      </div>
    );
  }

  const learner = data?.learner;
  const applications = data?.applications ?? [];

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div style={{ padding: '32px', maxWidth: '1000px' }}>
        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'transparent', border: 'none', color: '#615f5c',
            fontSize: '13px', fontWeight: 500, cursor: 'pointer', marginBottom: '20px',
            padding: 0, fontFamily: 'inherit',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to Learners
        </button>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <Skeleton width="64px" height="64px" radius="50%" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton height="22px" width="200px" />
                <Skeleton height="14px" width="140px" />
              </div>
            </div>
            <Skeleton height="200px" radius="16px" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Profile header */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'linear-gradient(135deg, #004038 0%, #006b5a 100%)',
                borderRadius: '16px',
                padding: '24px 28px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '24px', fontWeight: 700, color: '#fff', flexShrink: 0,
                overflow: 'hidden',
              }}>
                {data?.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.photo_url} alt={learner?.full_name ?? 'photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (learner?.full_name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>{learner?.full_name ?? 'Unknown'}</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                  {learner?.trade ?? 'No trade'} • {learner?.district ?? 'No district'} • {learner?.cohort ?? 'No cohort'}
                </div>
                <div style={{ marginTop: '12px' }}>
                  <StatusBadge status={learner?.status ?? 'active'} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Risk Score</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: learner?.risk_score ?? 0 > 70 ? '#fca5a5' : '#fff' }}>
                  {learner?.risk_score ?? 0}
                </div>
              </div>
            </motion.div>

            {/* AI Summary + Suggested Action */}
            {(data?.aiSummary || data?.suggestedAction) && (
              <div style={{ display: 'grid', gridTemplateColumns: data?.suggestedAction ? '1fr 280px' : '1fr', gap: '16px' }}>
                {data?.aiSummary && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    style={{
                      background: '#f0fdf4',
                      borderRadius: '14px',
                      padding: '18px 20px',
                      border: '1px solid #bbf7d0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
                      </svg>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Summary</span>
                    </div>
                    <p style={{ fontSize: '14px', color: '#166534', lineHeight: 1.6, margin: 0 }}>{data.aiSummary}</p>
                  </motion.div>
                )}
                {data?.suggestedAction && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    style={{
                      background: '#fffbeb',
                      borderRadius: '14px',
                      padding: '18px 20px',
                      border: '1px solid #fde68a',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Suggested Action</span>
                    </div>
                    <p style={{ fontSize: '14px', color: '#92400e', lineHeight: 1.6, margin: 0 }}>{data.suggestedAction}</p>
                  </motion.div>
                )}
              </div>
            )}

            {/* Two-column: details + action panel */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>
              {/* Details card */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{ background: '#fff', borderRadius: '16px', padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
              >
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f161e', margin: '0 0 12px' }}>Learner Details</h3>
                <div>
                  <DetailRow label="Phone" value={learner?.phone} />
                  <DetailRow label="Trade" value={learner?.trade} />
                  <DetailRow label="District" value={learner?.district} />
                  <DetailRow label="Cohort" value={learner?.cohort} />
                  <DetailRow label="Status" value={<StatusBadge status={learner?.status ?? 'active'} />} />
                  <DetailRow label="Risk Score" value={<RiskMeter score={learner?.risk_score ?? 0} />} />
                  <DetailRow label="Enrolled" value={learner?.created_at ? new Date(learner.created_at).toLocaleDateString('en-IN') : '—'} />
                </div>
              </motion.div>

              {/* Officer action panel */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                style={{ background: '#fff', borderRadius: '16px', padding: '20px 24px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
              >
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f161e', margin: '0 0 16px' }}>Officer Actions</h3>
                <UpdateStatusPanel learnerId={id} currentStatus={learner?.status ?? 'active'} onSuccess={() => refetch()} />
                <PingPanel learnerId={id} suggestInactive={(learner?.risk_score ?? 0) > 70 || learner?.status === 'at_risk'} />
              </motion.div>
            </div>

            {/* Match history */}
            {applications.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{ background: '#fff', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', overflow: 'hidden' }}
              >
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f161e', margin: 0 }}>Match History ({applications.length})</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f7f7f5' }}>
                        {['Job', 'Applied', 'Status'].map((h) => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#a09d99', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app: any, i: number) => {
                        const appCfg = APP_STATUS[app.status] ?? { label: app.status, color: '#615f5c' };
                        return (
                          <tr key={app.id} style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: '#0f161e', fontWeight: 500 }}>
                              {(app.jobs as any)?.title ?? `Job ${app.job_id?.slice(0, 8) ?? '—'}`}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '12px', color: '#a09d99' }}>
                              {app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-IN') : '—'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: appCfg.color }}>{appCfg.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
