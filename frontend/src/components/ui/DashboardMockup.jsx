import React, { useState } from 'react';

const priorities = [
  {
    color: 'var(--color-risk)',
    bg: 'var(--color-risk-surface)',
    name: 'Ramu Kumar',
    sub: '14 days no response · Intervene',
    action: 'Call',
    actionBg: 'var(--color-risk)',
  },
  {
    color: 'var(--color-caution)',
    bg: 'var(--color-caution-surface)',
    name: 'Priya Sharma',
    sub: 'Interview tomorrow · Brief her',
    action: 'Send',
    actionBg: 'var(--color-caution)',
  },
  {
    color: 'var(--color-success)',
    bg: 'var(--color-success-surface)',
    name: 'Arjun Verma',
    sub: 'Placed! ✓ · Confirm',
    action: 'Confirm',
    actionBg: 'var(--color-success)',
  },
];

export default function DashboardMockup() {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        width: 380,
        background: 'var(--color-pure-white)',
        borderRadius: 20,
        boxShadow: 'var(--shadow-modal)',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--color-mist)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: 'var(--font-body)', fontWeight: 700,
            fontSize: '15px', color: 'var(--color-ink-black)',
          }}>
            Priority Actions
          </span>
          <span style={{
            background: 'var(--color-risk-surface)',
            color: 'var(--color-risk)',
            borderRadius: '999px', padding: '3px 10px',
            fontSize: '11px', fontFamily: 'var(--font-body)', fontWeight: 700,
          }}>
            3 urgent
          </span>
        </div>

        {/* Priority rows */}
        <div>
          {priorities.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center',
              padding: '14px 20px',
              borderLeft: `4px solid ${p.color}`,
              borderBottom: i < priorities.length - 1 ? '1px solid var(--color-mist)' : 'none',
              background: 'transparent',
              gap: '12px',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: p.bg, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700,
                fontFamily: 'var(--font-body)', color: p.color,
              }}>
                {p.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--color-ink-black)' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-body)', color: 'var(--color-warm-stone)', marginTop: '2px' }}>
                  {p.sub}
                </div>
              </div>
              <button style={{
                background: p.actionBg, color: '#fff',
                border: 'none', borderRadius: '8px',
                padding: '5px 10px', fontSize: '11px',
                fontFamily: 'var(--font-body)', fontWeight: 600,
                cursor: 'pointer', flexShrink: 0,
              }}>
                {p.action}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          background: 'var(--color-cream-canvas)',
          fontSize: '12px',
          fontFamily: 'var(--font-body)',
          color: 'var(--color-warm-stone)',
        }}>
          12 of 200 learners need attention today
        </div>
      </div>

      {/* Floating badge */}
      <div style={{
        position: 'absolute', bottom: '-16px', right: '-16px',
        background: 'var(--color-success-surface)',
        color: 'var(--color-success)',
        borderRadius: '12px', padding: '8px 14px',
        fontSize: '12px', fontFamily: 'var(--font-body)', fontWeight: 700,
        boxShadow: 'var(--shadow-card)',
      }}>
        ↓ 60% less manual work
      </div>
    </div>
  );
}
