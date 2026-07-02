'use client';

import { use } from 'react';
import { motion } from 'framer-motion';
import { trpc } from '../../../lib/trpc/client';
import { ShieldCheck, ShieldOff, MapPin, X, RefreshCw, FileText, User, Briefcase, Calendar } from 'lucide-react';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PublicSkillCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isValidUuid = UUID_REGEX.test(id);

  if (!isValidUuid) {
    return <NotFoundView />;
  }

  return <SkillCardLoader id={id} />;
}

function SkillCardLoader({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = trpc.skillCard.getByUuid.useQuery(
    { id },
    {
      retry: false,
      refetchOnWindowFocus: false,
      trpc: { abortOnUnmount: true },
    }
  );

  if (isLoading) return <LoadingView />;

  if (isError) {
    const isNotFound =
      error?.data?.code === 'NOT_FOUND' || error?.message?.includes('not found');
    if (isNotFound) return <NotFoundView />;
    return <NetworkErrorView onRetry={() => refetch()} />;
  }

  if (!data) return <NotFoundView />;

  const { learner, skillCard } = data;
  const isKycVerified = learner.kyc_status === 'verified';
  const hasCertificate = skillCard.certificate_type &&
    skillCard.certificate_type !== 'N/A' &&
    skillCard.certificate_type !== 'None' &&
    skillCard.certificate_type !== 'Unknown';

  return (
    <main style={{ minHeight: '100vh', background: '#fff8f1', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 400, margin: '0 auto', background: '#fff', minHeight: '100vh', boxShadow: '0 0 40px rgba(0,0,0,0.03)', position: 'relative' }}>

        {/* Teal Header Band */}
        <div style={{ background: '#004038', padding: '32px 24px 24px', color: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontFamily: "'DM Serif Display', serif", lineHeight: 1.2 }}>
            {learner.full_name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'rgba(255,255,255,0.9)', fontSize: '15px', flexWrap: 'wrap' }}>
            <span>{learner.trade}</span>
            {learner.district && (
              <>
                <span style={{ width: 4, height: 4, background: 'currentColor', borderRadius: '50%' }} />
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={14} /> {learner.district}{learner.state ? `, ${learner.state}` : ''}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Verification + KYC Badge Strip */}
        <div style={{ display: 'flex', gap: 10, padding: '20px 24px 0', flexWrap: 'wrap' }}>
          {/* KYC badge */}
          <div style={{
            flex: 1, minWidth: 120,
            display: 'flex', alignItems: 'center', gap: 8,
            background: isKycVerified ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${isKycVerified ? '#bbf7d0' : '#fecaca'}`,
            padding: '10px 14px', borderRadius: 12
          }}>
            {isKycVerified
              ? <ShieldCheck size={20} color="#16a34a" />
              : <ShieldOff size={20} color="#dc2626" />}
            <div>
              <div style={{ fontSize: '11px', color: isKycVerified ? '#16a34a' : '#dc2626', fontWeight: 600, textTransform: 'uppercase' }}>
                {isKycVerified ? 'Aadhaar' : 'ID Check'}
              </div>
              <div style={{ fontSize: '13px', color: isKycVerified ? '#14532d' : '#991b1b', fontWeight: 700 }}>
                {isKycVerified ? 'KYC Verified' : 'Not Verified'}
              </div>
            </div>
          </div>

          {/* Skill card status badge */}
          <div style={{
            flex: 1, minWidth: 120,
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            padding: '10px 14px', borderRadius: 12
          }}>
            <ShieldCheck size={20} color="#16a34a" />
            <div>
              <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>Profile</div>
              <div style={{ fontSize: '13px', color: '#14532d', fontWeight: 700 }}>
                {formatVerificationStatus(skillCard.verification_status)}
              </div>
            </div>
          </div>
        </div>

        {/* Personal Details */}
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ background: '#f9fafb', border: '1px solid #f0f0f0', padding: 16, borderRadius: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#4a3f35', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Personal Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DetailRow icon={<User size={14} color="#004038" />} label="Full Name" value={learner.full_name} />
              {learner.dob && (
                <DetailRow icon={<Calendar size={14} color="#004038" />} label="Date of Birth" value={formatDob(learner.dob)} />
              )}
              {learner.gender && (
                <DetailRow icon={<User size={14} color="#004038" />} label="Gender" value={capitalize(learner.gender)} />
              )}
              <DetailRow icon={<MapPin size={14} color="#004038" />} label="Location"
                value={[learner.district, learner.state].filter(Boolean).join(', ') || '—'} />
            </div>
          </div>
        </div>

        {/* Skills Section */}
        <div style={{ padding: '20px 24px 0' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, color: '#0f161e' }}>Skills</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {skillCard.skills && skillCard.skills.length > 0 ? (
              (skillCard.skills as string[]).map((skill: string, index: number) => (
                <div
                  key={index}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#f9fafb', padding: '10px 14px',
                    borderRadius: 10, border: '1px solid #f0f0f0',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#004038', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#333942' }}>{skill}</span>
                </div>
              ))
            ) : (
              <p style={{ fontSize: '14px', color: '#615f5c' }}>No skills listed yet.</p>
            )}
          </div>
        </div>

        {/* Trade & Certificate Info */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ background: '#fff8f1', border: '1px solid rgba(250,93,0,0.2)', padding: 16, borderRadius: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <DetailRow icon={<Briefcase size={14} color="#fa5d00" />} label="Trade" value={skillCard.trade || learner.trade} />
              {hasCertificate ? (
                <DetailRow icon={<FileText size={14} color="#fa5d00" />} label="Certificate" value={skillCard.certificate_type!} />
              ) : (
                <DetailRow icon={<FileText size={14} color="#9ca3af" />} label="Certificate" value="Not Available" />
              )}
            </div>
          </div>
        </div>

        {/* Certificate Document (if uploaded) */}
        {skillCard.certificate_url && hasCertificate && (
          <div style={{ padding: '0 24px 24px' }}>
            <a
              href={skillCard.certificate_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '14px 20px', background: '#004038', color: '#fff',
                borderRadius: 14, textDecoration: 'none',
                fontWeight: 700, fontSize: '15px',
              }}
            >
              <FileText size={18} />
              View Certificate Document
            </a>
          </div>
        )}

        {/* Aadhaar Photo (if available + verified) */}
        {isKycVerified && learner.aadhaar_photo_url && (
          <div style={{ padding: '0 24px 24px' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#14532d', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color="#16a34a" /> Aadhaar Photo (KYC Verified)
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={learner.aadhaar_photo_url}
                alt="Aadhaar Photo"
                style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', border: '2px solid #bbf7d0' }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '0 24px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
            Powered by SaathiAI · India Digital Public Infrastructure
          </p>
        </div>

      </div>
    </main>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: '14px', color: '#0f161e', fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}

function LoadingView() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff8f1' }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        style={{ width: 40, height: 40, border: '3px solid rgba(0,64,56,0.2)', borderTopColor: '#004038', borderRadius: '50%' }}
      />
    </div>
  );
}

function NotFoundView() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff8f1', padding: '20px' }}>
      <X size={48} color="#dc2626" style={{ marginBottom: 16 }} />
      <h1 style={{ fontSize: '24px', fontFamily: "'DM Serif Display', serif", color: '#0f161e', marginBottom: 8 }}>
        Skill Card not found
      </h1>
      <p style={{ color: '#615f5c', textAlign: 'center', fontSize: '15px' }}>
        This skill card does not exist or the link may be incorrect.
      </p>
    </div>
  );
}

function NetworkErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff8f1', padding: '20px' }}>
      <X size={48} color="#dc2626" style={{ marginBottom: 16 }} />
      <h1 style={{ fontSize: '24px', fontFamily: "'DM Serif Display', serif", color: '#0f161e', marginBottom: 8 }}>
        Could not load skill card
      </h1>
      <p style={{ color: '#615f5c', textAlign: 'center', fontSize: '15px', marginBottom: 24 }}>
        Please check your connection and try again.
      </p>
      <button
        onClick={onRetry}
        style={{
          padding: '12px 24px', background: '#004038', color: '#fff',
          border: 'none', borderRadius: '12px', fontWeight: 600, fontSize: '15px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <RefreshCw size={16} /> Retry
      </button>
    </div>
  );
}

function formatVerificationStatus(status: string): string {
  switch (status) {
    case 'iti_verified': return 'ITI Verified';
    case 'employer_confirmed': return 'Employer Confirmed';
    case 'self_reported': return 'Self Reported';
    case 'pending': return 'Pending Verification';
    default: return status ?? 'Unknown';
  }
}

function formatDob(dob: string): string {
  try {
    // Handle formats: DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY
    const cleaned = dob.replace(/\//g, '-');
    const parts = cleaned.split('-');
    if (parts.length !== 3) return dob;

    let day: string, month: string, year: string;
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      [year, month, day] = parts;
    } else {
      // DD-MM-YYYY
      [day, month, year] = parts;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(month, 10) - 1;
    return `${parseInt(day, 10)} ${months[mIdx] ?? month} ${year}`;
  } catch {
    return dob;
  }
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
