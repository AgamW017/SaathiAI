'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
} from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LocaleCode,
  getLocaleData,
  isLocaleCode,
} from './i18n';

// ── Types ──────────────────────────────────────────────────────────────────
type Messages = Record<string, Record<string, string>>;

interface LocaleCtx {
  locale: LocaleCode;
  messages: Messages;
  t: (ns: string, key: string, fallback?: string) => string;
  setLocale: (code: LocaleCode) => void;
  toast: string | null;
}

// ── Context ────────────────────────────────────────────────────────────────
const LocaleContext = createContext<LocaleCtx>({
  locale: DEFAULT_LOCALE,
  messages: {},
  t: (_, key) => key,
  setLocale: () => {},
  toast: null,
});

// ── Loader ─────────────────────────────────────────────────────────────────
async function loadMessages(code: LocaleCode): Promise<Messages> {
  try {
    const mod = await import(`../../messages/${code}.json`);
    return mod.default as Messages;
  } catch {
    // Fallback to Hindi
    const mod = await import('../../messages/hi.json');
    return mod.default as Messages;
  }
}

function readLocaleCookie(): LocaleCode {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const saved = match ? decodeURIComponent(match[1]) : DEFAULT_LOCALE;
  return isLocaleCode(saved) ? saved : DEFAULT_LOCALE;
}

function writeLocaleCookie(code: LocaleCode) {
  const maxAge = 365 * 24 * 60 * 60;
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(code)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

// ── Provider ───────────────────────────────────────────────────────────────
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<Messages>({});
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Initialise from cookie on first mount
  useEffect(() => {
    const saved = readLocaleCookie();
    loadMessages(saved).then((msgs) => {
      setLocaleState(saved);
      setMessages(msgs);
    });
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (code: LocaleCode) => {
      writeLocaleCookie(code);
      startTransition(() => {
        loadMessages(code).then((msgs) => {
          setLocaleState(code);
          setMessages(msgs);
          // Show 1-second toast in the NEW language
          const localeData = getLocaleData(code);
          setToast(localeData.switchConfirm);
          setTimeout(() => setToast(null), 2000);
        });
      });
    },
    [],
  );

  const t = useCallback(
    (ns: string, key: string, fallback?: string) => {
      return messages[ns]?.[key] ?? fallback ?? key;
    },
    [messages],
  );

  return (
    <LocaleContext.Provider value={{ locale, messages, t, setLocale, toast }}>
      {children}
      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#004038',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '999px',
            fontSize: '14px',
            fontWeight: 600,
            zIndex: 9999,
            boxShadow: '0 4px 20px rgba(0,64,56,0.35)',
            whiteSpace: 'nowrap',
            animation: 'saathi-toast-in 0.25s ease',
          }}
        >
          {toast}
        </div>
      )}
      <style>{`
        @keyframes saathi-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </LocaleContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useLocale() {
  return useContext(LocaleContext);
}
