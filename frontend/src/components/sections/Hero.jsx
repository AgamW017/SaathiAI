import React from 'react';
import { motion } from 'framer-motion';
import Button from '../ui/Button.jsx';
import PhoneMockup from '../ui/PhoneMockup.jsx';

const fadeUp = (delay) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: 'easeOut' },
});

const trustPills = [
  '✓ WhatsApp-Native',
  '✓ 12 Indian Languages',
  '✓ Offline-Resilient',
  '✓ DigiLocker Verified',
];

export default function Hero() {
  return (
    <section style={{
      minHeight: 'calc(100vh - 68px)',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center',
    }}>
      {/* Background atmosphere */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'linear-gradient(180deg, var(--color-cream-canvas) 0%, #fff4e8 100%)',
      }} />
      <div style={{
        position: 'absolute', right: 0, top: 0,
        width: '50%', height: '100%', zIndex: 0,
        background: 'linear-gradient(180deg, var(--color-cream-canvas) 0%, var(--color-pure-white) 100%)',
      }} />
      <div style={{
        position: 'absolute', right: '5%', top: '15%',
        width: '55%', height: '75%', zIndex: 0,
        background: 'radial-gradient(ellipse at 70% 30%, rgba(254,227,181,0.5) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      {/* Subtle diagonal lines left half */}
      <div style={{
        position: 'absolute', left: 0, top: 0,
        width: '50%', height: '100%', zIndex: 0,
        opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='0' y1='40' x2='40' y2='0' stroke='%23004038' strokeWidth='1'/%3E%3C/svg%3E")`,
        backgroundSize: '40px 40px',
      }} />

      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '80px 32px',
        display: 'flex', alignItems: 'center', gap: '64px',
        width: '100%', position: 'relative', zIndex: 1,
      }} className="hero-inner">
        {/* Left column */}
        <div style={{ flex: '0 0 55%', maxWidth: '55%' }} className="hero-left">
          <motion.div {...fadeUp(0.1)} style={{
            fontFamily: 'var(--font-body)', fontWeight: 700,
            fontSize: '12px', letterSpacing: '0.12em',
            color: 'var(--color-action-flame)',
            textTransform: 'uppercase', marginBottom: '24px',
          }}>
            SHIKSHA HACKATHON 2026 · PROBLEM STATEMENT 3.5
          </motion.div>

          <motion.h1 {...fadeUp(0.2)} style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(42px, 5vw, 64px)',
            lineHeight: 1.1,
            color: 'var(--color-ink-black)',
            marginBottom: '8px',
          }}>
            12 million graduates.
            <br />No one to guide them.
          </motion.h1>

          <motion.div {...fadeUp(0.35)} style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(42px, 5vw, 64px)',
            lineHeight: 1.1,
            color: 'var(--color-saathi-teal)',
            fontStyle: 'italic',
            marginBottom: '28px',
          }}>
            Until now.
          </motion.div>

          <motion.p {...fadeUp(0.45)} style={{
            fontFamily: 'var(--font-body)', fontSize: '18px',
            color: 'var(--color-warm-stone)', lineHeight: 1.65,
            maxWidth: 480, marginBottom: '36px',
          }}>
            SaathiAI is a WhatsApp-native AI companion that meets every
            ITI and PMKVY graduate exactly where they are — on their
            phone, in Hindi, the moment training ends. No app download.
            No English required. No bureaucracy.
          </motion.p>

          <motion.div {...fadeUp(0.55)} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '36px' }}>
            <Button variant="flame">See How It Works →</Button>
            <Button variant="teal-outline">Watch Demo ▶</Button>
          </motion.div>

          {/* Trust strip */}
          <motion.div {...fadeUp(0.65)} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {trustPills.map(pill => (
              <span key={pill} style={{
                background: 'var(--color-pure-white)',
                border: '1px solid var(--color-mist)',
                borderRadius: '999px',
                padding: '6px 14px',
                fontFamily: 'var(--font-body)',
                fontWeight: 600, fontSize: '13px',
                color: 'var(--color-ink-black)',
                whiteSpace: 'nowrap',
              }}>
                {pill}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Right column — phone */}
        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
          style={{ flex: '0 0 45%', display: 'flex', justifyContent: 'center' }}
          className="hero-right"
        >
          <PhoneMockup />
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .hero-inner { flex-direction: column !important; gap: 48px !important; }
          .hero-left { flex: none !important; max-width: 100% !important; }
          .hero-right { flex: none !important; }
        }
      `}</style>
    </section>
  );
}
