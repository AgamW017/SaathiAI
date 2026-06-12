'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LOCALES, LocaleCode } from '../../lib/i18n';
import { useLocale } from '../../lib/locale-context';

interface Props {
  /** compact = trigger shows script-char + native name only (Navbar)
   *  full    = trigger is slightly wider, shows English name too (Login) */
  variant?: 'compact' | 'full';
  /** Which direction the dropdown opens */
  placement?: 'down' | 'up';
}

export default function LanguageSwitcher({
  variant = 'compact',
  placement = 'down',
}: Props) {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleSelect = (code: LocaleCode) => {
    setLocale(code);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* ── Trigger ── */}
      <button
        id="lang-switcher-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: variant === 'compact' ? '6px 12px' : '7px 14px',
          borderRadius: '999px',
          border: '1.5px solid rgba(0,64,56,0.18)',
          background: open ? 'rgba(0,64,56,0.07)' : 'rgba(255,255,255,0.6)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.18s ease',
          backdropFilter: 'blur(8px)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(0,64,56,0.07)';
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.6)';
          }
        }}
      >
        {/* Script character */}
        <span
          aria-hidden="true"
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#004038',
            lineHeight: 1,
            minWidth: '16px',
            textAlign: 'center',
          }}
        >
          {current.scriptChar}
        </span>
        {/* Native name */}
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#004038',
            whiteSpace: 'nowrap',
          }}
        >
          {current.nativeName}
        </span>
        {/* Chevron */}
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#004038"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>

      {/* ── Dropdown ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label="Select language"
            initial={{ opacity: 0, y: placement === 'down' ? -8 : 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === 'down' ? -8 : 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
              position: 'absolute',
              ...(placement === 'down'
                ? { top: 'calc(100% + 8px)' }
                : { bottom: 'calc(100% + 8px)' }),
              right: 0,
              minWidth: '220px',
              background: 'rgba(255,252,248,0.97)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(0,64,56,0.12)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px -4px rgba(0,64,56,0.16), 0 2px 8px rgba(0,0,0,0.06)',
              padding: '6px',
              zIndex: 200,
              overflowY: 'auto',
              maxHeight: '340px',
            }}
          >
            {LOCALES.map((loc) => {
              const isActive = loc.code === locale;
              return (
                <LocaleOption
                  key={loc.code}
                  loc={loc}
                  isActive={isActive}
                  onSelect={handleSelect}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LocaleOption({
  loc,
  isActive,
  onSelect,
}: {
  loc: (typeof LOCALES)[number];
  isActive: boolean;
  onSelect: (code: LocaleCode) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      role="option"
      aria-selected={isActive}
      onClick={() => onSelect(loc.code as LocaleCode)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '9px 12px',
        borderRadius: '10px',
        border: 'none',
        background: isActive
          ? 'rgba(0,64,56,0.09)'
          : hovered
          ? 'rgba(0,64,56,0.05)'
          : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'background 0.12s ease',
      }}
    >
      {/* Script char */}
      <span
        aria-hidden="true"
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color: isActive ? '#004038' : '#333942',
          minWidth: '24px',
          textAlign: 'center',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {loc.scriptChar}
      </span>

      {/* Names */}
      <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1 }}>
        <span
          style={{
            fontSize: '14px',
            fontWeight: isActive ? 700 : 500,
            color: isActive ? '#004038' : '#0f161e',
            lineHeight: 1.2,
          }}
        >
          {loc.nativeName}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: '#615f5c',
            lineHeight: 1,
          }}
        >
          {loc.englishName}
        </span>
      </span>

      {/* Active checkmark */}
      {isActive && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#004038"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}
