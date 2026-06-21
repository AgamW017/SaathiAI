'use client';

import { use } from 'react';
import { motion } from 'framer-motion';
import { trpc } from '../../../lib/trpc/client';
import { ShieldCheck, MapPin, X, RefreshCw } from 'lucide-react';

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
      // 10 second timeout via abort signal
      trpc: { abortOnUnmount: true },
    }
  );

  if (isLoading) {
    return <LoadingView />;
  }

  if (isError) {
    const isNotFound =
      error?.data?.code === 'NOT_FOUND' ||
      error?.message?.includes('not found');

    if (isNotFound) {
      return <NotFoundView />;
    }

    return <NetworkErrorView onRetry={() => refetch()} />;
  }

  if (!data) {
    return <NotFoundView />;
  }

  const { learner, skillCard } = data;

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
                  <MapPin size={14} /> {learner.district}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Verified Badge Strip */}
        <div style={{ display: 'flex', gap: 12, padding: '24px 24px 0' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 12 }}>
            <ShieldCheck size={20} color="#16a34a" />
            <div>
              <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>Verified</div>
              <div style={{ fontSize: '13px', color: '#14532d', fontWeight: 700 }}>
                {formatVerificationStatus(skillCard.verification_status)}
              </div>
            </div>
          </div>
        </div>

        {/* Skills Section */}
        <div style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#0f161e' }}>Skills</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {skillCard.skills.length > 0 ? (
              skillCard.skills.map((skill: string, index: number) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: '#f9fafb',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #f0f0f0',
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
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ background: '#fff8f1', border: '1px solid rgba(250,93,0,0.2)', padding: 16, borderRadius: 16 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#4a3f35', marginBottom: 4 }}>Trade</div>
            <div style={{ fontSize: '15px', color: '#0f161e', fontWeight: 700, marginBottom: 12 }}>{skillCard.trade}</div>
            {skillCard.certificate_type && (
              <>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#4a3f35', marginBottom: 4 }}>Certificate</div>
                <div style={{ fontSize: '15px', color: '#0f161e', fontWeight: 700 }}>{skillCard.certificate_type}</div>
              </>
            )}
          </div>
        </div>

      </div>
    </main>
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
          padding: '12px 24px',
          background: '#004038',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          fontWeight: 600,
          fontSize: '15px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <RefreshCw size={16} /> Retry
      </button>
    </div>
  );
}

function formatVerificationStatus(status: string): string {
  switch (status) {
    case 'iti_verified':
      return 'ITI Verified';
    case 'employer_confirmed':
      return 'Employer Confirmed';
    case 'self_reported':
      return 'Self Reported';
    case 'pending':
      return 'Pending Verification';
    default:
      return status;
  }
}
