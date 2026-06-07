import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Button from './ui/Button.jsx';

const navLinks = ['Products', 'Solutions', 'Impact', 'How It Works'];

function SaathiLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="13" fill="var(--color-saathi-teal)" />
      {/* Two hands meeting */}
      <path d="M8 16 C8 13 10 11 12 12 L14 13 L16 12 C18 11 20 13 20 16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M11 14 L14 17 L17 14" stroke="#fee3b5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="14" cy="9" r="2" fill="#fee3b5" />
    </svg>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: 68,
        background: scrolled ? 'rgba(255,248,241,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(8px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--color-mist)' : '1px solid transparent',
        transition: 'background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease',
      }}
    >
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 32px',
        height: '100%', display: 'flex', alignItems: 'center',
      }}>
        {/* Logo */}
        <motion.div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <SaathiLogo />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: 'var(--color-saathi-teal)',
            letterSpacing: '-0.01em',
          }}>
            SaathiAI
          </span>
        </motion.div>

        {/* Nav links — desktop */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '36px',
          flex: 1, justifyContent: 'center',
        }} className="nav-links-desktop">
          {navLinks.map((link, i) => (
            <NavLink key={link} label={link} delay={0.1 + i * 0.04} />
          ))}
        </div>

        {/* Right CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <motion.a
            href="#"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{
              fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15,
              color: 'var(--color-warm-stone)', textDecoration: 'none',
            }}
          >
            Sign in
          </motion.a>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <Button variant="flame" style={{ padding: '10px 20px', fontSize: '14px' }}>
              Try SaathiAI Free →
            </Button>
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .nav-links-desktop { display: none !important; }
        }
      `}</style>
    </motion.nav>
  );
}

function NavLink({ label, delay }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.a
      href="#"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15,
        color: 'var(--color-ink-black)', textDecoration: 'none',
        position: 'relative', paddingBottom: '2px',
      }}
    >
      {label}
      <motion.span
        animate={{ width: hovered ? '100%' : 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'absolute', bottom: 0, left: 0,
          height: '2px', background: 'var(--color-saathi-teal)',
          display: 'block', borderRadius: '1px',
        }}
      />
    </motion.a>
  );
}
