import React from 'react';
import { useLocale } from '../../lib/locale-context';

function SaathiLogoWhite() {
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="13" fill="rgba(255,255,255,0.15)" />
      <path d="M8 16 C8 13 10 11 12 12 L14 13 L16 12 C18 11 20 13 20 16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M11 14 L14 17 L17 14" stroke="#fee3b5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="14" cy="9" r="2" fill="#fee3b5" />
    </svg>
  );
}

export default function Footer() {
  const { t } = useLocale();

  return (
    <footer style={{
      background: 'var(--color-ink-black)',
      padding: '48px 0 0',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 32px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: '32px', flexWrap: 'wrap',
      }}>
        {/* Left */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <SaathiLogoWhite />
            <span style={{
              fontFamily: 'var(--font-body)', fontSize: '20px', color: '#fff',
            }}>
              SaathiAI
            </span>
          </div>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '14px',
            color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
            maxWidth: 320,
          }}>
            {t('footer', 'desc1')}
            <br />{t('footer', 'desc2')}
          </p>
        </div>

        {/* Right */}
        <div style={{ maxWidth: 400 }}>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '13px',
            color: 'rgba(255,255,255,0.4)', lineHeight: 1.7,
          }}>
            <strong style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{t('footer', 'sourcesTitle')}</strong>
            <br />{t('footer', 'sourcesList')}
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '16px 32px',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '12px',
          color: 'rgba(255,255,255,0.3)',
        }}>
          {t('footer', 'copyright')}
        </p>
      </div>
    </footer>
  );
}
