"use client";
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Button from './ui/Button';
import { AnimatedGradient } from './ui/animated-gradient';
import LanguageSwitcher from './ui/LanguageSwitcher';
import { useLocale } from '../lib/locale-context';
import { useAuth } from '../lib/auth/authStore';

// Modern custom Framer Motion component for Next.js links
const MotionLink = motion.create(Link);

function SaathiLogo() {
  return (
    <motion.svg
      whileHover={{ rotate: 180, scale: 1.1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 10 }}
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="14" cy="14" r="13" fill="var(--color-saathi-teal)" />
      {/* Two hands meeting */}
      <path
        d="M8 16 C8 13 10 11 12 12 L14 13 L16 12 C18 11 20 13 20 16"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M11 14 L14 17 L17 14"
        stroke="#fee3b5"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="14" cy="9" r="2" fill="#fee3b5" />
    </motion.svg>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useLocale();
  const { isLoggedIn, user, dashboardPath, hydrated } = useAuth();

  const navLinks = [
    { name: t('nav', 'impact'), path: '#impact' },
    { name: t('nav', 'howItWorks'), path: '#how-it-works' },
  ];

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .nav-links-desktop { display: none !important; }
          .nav-actions-desktop { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>

      <div
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            padding: scrolled ? '10px 16px' : '18px 16px',
            width: '100%',
            maxWidth: '1200px',
            transition: 'padding 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <motion.nav
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'relative',
              width: '100%',
              height: 64,
              borderRadius: scrolled ? '999px' : '20px',
              border: scrolled
                ? '1px solid rgba(255, 255, 255, 0.45)'
                : '1px solid rgba(255, 255, 255, 0.35)',
              boxShadow: scrolled
                ? '0 8px 32px -8px rgba(0, 64, 56, 0.14), 0 2px 8px rgba(0,0,0,0.06), inset 0 2px 0 rgba(255,255,255,0.85), inset 0 -2px 0 rgba(0,0,0,0.08), inset 1px 0 0 rgba(255,255,255,0.4), inset -1px 0 0 rgba(0,0,0,0.04)'
                : '0 4px 24px -6px rgba(0, 64, 56, 0.10), 0 1px 4px rgba(0,0,0,0.04), inset 0 2px 0 rgba(255,255,255,0.75), inset 0 -2px 0 rgba(0,0,0,0.06), inset 1px 0 0 rgba(255,255,255,0.35), inset -1px 0 0 rgba(0,0,0,0.03)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              pointerEvents: 'auto',
              /* Base fill so the AnimatedGradient has something opaque to sit on */
              background: scrolled
                ? 'rgba(255, 248, 241, 0.45)'
                : 'rgba(255, 248, 241, 0.25)',
            }}
          >
            {/* Animated Gradient background — Ghost preset, very subtle */}
            <AnimatedGradient
              config={{ preset: 'Ghost' }}
              noise={{ opacity: 0.015 }}
              radius="inherit"
              style={{
                opacity: scrolled ? 0.7 : 0.4,
                transition: 'opacity 0.35s ease',
              }}
            />

            {/* Content Wrapper */}
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: scrolled ? '0 32px' : '0 24px',
                transition: 'padding 0.35s ease',
              }}
            >
              {/* Logo */}
              <MotionLink
                href="/"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexShrink: 0,
                  textDecoration: 'none',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                whileHover={{ x: 3 }}
              >
                <SaathiLogo />
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--color-saathi-teal)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  SaathiAI
                </span>
              </MotionLink>

              {/* Nav links — desktop */}
              <div
                className="nav-links-desktop"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '28px',
                  flex: 1,
                  justifyContent: 'center',
                }}
              >
                {navLinks.map((link, i) => (
                  <NavLink
                    key={link.name}
                    label={link.name}
                    href={link.path}
                    delay={0.1 + i * 0.05}
                  />
                ))}
              </div>

              {/* Right CTA — desktop */}
              <div
                className="nav-actions-desktop"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexShrink: 0,
                }}
              >
                <LanguageSwitcher variant="compact" placement="down" />
                {hydrated && isLoggedIn ? (
                  <MotionLink
                    href={dashboardPath}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      fontSize: 14,
                      color: 'var(--color-saathi-teal)',
                      textDecoration: 'none',
                      padding: '8px 16px',
                      borderRadius: '999px',
                      background: 'rgba(0, 64, 56, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s',
                    }}
                    whileHover={{
                      backgroundColor: 'rgba(0, 64, 56, 0.12)',
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg,#004038,#006b5a)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#fff',
                      }}
                    >
                      {user?.full_name?.charAt(0).toUpperCase() ?? 'O'}
                    </div>
                    Dashboard
                  </MotionLink>
                ) : (
                  <MotionLink
                    href="/signin"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      fontSize: 14,
                      color: 'var(--color-saathi-teal)',
                      textDecoration: 'none',
                      padding: '8px 12px',
                      borderRadius: '999px',
                      transition: 'color 0.2s, background 0.2s',
                    }}
                    whileHover={{
                      color: 'var(--color-action-flame)',
                      backgroundColor: 'rgba(250,93,0,0.06)',
                    }}
                  >
                    {t('nav', 'signIn')}
                  </MotionLink>
                )}

                {hydrated && (
                  <>
                    <div
                      style={{
                        width: '1px',
                        height: '24px',
                        background: 'rgba(0,64,56,0.1)',
                        margin: '0 4px',
                      }}
                    />
                    <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <Button
                      variant="flame"
                      href="http://wa.me/9068666560"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '8px 18px',
                        fontSize: '13px',
                        borderRadius: '999px',
                        boxShadow: 'var(--shadow-card-warm)',
                        background: 'var(--color-action-flame)',
                        color: 'white',
                        textDecoration: 'none',
                      }}
                    >
                      {t('nav', 'tryFree')}
                    </Button>
                    </motion.div>
                  </>
                )}
              </div>

              {/* Mobile hamburger */}
              <motion.button
                className="mobile-menu-btn"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'none',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  borderRadius: '10px',
                  color: 'var(--color-saathi-teal)',
                }}
                whileHover={{ backgroundColor: 'rgba(0,64,56,0.07)' }}
                whileTap={{ scale: 0.92 }}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {mobileMenuOpen ? (
                    <>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </>
                  ) : (
                    <>
                      <line x1="3" y1="8" x2="21" y2="8" />
                      <line x1="3" y1="16" x2="21" y2="16" />
                    </>
                  )}
                </svg>
              </motion.button>
            </div>
          </motion.nav>

          {/* ── Mobile dropdown ── */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{
                  overflow: 'hidden',
                  pointerEvents: 'auto',
                }}
              >
                <div
                  style={{
                    background: 'rgba(255, 248, 241, 0.97)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderRadius: '16px',
                    marginTop: '8px',
                    padding: '20px',
                    border: '1px solid rgba(0, 64, 56, 0.10)',
                    boxShadow: '0 8px 32px -8px rgba(0,64,56,0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {navLinks.map((link) => (
                    <Link
                      key={link.name}
                      href={link.path}
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 15,
                        color: 'var(--color-ink-black)',
                        textDecoration: 'none',
                        padding: '12px 8px',
                        borderRadius: '10px',
                        display: 'block',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(0,64,56,0.05)';
                        e.currentTarget.style.color = 'var(--color-saathi-teal)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--color-ink-black)';
                      }}
                    >
                      {link.name}
                    </Link>
                  ))}

                  <div
                    style={{
                      height: '1px',
                      background: 'rgba(0,64,56,0.08)',
                      margin: '8px 0',
                    }}
                  />

                  {/* Language switcher in mobile menu */}
                  <div style={{ padding: '4px 0 8px' }}>
                    <LanguageSwitcher variant="full" placement="up" />
                  </div>

                  {hydrated && isLoggedIn ? (
                    <Link
                      href={dashboardPath}
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 600,
                        fontSize: 15,
                        color: 'var(--color-saathi-teal)',
                        textDecoration: 'none',
                        padding: '12px 16px',
                        borderRadius: '999px',
                        background: 'rgba(0, 64, 56, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginTop: '8px',
                      }}
                    >
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg,#004038,#006b5a)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#fff',
                        }}
                      >
                        {user?.full_name?.charAt(0).toUpperCase() ?? 'O'}
                      </div>
                      Go to Dashboard
                    </Link>
                  ) : (
                    <Link
                      href="/signin"
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 15,
                        color: 'var(--color-saathi-teal)',
                        textDecoration: 'none',
                        padding: '12px 8px',
                        borderRadius: '999px',
                        display: 'block',
                      }}
                    >
                      {t('nav', 'signIn')}
                    </Link>
                  )}

                  {hydrated && (
                    <>
                      <div
                        style={{
                          height: '1px',
                          background: 'rgba(0,64,56,0.08)',
                          margin: '8px 0',
                        }}
                      />
                      <Button
                      variant="flame"
                      href="http://wa.me/9068666560"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        padding: '12px',
                        fontSize: '15px',
                        borderRadius: '999px',
                        width: '100%',
                        justifyContent: 'center',
                        background: 'var(--color-action-flame)',
                        color: 'white',
                        marginTop: '8px',
                        textDecoration: 'none',
                      }}
                    >
                      {t('nav', 'tryFree')}
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

function NavLink({ label, href, delay }: { label: string; href: string; delay: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <MotionLink
      href={href}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize: 14,
        color: 'var(--color-graphite)',
        textDecoration: 'none',
        position: 'relative',
        paddingBottom: '2px',
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }}
      whileHover={{ y: -1, color: 'var(--color-saathi-teal)' }}
    >
      {label}
      <motion.span
        animate={{ width: hovered ? '100%' : 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '2px',
          background: 'var(--color-action-flame)',
          display: 'block',
          borderRadius: '1px',
        }}
      />
    </MotionLink>
  );
}