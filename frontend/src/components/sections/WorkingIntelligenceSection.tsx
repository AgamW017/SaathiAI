import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLocale } from '../../lib/locale-context';

const getIntelligenceCards = (t: any) => [
  {
    icon: '🎙️',
    title: t('intelligence', 'speech_title'),
    body: t('intelligence', 'speech_body'),
    color: 'var(--color-saathi-teal)',
  },
  {
    icon: '🧠',
    title: t('intelligence', 'llm_title'),
    body: t('intelligence', 'llm_body'),
    color: 'var(--color-action-flame)',
  },
  {
    icon: '📈',
    title: t('intelligence', 'risk_title'),
    body: t('intelligence', 'risk_body'),
    color: '#d97706',
  },
  {
    icon: '📄',
    title: t('intelligence', 'document_title'),
    body: t('intelligence', 'document_body'),
    color: '#0ea5e9',
  },
];

function IntelligenceCard({ card, delay, triggered }: { card: any; delay: number; triggered: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={triggered ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--color-pure-white)',
        border: '1px solid var(--color-mist)',
        borderRadius: '16px',
        padding: '32px 24px',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? 'var(--shadow-card-teal)' : 'var(--shadow-card)',
      }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: '16px',
        background: `${card.color}18`, color: card.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '28px', marginBottom: '24px',
      }}>
        {card.icon}
      </div>
      <h3 style={{
        fontFamily: 'var(--font-display)', fontSize: '24px',
        color: 'var(--color-ink-black)', marginBottom: '16px',
      }}>
        {card.title}
      </h3>
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: '15px',
        color: 'var(--color-warm-stone)', lineHeight: 1.6,
      }} dangerouslySetInnerHTML={{ __html: card.body }} />
    </motion.div>
  );
}

export default function WorkingIntelligenceSection() {
  const { t } = useLocale();
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const cards = getIntelligenceCards(t);

  return (
    <section style={{ background: 'var(--color-pure-white)', padding: '96px 0' }} ref={ref}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
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
            {t('intelligence', 'eyebrow')}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(32px, 3.5vw, 44px)',
              color: 'var(--color-ink-black)',
            }}
          >
            {t('intelligence', 'headline')}
          </motion.h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '24px',
        }}>
          {cards.map((card, i) => (
            <IntelligenceCard key={i} card={card} delay={i * 0.1} triggered={inView} />
          ))}
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6 }}
          style={{
            marginTop: '48px', padding: '16px 24px',
            background: 'var(--color-cream-canvas)',
            borderRadius: '12px', textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            border: '1px solid rgba(0, 84, 76, 0.1)'
          }}
        >
          <span style={{ fontSize: '20px' }}>🛡️</span>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: '14px',
            color: 'var(--color-saathi-teal)', fontWeight: 500, fontStyle: 'italic'
          }}>
            {t('intelligence', 'graceful_degradation')}
          </span>
        </motion.div>
      </div>
    </section>
  );
}
