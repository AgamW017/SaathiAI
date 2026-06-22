import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Badge from '../ui/Badge';
import DashboardMockup from '../ui/DashboardMockup';
import SkillCard from '../ui/SkillCard';
import { useLocale } from '../../lib/locale-context';

function SectionHeader({ eyebrow, headline }: { eyebrow: React.ReactNode; headline: React.ReactNode }) {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });
  return (
    <div ref={ref} style={{ marginBottom: '80px' }}>
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
        {eyebrow}
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.1 }}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(32px, 4vw, 48px)',
          color: 'var(--color-ink-black)',
          lineHeight: 1.2,
        }}
      >
        {headline}
      </motion.h2>
    </div>
  );
}

function FeatureRow({ badge, badgeVariant, headline, body, bullets, cta, visual, reverse }: { badge: string; badgeVariant: string; headline: string; body: string; bullets: string[]; cta?: string; visual: React.ReactNode; reverse: boolean }) {
  const [ref, inView] = useInView({ threshold: 0.15, triggerOnce: true });

  return (
    <div ref={ref} style={{
      display: 'flex', gap: '64px', alignItems: 'center',
      flexDirection: reverse ? 'row-reverse' : 'row',
      marginBottom: '96px',
    }} className="feature-row">
      <motion.div
        initial={{ opacity: 0, x: reverse ? 40 : -40 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ flex: '0 0 45%' }}
      >
        {visual}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: reverse ? -40 : 40 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        style={{ flex: 1 }}
      >
        <Badge variant={badgeVariant} style={{ marginBottom: '20px' }}>
          {badge}
        </Badge>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(26px, 3vw, 36px)',
          color: 'var(--color-ink-black)',
          lineHeight: 1.25, marginBottom: '16px',
        }}>
          {headline}
        </h3>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '17px',
          color: 'var(--color-warm-stone)', lineHeight: 1.65,
          marginBottom: '24px',
        }}>
          {body}
        </p>
        <ul style={{ listStyle: 'none', padding: 0, marginBottom: '24px' }}>
          {bullets.map((b, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              marginBottom: '10px',
              fontFamily: 'var(--font-body)', fontWeight: 500,
              fontSize: '15px', color: 'var(--color-ink-black)',
            }}>
              <span style={{ color: 'var(--color-saathi-teal)', fontWeight: 700, marginTop: '2px' }}>•</span>
              {b}
            </li>
          ))}
        </ul>
        {cta && (
          <a href="#" style={{
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '15px',
            color: 'var(--color-saathi-teal)', textDecoration: 'none',
          }}>
            {cta}
          </a>
        )}
      </motion.div>
    </div>
  );
}

/* Mini Phone Mockup for Feature Row 1 */
function MiniPhoneMockup() {
  const { t } = useLocale();
  return (
    <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
      <div style={{
        position: 'absolute', inset: '-30px',
        background: 'radial-gradient(ellipse, rgba(254,227,181,0.4) 0%, transparent 70%)',
        zIndex: 0,
      }} />
      <div style={{
        width: 280, background: '#1a1a2e',
        borderRadius: 28, border: '7px solid #1a1a2e',
        boxShadow: 'var(--shadow-modal)', overflow: 'hidden',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ background: '#075e54', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>🤝</div>
          <div style={{ color: '#fff', fontSize: '13px', fontFamily: 'var(--font-body)', fontWeight: 600 }}>{t('solution', 'miniMockupTitle')}</div>
        </div>
        <div style={{ background: '#e5ddd5', padding: '12px', minHeight: '160px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ background: 'var(--color-bubble-ai)', borderRadius: '0 14px 14px 14px', padding: '10px 12px', fontSize: '12px', fontFamily: 'var(--font-body)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
            {t('solution', 'miniMockupText')}
          </div>
        </div>
      </div>
      <div style={{
        position: 'absolute', bottom: '-16px', right: '-16px',
        background: 'var(--color-success-surface)',
        color: 'var(--color-success)',
        borderRadius: '12px', padding: '7px 12px',
        fontSize: '11px', fontFamily: 'var(--font-body)', fontWeight: 700,
        boxShadow: 'var(--shadow-card)', zIndex: 2,
      }}>
        {t('solution', 'miniMockupBadge')}
      </div>
    </div>
  );
}

/* District Console Mock */
function DistrictConsoleMock() {
  const { t } = useLocale();
  const bars = [
    { label: t('solution', 'consoleTrade1'), pct: 73, color: 'var(--color-saathi-teal)' },
    { label: t('solution', 'consoleTrade2'), pct: 61, color: 'var(--color-saathi-teal)' },
    { label: t('solution', 'consoleTrade3'), pct: 22, color: 'var(--color-caution)' },
  ];

  return (
    <div style={{
      background: 'var(--color-pure-white)',
      borderRadius: '16px',
      padding: '24px',
      width: '100%',
      maxWidth: 380,
    }}>
      <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '14px', color: 'var(--color-ink-black)', marginBottom: '4px' }}>
        {t('solution', 'consoleDistrict')}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-warm-stone)', marginBottom: '20px' }}>
        {t('solution', 'consoleSub')}
      </div>
      {bars.map((b) => (
        <div key={b.label} style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-ink-black)', fontWeight: 500 }}>{b.label}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: b.color, fontWeight: 700 }}>{b.pct}%</span>
          </div>
          <div style={{ background: 'var(--color-mist)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${b.pct}%`, height: '100%', background: b.color, borderRadius: '4px', transition: 'width 1s ease' }} />
          </div>
        </div>
      ))}
      <div style={{
        marginTop: '16px', padding: '10px 12px',
        background: 'var(--color-cream-canvas)', borderRadius: '8px',
        fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-warm-stone)',
      }}>
        {t('solution', 'consoleFooter')}
      </div>
    </div>
  );
}

export default function SolutionSection() {
  const { t } = useLocale();
  return (
    <section id="how-it-works" style={{ background: 'var(--color-cream-canvas)', padding: '96px 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
        <SectionHeader
          eyebrow={t('solution', 'eyebrow')}
          headline={<span style={{ whiteSpace: 'pre-line' }}>{t('solution', 'headline')}</span>}
        />

        {/* Row 1 */}
        <FeatureRow
          badge={t('solution', 'badge1')}
          badgeVariant="success"
          headline={t('solution', 'badge1_headline')}
          body={t('solution', 'badge1_body')}
          bullets={[
            t('solution', 'badge1_bullet1'),
            t('solution', 'badge1_bullet2'),
            t('solution', 'badge1_bullet3'),
            t('solution', 'badge1_bullet4'),
          ]}
          cta={t('solution', 'badge1_cta')}
          visual={<MiniPhoneMockup />}
          reverse={true}
        />

        {/* Row 2 */}
        <FeatureRow
          badge={t('solution', 'badge2')}
          badgeVariant="teal"
          headline={t('solution', 'badge2_headline')}
          body={t('solution', 'badge2_body')}
          bullets={[
            t('solution', 'badge2_bullet1'),
            t('solution', 'badge2_bullet2'),
            t('solution', 'badge2_bullet3'),
            t('solution', 'badge2_bullet4'),
          ]}
          visual={<div style={{ display: 'flex', justifyContent: 'center' }}><DashboardMockup /></div>}
          reverse={false}
        />

        {/* Row 3 */}
        <FeatureRow
          badge={t('solution', 'badge3')}
          badgeVariant="flame"
          headline={t('solution', 'badge3_headline')}
          body={t('solution', 'badge3_body')}
          bullets={[
            t('solution', 'badge3_bullet1'),
            t('solution', 'badge3_bullet2'),
            t('solution', 'badge3_bullet3'),
            t('solution', 'badge3_bullet4'),
          ]}
          visual={<div style={{ display: 'flex', justifyContent: 'center' }}><SkillCard /></div>}
          reverse={true}
        />

        {/* Row 4 — District Console (full-width teal) */}
        <DistrictRow />
      </div>

      <style>{`
        .feature-row { flex-direction: row !important; }
        @media (max-width: 1024px) {
          .feature-row { flex-direction: column !important; }
        }
      `}</style>
    </section>
  );
}

function DistrictRow() {
  const { t } = useLocale();
  const [ref, inView] = useInView({ threshold: 0.15, triggerOnce: true });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
      style={{
        background: 'radial-gradient(ellipse at 30% 50%, #00544c 0%, #004038 60%, #002d28 100%)',
        borderRadius: '24px',
        padding: '64px',
        display: 'flex', gap: '64px', alignItems: 'center',
      }}
      className="district-row"
    >
      <div style={{ flex: 1 }}>
        <span style={{
          display: 'inline-flex', background: 'var(--color-parchment-glow)',
          color: 'var(--color-saathi-teal)', borderRadius: '999px',
          padding: '5px 14px', fontSize: '11px',
          fontFamily: 'var(--font-body)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: '20px',
        }}>
          {t('solution', 'badge4')}
        </span>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px, 2.5vw, 36px)',
          color: '#fff', marginBottom: '16px', lineHeight: 1.25,
        }}>
          {t('solution', 'badge4_headline')}
        </h3>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '16px',
          color: 'rgba(255,255,255,0.75)', lineHeight: 1.65,
        }}>
          {t('solution', 'badge4_body')}
        </p>
      </div>
      <div style={{ flex: '0 0 380px', display: 'flex', justifyContent: 'center' }} className="district-visual">
        <DistrictConsoleMock />
      </div>

      <style>{`
        .district-row { flex-direction: row !important; }
        @media (max-width: 1024px) {
          .district-row { flex-direction: column !important; }
          .district-visual { flex: none !important; width: 100% !important; }
        }
        @media (max-width: 768px) {
          .district-row { padding: 32px !important; }
        }
      `}</style>
    </motion.div>
  );
}
