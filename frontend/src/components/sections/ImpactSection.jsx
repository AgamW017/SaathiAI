import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const impactStats = [
  { number: '1.2M', label: 'additional placements per year' },
  { number: '₹8,400 Cr', label: 'added to household incomes (est.)' },
  { number: '3.4×', label: 'improvement in 90-day retention' },
];

export default function ImpactSection() {
  const [ref, inView] = useInView({ threshold: 0.15, triggerOnce: true });

  return (
    <section style={{
      background: 'radial-gradient(ellipse at 30% 50%, #00544c 0%, #004038 60%, #002d28 100%)',
      padding: '96px 0',
      position: 'relative', overflow: 'hidden',
    }} ref={ref}>
      {/* Watermark */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(120px, 20vw, 220px)',
          color: 'rgba(255,255,255,0.04)',
          lineHeight: 1, userSelect: 'none',
          whiteSpace: 'nowrap',
        }}>
          12M
        </span>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 32px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          style={{
            fontFamily: 'var(--font-body)', fontWeight: 700,
            fontSize: '12px', letterSpacing: '0.1em',
            color: 'var(--color-parchment-glow)', textTransform: 'uppercase',
            marginBottom: '24px',
          }}
        >
          PROJECTED IMPACT AT SCALE
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 4vw, 52px)',
            color: '#fff', lineHeight: 1.2, marginBottom: '64px',
          }}
        >
          If SaathiAI serves just 10% of India's
          <br />annual vocational graduates —
        </motion.h2>

        {/* Stats row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '32px', marginBottom: '48px',
        }}>
          {impactStats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.15 }}
              style={{ textAlign: 'center' }}
            >
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(48px, 6vw, 72px)',
                color: 'var(--color-parchment-glow)',
                lineHeight: 1.1, marginBottom: '12px',
              }}>
                {stat.number}
              </div>
              <div style={{
                fontFamily: 'var(--font-body)', fontWeight: 500,
                fontSize: '16px', color: 'rgba(255,255,255,0.8)',
                lineHeight: 1.4,
              }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Fine print */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.7 }}
          style={{
            fontFamily: 'var(--font-body)', fontSize: '14px',
            color: 'rgba(255,255,255,0.55)', lineHeight: 1.65,
            maxWidth: 660, margin: '0 auto',
          }}
        >
          Based on 12M annual PMKVY/ITI graduates · 10% reach assumption ·
          avg. ₹7,000/month wage uplift vs informal sector · 90-day retention
          improvement from 19% to 65% baseline (STRIVE Tracer Study + HR survey data)
        </motion.p>
      </div>
    </section>
  );
}
