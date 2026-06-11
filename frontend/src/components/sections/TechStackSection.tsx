import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useLocale } from '../../lib/locale-context';

const integrations = [
  {
    icon: '🗣️',
    key: 'sarvam',
    color: '#6366f1',
  },
  {
    icon: '🏛️',
    key: 'digilocker',
    color: '#0ea5e9',
  },
  {
    icon: '🎓',
    key: 'sidh',
    color: 'var(--color-saathi-teal)',
  },
  {
    icon: '🏗️',
    key: 'naps',
    color: '#f59e0b',
  },
  {
    icon: '💼',
    key: 'ncs',
    color: '#10b981',
  },
  {
    icon: '💬',
    key: 'whatsapp',
    color: '#25d366',
  },
];

const flowNodes = [
  { key: 'node1', icon: '💬' },
  { key: 'node2', icon: '🤝' },
  { key: 'node3', icon: '🏛️' },
  { key: 'node4', icon: '📋' },
  { key: 'node5', icon: '📊' },
  { key: 'node6', icon: '🗺️' },
];

function IntegrationCard({ item, delay, triggered, t }: { item: any; delay: number; triggered: boolean; t: any }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={triggered ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.4 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--color-pure-white)',
        border: '1px solid var(--color-mist)',
        borderRadius: '16px',
        padding: '24px',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? 'var(--shadow-card-teal)' : 'var(--shadow-card)',
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: '12px',
        background: `${item.color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '24px', marginBottom: '16px',
      }}>
        {item.icon}
      </div>
      <div style={{
        fontFamily: 'var(--font-body)', fontWeight: 700,
        fontSize: '16px', color: 'var(--color-ink-black)',
        marginBottom: '8px',
      }}>
        {t('tech', `${item.key}_name`)}
      </div>
      <div style={{
        fontFamily: 'var(--font-body)', fontSize: '14px',
        color: 'var(--color-warm-stone)', lineHeight: 1.5,
      }}>
        {t('tech', `${item.key}_role`)}
      </div>
    </motion.div>
  );
}

export default function TechStackSection() {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const { t } = useLocale();

  return (
    <section style={{ background: 'var(--color-cream-canvas)', padding: '80px 0' }} ref={ref}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '12px',
            letterSpacing: '0.1em', color: 'var(--color-action-flame)',
            textTransform: 'uppercase', marginBottom: '16px',
          }}
        >
          {t('tech', 'eyebrow')}
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 3.5vw, 40px)',
            color: 'var(--color-ink-black)',
            marginBottom: '48px',
          }}
        >
          {t('tech', 'headline')}
        </motion.h2>

        {/* Integration grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px', marginBottom: '64px',
        }}>
          {integrations.map((item, i) => (
            <IntegrationCard key={i} item={item} delay={i * 0.08} triggered={inView} t={t} />
          ))}
        </div>

        {/* Flow diagram */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6 }}
          style={{
            background: 'var(--color-pure-white)',
            border: '1px solid var(--color-mist)',
            borderRadius: '16px', padding: '32px',
            overflowX: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', minWidth: 'max-content', margin: '0 auto', justifyContent: 'center' }}>
            {flowNodes.map((node, i) => (
              <React.Fragment key={i}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: '8px',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '12px',
                    background: 'var(--color-cream-canvas)',
                    border: '2px solid var(--color-saathi-teal)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px',
                  }}>
                    {node.icon}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-body)', fontSize: '11px',
                    color: 'var(--color-saathi-teal)', fontWeight: 600,
                    textAlign: 'center', maxWidth: '80px', lineHeight: 1.3,
                  }}>
                    {t('tech', node.key)}
                  </div>
                </div>
                {i < flowNodes.length - 1 && (
                  <div style={{
                    color: 'var(--color-saathi-teal)', fontSize: '18px',
                    margin: '0 8px', paddingBottom: '24px', opacity: 0.5,
                  }}>→</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
