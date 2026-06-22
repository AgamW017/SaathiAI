import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Button from '../ui/Button';
import { useLocale } from '../../lib/locale-context';

const personas = [
  { labelKey: 'learner', href: '#' },
  { labelKey: 'officer', href: '#' },
  { labelKey: 'msme', href: '#' },
  { labelKey: 'district', href: '#' },
];

export default function FinalCTA() {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });
  const { t } = useLocale();

  return (
    <section style={{ background: 'var(--color-cream-canvas)', padding: '96px 0' }} ref={ref}>
      <div style={{
        maxWidth: 760, margin: '0 auto', padding: '0 32px',
        textAlign: 'center',
      }}>
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px, 4vw, 52px)',
            color: 'var(--color-ink-black)',
            marginBottom: '20px', lineHeight: 1.15,
          }}
        >
          {t('cta', 'heading')}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          style={{
            fontFamily: 'var(--font-body)', fontSize: '18px',
            color: 'var(--color-warm-stone)', lineHeight: 1.65,
            marginBottom: '40px',
          }}
        >
          {t('cta', 'body')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '40px' }}
        >
          {/* <Button variant="flame" size="lg">{t('cta', 'btn1')}</Button>
          <Button variant="teal-outline" size="lg">{t('cta', 'btn2')}</Button> */}
        </motion.div>

        {/* Persona chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.4 }}
          style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}
        >
          {personas.map((p) => (
            <a
              key={p.labelKey}
              href={p.href}
              style={{
                background: 'var(--color-apricot-wash)',
                color: 'var(--color-saathi-teal)',
                borderRadius: '999px', padding: '8px 18px',
                fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: '13px',
                textDecoration: 'none', transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                display: 'inline-block',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-card-warm)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '';
              }}
            >
              {t('cta', p.labelKey)}
            </a>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
