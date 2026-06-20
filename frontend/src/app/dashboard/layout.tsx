'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { authStore, useAuth } from '../../lib/auth/authStore';

// ─── Nav Items ────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard/officer',
    label: 'Overview',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    exact: true,
  },
  {
    href: '/dashboard/officer/cohorts',
    label: 'Cohorts',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/dashboard/officer/employers',
    label: 'Employers',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/dashboard/officer/placements',
    label: 'Placements',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: '/dashboard/officer/onboard',
    label: 'Onboard Learner',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    ),
  },
];

// ─── Sidebar NavLink ──────────────────────────────────────────────────────────

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? '#004038' : '#615f5c',
        background: isActive ? 'rgba(0,64,56,0.09)' : 'transparent',
        textDecoration: 'none',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
    >
      {isActive && (
        <motion.div
          layoutId="nav-active"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '10px',
            background: 'rgba(0,64,56,0.09)',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      <span style={{ position: 'relative', zIndex: 1, opacity: isActive ? 1 : 0.65 }}>
        {item.icon}
      </span>
      <span style={{ position: 'relative', zIndex: 1 }}>{item.label}</span>
    </Link>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ pathname }: { pathname: string }) {
  const { user, clearAuth } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignout = () => {
    clearAuth();
    router.push('/signin');
  };

  return (
    <aside
      style={{
        width: '240px',
        minHeight: '100vh',
        background: '#fff',
        borderRight: '1px solid rgba(0,0,0,0.07)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 50,
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', paddingLeft: '4px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: '#fa5d00',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
            <path d="M9 27c0-5 4-8.5 9-8.5s9 3.5 9 8.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="18" cy="13" r="5" fill="#fff" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f161e', lineHeight: 1.1 }}>SaathiAI</div>
          <div style={{ fontSize: '11px', color: '#615f5c', fontWeight: 500 }}>Officer Portal</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      {/* User footer */}
      <div
        style={{
          borderTop: '1px solid rgba(0,0,0,0.07)',
          paddingTop: '16px',
          marginTop: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#004038,#006b5a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {mounted ? (user?.full_name?.charAt(0).toUpperCase() ?? 'O') : 'O'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f161e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {mounted ? (user?.full_name ?? 'Officer') : 'Officer'}
            </div>
            <div style={{ fontSize: '11px', color: '#615f5c', textTransform: 'capitalize' }}>
              {mounted ? (user?.role ?? 'officer') : 'officer'}
            </div>
          </div>
        </div>
        <button
          onClick={handleSignout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(220,38,38,0.2)',
            background: 'transparent',
            color: '#dc2626',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Auth guard
  useEffect(() => {
    if (!authStore.isLoggedIn()) {
      router.replace('/signin');
    }
  }, [router]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f7f7f5' }}>
      <Sidebar pathname={pathname} />
      <main
        style={{
          flex: 1,
          marginLeft: '240px',
          minHeight: '100vh',
          overflowX: 'hidden',
        }}
      >
        {children}
      </main>
    </div>
  );
}
