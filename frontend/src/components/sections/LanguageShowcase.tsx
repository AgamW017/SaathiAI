'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { LOCALES, LocaleCode, formatUserCount } from '../../lib/i18n';
import { useLocale } from '../../lib/locale-context';

// ── Tile colours — one accent per language ────────────────────────────────
const TILE_ACCENTS: Record<string, { from: string; to: string; glow: string }> = {
  hi:    { from: '#004038', to: '#00544c', glow: 'rgba(0,64,56,0.4)' },
  'hi-HG': { from: '#1a3a5c', to: '#1e4976', glow: 'rgba(26,58,92,0.4)' },
  bn:    { from: '#3b0764', to: '#581c87', glow: 'rgba(59,7,100,0.4)' },
  mr:    { from: '#7c2d12', to: '#9a3412', glow: 'rgba(124,45,18,0.4)' },
  te:    { from: '#14532d', to: '#166534', glow: 'rgba(20,83,45,0.4)' },
  ta:    { from: '#7f1d1d', to: '#991b1b', glow: 'rgba(127,29,29,0.4)' },
  kn:    { from: '#1e3a5f', to: '#1e40af', glow: 'rgba(30,58,95,0.4)' },
  gu:    { from: '#713f12', to: '#854d0e', glow: 'rgba(113,63,18,0.4)' },
};

// ── Single tile ────────────────────────────────────────────────────────────
function LanguageTile({
  loc,
  index,
  isActive,
  onSwitch,
  inView,
}: {
  loc: (typeof LOCALES)[number];
  index: number;
  isActive: boolean;
  onSwitch: (code: LocaleCode) => void;
  inView: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const accent = TILE_ACCENTS[loc.code] ?? TILE_ACCENTS['hi'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.07, ease: 'easeOut' }}
      style={{ perspective: '800px' }}
    >
      {/* Flip container */}
      <motion.div
        onHoverStart={() => setFlipped(true)}
        onHoverEnd={() => setFlipped(false)}
        onTap={() => setFlipped((f) => !f)}
        style={{
          position: 'relative',
          width: '100%',
          height: '200px',
          transformStyle: 'preserve-3d',
          cursor: 'pointer',
        }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* ── FRONT ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: '20px',
            background: `linear-gradient(145deg, ${accent.from} 0%, ${accent.to} 100%)`,
            border: isActive ? '2px solid #fa5d00' : '2px solid rgba(255,255,255,0.08)',
            boxShadow: isActive
              ? `0 0 0 4px rgba(250,93,0,0.2), 0 8px 32px ${accent.glow}`
              : `0 4px 20px ${accent.glow}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '20px',
            overflow: 'hidden',
          }}
        >
          {/* Active badge */}
          {isActive && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: '#fa5d00',
                borderRadius: '999px',
                padding: '3px 8px',
                fontSize: '10px',
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '0.05em',
              }}
            >
              ACTIVE
            </div>
          )}

          {/* Watermark blob */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: '-24px',
              bottom: '-24px',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              pointerEvents: 'none',
            }}
          />

          {/* Script name — large */}
          <div
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 'clamp(44px, 5vw, 56px)',
              color: '#fff',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {loc.nativeName}
          </div>

          {/* Bottom row: English name + sample pill */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {loc.englishName}
            </span>
            <div
              style={{
                background: 'rgba(255,255,255,0.14)',
                borderRadius: '999px',
                padding: '5px 12px',
                width: 'fit-content',
                maxWidth: '100%',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.9)',
                  fontWeight: 500,
                  lineHeight: 1.3,
                  display: 'block',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  maxWidth: '160px',
                }}
              >
                {loc.samplePhrase1}
              </span>
            </div>
          </div>
        </div>

        {/* ── BACK ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: '20px',
            background: '#fff8f1',
            border: '2px solid rgba(0,64,56,0.12)',
            boxShadow: `0 4px 20px ${accent.glow}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '20px',
          }}
        >
          {/* Second sample phrase */}
          <div>
            <div
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: '15px',
                color: accent.from,
                lineHeight: 1.4,
                marginBottom: '8px',
              }}
            >
              &ldquo;{loc.samplePhrase2}&rdquo;
            </div>
            {/* User count badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(0,64,56,0.08)',
                border: '1px solid rgba(0,64,56,0.12)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#16a34a',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#004038' }}>
                {formatUserCount(loc.activeUsers)}
              </span>
              <span style={{ fontSize: '11px', color: '#615f5c' }}>active users</span>
            </div>
          </div>

          {/* Switch CTA */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSwitch(loc.code as LocaleCode);
            }}
            style={{
              padding: '9px 16px',
              borderRadius: '12px',
              border: 'none',
              background: accent.from,
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%',
              fontFamily: 'inherit',
              transition: 'opacity 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.88')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
          >
            {loc.scriptChar}
            <span>{loc.nativeName} →</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main section ───────────────────────────────────────────────────────────
export default function LanguageShowcase() {
  const { locale, setLocale } = useLocale();
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });

  return (
    <section
      ref={ref}
      style={{
        background: 'var(--color-cream-canvas)',
        padding: '96px 0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative background blob */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(250,93,0,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: '-80px',
          left: '-80px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,64,56,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 32px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          style={{ textAlign: 'center', marginBottom: '60px' }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: '999px',
              background: 'rgba(250,93,0,0.1)',
              border: '1px solid rgba(250,93,0,0.2)',
              marginBottom: '20px',
            }}
          >
            <span style={{ fontSize: '14px' }}>🌏</span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#fa5d00',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              8 Languages · One Saathi
            </span>
          </div>

          <h2
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 'clamp(32px, 4vw, 48px)',
              color: '#0f161e',
              lineHeight: 1.2,
              marginBottom: '16px',
            }}
          >
            Your language is our language
          </h2>
          <p
            style={{
              fontSize: '17px',
              color: '#615f5c',
              maxWidth: '520px',
              margin: '0 auto',
              lineHeight: 1.65,
            }}
          >
            SaathiAI speaks to every graduate in the language they grew up in — not the language
            the government uses. Hover a tile to explore.
          </p>
        </motion.div>

        {/* 4-column grid (2-col on mobile) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
          }}
          className="lang-showcase-grid"
        >
          {LOCALES.map((loc, i) => (
            <LanguageTile
              key={loc.code}
              loc={loc}
              index={i}
              isActive={locale === loc.code}
              onSwitch={setLocale}
              inView={inView}
            />
          ))}
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8 }}
          style={{
            textAlign: 'center',
            marginTop: '40px',
            fontSize: '13px',
            color: '#615f5c',
          }}
        >
          More languages coming soon — Odia, Punjabi, Assamese, and Bhojpuri.
        </motion.p>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .lang-showcase-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .lang-showcase-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .lang-showcase-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }
        }
      `}</style>
    </section>
  );
}
