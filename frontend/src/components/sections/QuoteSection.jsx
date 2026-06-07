import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

export default function QuoteSection() {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });

  return (
    <section style={{ background: 'var(--color-pure-white)', padding: '80px 0' }} ref={ref}>
      <div style={{
        maxWidth: 760, margin: '0 auto', padding: '0 32px',
        textAlign: 'center', position: 'relative',
      }}>
        {/* Decorative quote mark */}
        <div style={{
          position: 'absolute', top: '-20px', left: '20px',
          fontFamily: 'var(--font-display)',
          fontSize: '120px', color: 'var(--color-mist)',
          lineHeight: 1, userSelect: 'none', zIndex: 0,
          opacity: 0.6,
        }}>
          "
        </div>

        <motion.blockquote
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(20px, 2.5vw, 28px)',
            color: 'var(--color-ink-black)',
            fontStyle: 'italic', lineHeight: 1.4,
            position: 'relative', zIndex: 1,
            marginBottom: '32px',
          }}
        >
          "India's vocational system is generating certified,
          cognitively capable human capital that the market
          cannot discover, verify, trust, or integrate."
        </motion.blockquote>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.3 }}
          style={{
            fontFamily: 'var(--font-body)', fontWeight: 600,
            fontSize: '14px', color: 'var(--color-warm-stone)',
            lineHeight: 1.5, marginBottom: '40px',
          }}
        >
          — Structural Bottlenecks in India's Education-to-Employment Pathways, 2026
          <br />
          <span style={{ fontWeight: 400, fontSize: '13px' }}>
            (Synthesized from World Bank · STRIVE Tracer Study · CAG Audit · India Skills Report 2026)
          </span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5 }}
          style={{
            display: 'inline-block',
            borderTop: '2px solid var(--color-mist)',
            paddingTop: '32px',
            width: '100%',
          }}
        >
          <p style={{
            fontFamily: 'var(--font-body)', fontWeight: 500,
            fontSize: '18px', color: 'var(--color-saathi-teal)',
          }}>
            SaathiAI is the discovery, verification, and trust layer that's missing.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
