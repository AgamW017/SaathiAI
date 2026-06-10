import React from 'react';

export default function SkillCard() {
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
            Electrician · NSQF Level 3
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
            ✓ Verified
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
            Watch 60-sec skill demo
          </div>
        </div>

        {/* Skill chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {['AC Wiring', 'Panel Install', 'Safety Protocols'].map(s => (
            <span key={s} style={{
              background: 'var(--color-apricot-wash)',
              color: 'var(--color-saathi-teal)',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
            }}>
              {s}
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
            Endorsed by <strong style={{ color: 'var(--color-ink-black)' }}>Rajesh Sir</strong>, ITI Varanasi
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
          Express Interest via WhatsApp
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
        Loads in &lt;2s on 3G
      </div>
    </div>
  );
}
