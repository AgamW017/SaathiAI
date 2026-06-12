import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import FunnelBar from '../ui/FunnelBar';
import { useLocale } from '../../lib/locale-context';

const getBrokenPipeline = (t: any) => [
  { label: t('funnel', 'leftStep1'), percent: 100 },
  { label: t('funnel', 'leftStep2'), percent: 82 },
  { label: t('funnel', 'leftStep3'), percent: 58 },
  { label: t('funnel', 'leftStep4'), percent: 43 },
  { label: t('funnel', 'leftStep5'), percent: 19 },
];

const getSaathiPathway = (t: any) => [
  { label: t('funnel', 'rightStep1'), percent: 100 },
  { label: t('funnel', 'rightStep2'), percent: 95 },
  { label: t('funnel', 'rightStep3'), percent: 88 },
  { label: t('funnel', 'rightStep4'), percent: 75 },
  { label: t('funnel', 'rightStep5'), percent: 65 },
];

export default function FunnelSection() {
  const { t } = useLocale();
  const [ref, inView] = useInView({ threshold: 0.15, triggerOnce: true });
  const brokenPipeline = getBrokenPipeline(t);
  const saathiPathway = getSaathiPathway(t);

  return (
    <section style={{ background: 'var(--color-pure-white)', padding: '96px 0' }} ref={ref}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            style={{
              fontFamily: 'var(--font-body)', fontWeight: 700,
              fontSize: '12px', letterSpacing: '0.1em',
              color: 'var(--color-action-flame)', textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            {t('funnel', 'eyebrow')}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 3.5vw, 44px)',
              color: 'var(--color-ink-black)',
            }}
          >
            {t('funnel', 'headline')}
          </motion.h2>
        </div>

        {/* Funnel comparison */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '32px', alignItems: 'center',
          }}
          className="funnel-grid"
        >
          {/* Left — Broken */}
          <div>
            <div style={{ marginBottom: '24px' }}>
              <span style={{
                display: 'inline-flex',
                background: 'var(--color-risk-surface)',
                color: 'var(--color-risk)',
                borderRadius: '999px', padding: '5px 14px',
                fontSize: '11px', fontFamily: 'var(--font-body)',
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                marginBottom: '12px',
              }}>
                {t('funnel', 'leftTitle')}
              </span>
            </div>
            {brokenPipeline.map((bar, i) => (
              <FunnelBar
                key={bar.label}
                label={bar.label}
                percent={bar.percent}
                color="gray"
                delay={i * 0.08}
                animate={inView}
              />
            ))}
            <div style={{
              marginTop: '16px', fontSize: '11px',
              fontFamily: 'var(--font-body)', color: 'var(--color-bone)',
              fontStyle: 'italic',
            }}>
              {t('funnel', 'leftSource')}
            </div>
          </div>

          {/* VS */}
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '48px',
            color: 'var(--color-bone)', textAlign: 'center',
          }}>
            {t('funnel', 'vs')}
          </div>

          {/* Right — SaathiAI */}
          <div>
            <div style={{ marginBottom: '24px' }}>
              <span style={{
                display: 'inline-flex',
                background: 'var(--color-success-surface)',
                color: 'var(--color-success)',
                borderRadius: '999px', padding: '5px 14px',
                fontSize: '11px', fontFamily: 'var(--font-body)',
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                marginBottom: '12px',
              }}>
                {t('funnel', 'rightTitle')}
              </span>
            </div>
            {saathiPathway.map((bar, i) => (
              <FunnelBar
                key={bar.label}
                label={bar.label}
                percent={bar.percent}
                color="teal"
                delay={i * 0.08 + 0.4}
                animate={inView}
              />
            ))}
          </div>
        </motion.div>

        {/* Callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.0 }}
          style={{
            marginTop: '48px', textAlign: 'center',
            background: 'rgba(250,93,0,0.08)',
            border: '1px solid rgba(250,93,0,0.2)',
            borderRadius: '16px', padding: '24px 32px',
          }}
        >
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '18px',
            color: 'var(--color-ink-black)', lineHeight: 1.5,
          }}>
            {t('funnel', 'callout1')}
            <strong style={{ color: 'var(--color-action-flame)' }}>
              {t('funnel', 'calloutHighlight')}
            </strong>
            {t('funnel', 'callout2')}
          </p>
        </motion.div>
      </div>

      <style>{`
        .funnel-grid { grid-template-columns: 1fr auto 1fr !important; }
        @media (max-width: 1024px) {
          .funnel-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
