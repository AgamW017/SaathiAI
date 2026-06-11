import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLocale } from '../../lib/locale-context';

const getCards = (t: any) => [
  {
    num: '01',
    color: 'var(--color-saathi-teal)',
    stat: t('breakpoints', 'card1_stat'),
    title: t('breakpoints', 'card1_title'),
    body: t('breakpoints', 'card1_body'),
    icon: '🎓',
  },
  {
    num: '02',
    color: 'var(--color-action-flame)',
    stat: t('breakpoints', 'card2_stat'),
    title: t('breakpoints', 'card2_title'),
    body: t('breakpoints', 'card2_body'),
    icon: '📄',
  },
  {
    num: '03',
    color: '#d97706',
    stat: t('breakpoints', 'card3_stat'),
    title: t('breakpoints', 'card3_title'),
    body: t('breakpoints', 'card3_body'),
    icon: '📉',
  },
  {
    num: '04',
    color: 'var(--color-info)',
    stat: t('breakpoints', 'card4_stat'),
    title: t('breakpoints', 'card4_title'),
    body: t('breakpoints', 'card4_body'),
    icon: '🔄',
  },
  {
    num: '05',
    color: 'var(--color-risk)',
    stat: t('breakpoints', 'card5_stat'),
    title: t('breakpoints', 'card5_title'),
    body: t('breakpoints', 'card5_body'),
    icon: '📊',
  },
];

function BreakpointCard({ card, delay, triggered }: { card: any; delay: number; triggered: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={triggered ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--color-cream-canvas)',
        border: '1px solid var(--color-mist)',
        borderTop: `4px solid ${card.color}`,
        borderRadius: '16px',
        padding: '28px 20px',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? 'var(--shadow-card-teal)' : 'var(--shadow-card)',
        cursor: 'default',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <span style={{
          fontFamily: 'var(--font-body)', fontWeight: 700,
          fontSize: '13px', color: card.color, textTransform: 'uppercase',
        }}>
          {card.num}
        </span>
        <span style={{ fontSize: '28px' }}>{card.icon}</span>
      </div>

      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '38px',
        color: card.color,
        lineHeight: 1.1, marginBottom: '8px',
      }}>
        {card.stat}
      </div>

      <div style={{
        fontFamily: 'var(--font-body)', fontWeight: 700,
        fontSize: '12px', textTransform: 'uppercase',
        color: 'var(--color-ink-black)',
        letterSpacing: '0.05em', marginBottom: '12px',
      }}>
        {card.title}
      </div>

      <div style={{
        fontFamily: 'var(--font-body)', fontSize: '14px',
        color: 'var(--color-warm-stone)', lineHeight: 1.55,
      }}>
        {card.body}
      </div>
    </motion.div>
  );
}

export default function BreakpointsSection() {
  const { t } = useLocale();
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const cards = getCards(t);

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
              color: 'var(--color-action-flame)',
              textTransform: 'uppercase', marginBottom: '16px',
            }}
          >
            {t('breakpoints', 'eyebrow')}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(32px, 3.5vw, 44px)',
              color: 'var(--color-ink-black)',
              marginBottom: '20px',
              whiteSpace: 'pre-line',
            }}
          >
            {t('breakpoints', 'heading1')}
            <br />{t('breakpoints', 'heading2')}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15 }}
            style={{
              fontFamily: 'var(--font-body)', fontSize: '18px',
              color: 'var(--color-warm-stone)',
              maxWidth: 560, margin: '0 auto', lineHeight: 1.6,
            }}
          >
            {t('breakpoints', 'subheading')}
          </motion.p>
        </div>

        {/* Cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
        }}>
          {cards.map((card, i) => (
            <BreakpointCard key={i} card={card} delay={i * 0.1} triggered={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
