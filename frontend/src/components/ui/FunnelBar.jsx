import React from 'react';
import { motion } from 'framer-motion';

export default function FunnelBar({ label, percent, color, delay = 0, animate = false, maxWidth = 400 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
      <div style={{
        width: '180px', flexShrink: 0,
        fontSize: '13px', fontFamily: 'var(--font-body)',
        color: 'var(--color-warm-stone)', textAlign: 'right',
      }}>
        {label}
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{
          background: 'rgba(0,0,0,0.08)',
          borderRadius: '4px', height: '28px', overflow: 'hidden',
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={animate ? { width: `${percent}%` } : { width: 0 }}
            transition={{ duration: 1.2, delay, ease: color === 'teal' ? [0.34, 1.56, 0.64, 1] : 'easeOut' }}
            style={{
              height: '100%',
              borderRadius: '4px',
              background: color === 'teal'
                ? 'linear-gradient(90deg, var(--color-saathi-teal), var(--color-deep-moss))'
                : color === 'amber'
                  ? 'var(--color-caution)'
                  : 'var(--color-mist)',
            }}
          />
        </div>
      </div>
      <div style={{
        width: '48px', flexShrink: 0,
        fontSize: '14px', fontFamily: 'var(--font-display)',
        color: color === 'teal' ? 'var(--color-saathi-teal)' : 'var(--color-warm-stone)',
        fontWeight: 700,
      }}>
        {percent}%
      </div>
    </div>
  );
}
