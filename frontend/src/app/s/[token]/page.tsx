'use client';

import React, { useState, use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '../../../lib/trpc/client';
import { ShieldCheck, PlayCircle, Check, X, Building2, MapPin, MessageSquare, Calendar, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SkillCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  // Fetch skill card data
  const { data, isLoading, isError, error } = trpc.skillCard.get.useQuery(
    { token },
    { retry: false, refetchOnWindowFocus: false }
  );

  // Check if user is a logged-in employer
  const { data: employerProfile } = trpc.employer.profile.get.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const isEmployer = !!employerProfile;

  // Mutations
  const interestMutation = trpc.skillCard.expressInterest.useMutation();
  const passMutation = trpc.skillCard.pass.useMutation();

  const [hasActed, setHasActed] = useState(false);
  const [showSignupUpsell, setShowSignupUpsell] = useState(false);

  if (isLoading) {
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

  if (isError || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff8f1', padding: '20px' }}>
        <X size={48} color="#dc2626" style={{ marginBottom: 16 }} />
        <h1 style={{ fontSize: '24px', fontFamily: "'DM Serif Display', serif", color: '#0f161e', marginBottom: 8 }}>यह link expire हो गई है</h1>
        <p style={{ color: '#615f5c', textAlign: 'center', fontSize: '15px' }}>
          {error?.message || 'The skill card link is no longer valid.'}
        </p>
        <button
          onClick={() => window.open('https://wa.me/919876543210', '_blank')}
          style={{
            marginTop: 24,
            padding: '12px 24px',
            background: '#25D366',
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
          Contact Support on WhatsApp
        </button>
      </div>
    );
  }

  const { learner, vacancy } = data;
  const skills = learner.skill_card?.skills as Record<string, number> | undefined;

  const handleInterest = async () => {
    if (hasActed) return;
    try {
      await interestMutation.mutateAsync({ token });
      setHasActed(true);
      setShowSignupUpsell(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePass = async () => {
    if (hasActed) return;
    try {
      await passMutation.mutateAsync({ token });
      setHasActed(true);
    } catch (e) {
      console.error(e);
    }
  };

  if (showSignupUpsell) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff8f1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ width: '100%', maxWidth: 400, background: '#fff', padding: 32, borderRadius: 24, boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>
          <div style={{ width: 64, height: 64, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Check size={32} color="#16a34a" />
          </div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '24px', margin: '0 0 12px', color: '#0f161e' }}>आपकी interest हमें मिल गई!</h2>
          <p style={{ color: '#615f5c', fontSize: '15px', lineHeight: 1.5, margin: '0 0 24px' }}>
            हम जल्द ही आपसे connect करेंगे। SaathiAI Employer Portal पर register करके आप और भी candidates देख सकते हैं।
          </p>
          <button
            onClick={() => router.push('/signin')}
            style={{ width: '100%', padding: '14px', background: '#004038', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, fontSize: '16px', cursor: 'pointer' }}
          >
            Create Employer Account
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#fff8f1', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 400, margin: '0 auto', background: '#fff', minHeight: '100vh', boxShadow: '0 0 40px rgba(0,0,0,0.03)', position: 'relative', paddingBottom: 100 }}>
        
        {/* 1. Teal Header Band */}
        <div style={{ background: '#004038', padding: '32px 24px 24px', color: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
          {vacancy && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', padding: '6px 12px', borderRadius: 999, fontSize: '12px', fontWeight: 600, marginBottom: 20 }}>
              <Building2 size={14} />
              For: {vacancy.title} ({vacancy.district})
            </div>
          )}
          <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontFamily: "'DM Serif Display', serif", lineHeight: 1.2 }}>
            {learner.full_name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'rgba(255,255,255,0.9)', fontSize: '15px' }}>
            <span>{learner.trade}</span>
            <span style={{ width: 4, height: 4, background: 'currentColor', borderRadius: '50%' }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={14}/> {learner.district}</span>
          </div>
        </div>

        {/* 2. Verified Badge Strip */}
        <div style={{ display: 'flex', gap: 12, padding: '24px 24px 0' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 12 }}>
            <ShieldCheck size={20} color="#16a34a" />
            <div>
              <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>Verified by</div>
              <div style={{ fontSize: '13px', color: '#14532d', fontWeight: 700 }}>Government ITI</div>
            </div>
          </div>
        </div>

        {/* 3. Skill Score Bars */}
        <div style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#0f161e' }}>Skill Assessment</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { key: 'technique', label: 'Technique', score: skills?.technique || 85 },
              { key: 'safety', label: 'Safety compliance', score: skills?.safety || 90 },
              { key: 'explanation', label: 'Explanation', score: skills?.explanation || 75 },
              { key: 'completion', label: 'Completion quality', score: skills?.completion || 80 },
            ].map((s) => (
              <div key={s.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#333942', marginBottom: 6 }}>
                  <span>{s.label}</span>
                  <span>{s.score}%</span>
                </div>
                <div style={{ height: 6, background: '#f5f4f2', borderRadius: 999, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${s.score}%` }}
                    transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
                    style={{ height: '100%', background: s.score >= 85 ? '#16a34a' : s.score >= 70 ? '#fa5d00' : '#dc2626' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Video Thumbnail */}
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#111', borderRadius: 16, overflow: 'hidden', cursor: 'pointer' }}>
            {/* Fake video placeholder */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.6, background: 'url(https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=1000&auto=format&fit=crop) center/cover' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PlayCircle size={32} color="#fff" strokeWidth={1.5} />
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '11px', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>
              01:24 — Practical Demo
            </div>
          </div>
        </div>

        {/* 5. Trainer Endorsement */}
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ background: '#fff8f1', border: '1px solid #fa5d0030', padding: 16, borderRadius: 16 }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#4a3f35', fontStyle: 'italic', lineHeight: 1.5 }}>
              "{learner.full_name} is one of our top students. Shows excellent attention to detail and always follows safety protocols. Highly recommended for industrial roles."
            </p>
            <div style={{ marginTop: 12, fontSize: '12px', fontWeight: 600, color: '#fa5d00' }}>
              — Ramesh Kumar (Sr. Instructor, Govt ITI)
            </div>
          </div>
        </div>

        {/* Fixed Bottom Action Bar */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(0,0,0,0.05)', padding: '16px 24px',
          display: 'flex', flexDirection: 'column', gap: 12,
          maxWidth: 400, margin: '0 auto'
        }}>
          {isEmployer ? (
            <>
              {/* Employer viewing from pipeline — show pipeline actions */}
              <button
                onClick={() => {
                  // Find the match for this learner and navigate to their detail page
                  const matchParam = new URLSearchParams(window.location.search).get('match_id') || '';
                  if (matchParam) {
                    router.push(`/dashboard/employer/pipeline/${matchParam}`);
                  } else {
                    router.push('/dashboard/employer/pipeline');
                  }
                }}
                style={{
                  width: '100%', padding: '16px', background: '#004038', color: '#fff',
                  border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 8px 24px rgba(0,64,56,0.2)', cursor: 'pointer',
                }}
              >
                <ArrowRight size={18} /> View in Pipeline
              </button>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => {
                    // Navigate to pipeline detail for scheduling — opens the candidate detail with transition options
                    const matchParam = new URLSearchParams(window.location.search).get('match_id') || '';
                    if (matchParam) {
                      router.push(`/dashboard/employer/pipeline/${matchParam}`);
                    } else {
                      router.push('/dashboard/employer/pipeline');
                    }
                  }}
                  style={{
                    flex: 1, padding: '12px', background: '#f0fdf4', color: '#16a34a',
                    border: '1px solid #bbf7d0', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer'
                  }}
                >
                  <Calendar size={14} /> Schedule Interview
                </button>
                <button
                  onClick={() => {
                    // Open WhatsApp chat with the learner directly
                    const phone = data?.learner?.phone;
                    if (phone) {
                      const normalizedPhone = phone.length === 10 ? `91${phone}` : phone;
                      window.open(`https://wa.me/${normalizedPhone}`, '_blank');
                    } else {
                      router.push('/dashboard/employer/pipeline');
                    }
                  }}
                  style={{
                    flex: 1, padding: '12px', background: '#fff8f1', color: '#fa5d00',
                    border: '1px solid rgba(250,93,0,0.2)', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer'
                  }}
                >
                  <MessageSquare size={14} /> WhatsApp
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Public viewer — show interest/pass buttons */}
              <button
                onClick={handleInterest}
                disabled={hasActed || interestMutation.isPending}
                style={{
                  width: '100%', padding: '16px', background: '#fa5d00', color: '#fff',
                  border: 'none', borderRadius: '16px', fontSize: '18px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 8px 24px rgba(250,93,0,0.3)', cursor: hasActed ? 'not-allowed' : 'pointer',
                  opacity: hasActed ? 0.7 : 1
                }}
              >
                {interestMutation.isPending ? 'Sending...' : '✓ मुझे Interest है'}
              </button>
              
              <button
                onClick={handlePass}
                disabled={hasActed || passMutation.isPending}
                style={{
                  width: '100%', padding: '12px', background: 'transparent', color: '#615f5c',
                  border: 'none', fontSize: '15px', fontWeight: 600, cursor: hasActed ? 'not-allowed' : 'pointer'
                }}
              >
                {passMutation.isPending ? 'Processing...' : 'Pass करें'}
              </button>
            </>
          )}
        </div>

      </div>
    </main>
  );
}
