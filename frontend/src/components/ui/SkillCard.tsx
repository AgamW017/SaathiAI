import React from 'react';
import { useLocale } from '../../lib/locale-context';

export default function SkillCard() {
  const { t } = useLocale();

  return (
    <div style={{
      width: 300,
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-modal)',
      background: 'var(--color-pure-white)',
      borderTop: '3px solid var(--color-success)',
      position: 'relative',
      flexShrink: 0,
    }}>
      {/* Header band */}
      <div style={{
        background: 'var(--color-saathi-teal)',
        padding: '20px',
        display: 'flex', alignItems: 'center', gap: '14px',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontSize: '18px', color: '#fff',
          fontWeight: 700, flexShrink: 0,
        }}>
          RK
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '19px', color: '#fff' }}>
            Ramu Kumar
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-body)' }}>
            {t('mockups', 'nsqfRole')}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px' }}>
        {/* Verified row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '14px',
          padding: '8px 12px',
          background: 'var(--color-success-surface)',
          borderRadius: '8px',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--color-saathi-teal)', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
            🏛️ DigiLocker
          </span>
          <span style={{ color: 'var(--color-bone)', fontSize: '10px' }}>·</span>
          <span style={{ fontSize: '13px', color: 'var(--color-saathi-teal)', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
            NSDC
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--color-success)', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
            {t('mockups', 'digilockerVerified')}
          </span>
        </div>

        {/* Video thumbnail */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: '10px',
          height: '90px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '14px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px',
          }}>▶</div>
          <div style={{
            position: 'absolute', bottom: '8px',
            fontSize: '10px', color: 'rgba(255,255,255,0.6)',
            fontFamily: 'var(--font-body)',
          }}>
            {t('mockups', 'demoDesc')}
          </div>
        </div>

        {/* Skill chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {['skill1', 'skill2', 'skill3'].map((key) => (
            <span key={key} style={{
              background: 'var(--color-apricot-wash)',
              color: 'var(--color-saathi-teal)',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
            }}>
              {t('mockups', key)}
            </span>
          ))}
        </div>

        {/* Trainer endorsement */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px',
          background: 'var(--color-cream-canvas)',
          borderRadius: '8px',
          marginBottom: '14px',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--color-saathi-teal)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', color: '#fff',
            fontWeight: 700, flexShrink: 0,
          }}>R</div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-body)', color: 'var(--color-warm-stone)' }}>
            {t('mockups', 'endorsedBy')}
          </div>
        </div>

        {/* CTA */}
        <button style={{
          width: '100%',
          background: 'var(--color-action-flame)',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          padding: '12px',
          fontSize: '13px',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          {t('mockups', 'expressInterest')}
        </button>
      </div>

      {/* Floating badge */}
      <div style={{
        position: 'absolute', top: '12px', right: '-8px',
        background: 'var(--color-pure-white)',
        border: '1px solid var(--color-mist)',
        borderRadius: '8px',
        padding: '4px 8px',
        fontSize: '10px',
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        color: 'var(--color-success)',
        boxShadow: 'var(--shadow-card)',
      }}>
        {t('mockups', 'loadsFast')}
      </div>
    </div>
  );
}
