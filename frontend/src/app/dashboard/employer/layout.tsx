'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { authStore, useAuth } from '../../../lib/auth/authStore';
import { LayoutDashboard, Briefcase, GitMerge, FileCheck, BarChart3, LogOut } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard/employer', label: 'Overview', icon: <LayoutDashboard size={18} />, exact: true },
  { href: '/dashboard/employer/vacancies', label: 'Vacancies', icon: <Briefcase size={18} /> },
  { href: '/dashboard/employer/pipeline', label: 'Pipeline', icon: <GitMerge size={18} /> },
  { href: '/dashboard/employer/naps', label: 'NAPS', icon: <FileCheck size={18} /> },
  { href: '/dashboard/employer/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <Link href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: isActive ? 600 : 400, color: isActive ? '#fa5d00' : '#615f5c', background: isActive ? 'rgba(250,93,0,0.08)' : 'transparent', textDecoration: 'none', transition: 'all 0.15s ease', position: 'relative' }}>
      {isActive && <motion.div layoutId="nav-active-emp" style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(250,93,0,0.08)' }} transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
      <span style={{ position: 'relative', zIndex: 1, opacity: isActive ? 1 : 0.65 }}>{item.icon}</span>
      <span style={{ position: 'relative', zIndex: 1 }}>{item.label}</span>
    </Link>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const { user, clearAuth } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleSignout = () => { clearAuth(); router.push('/signin'); };

  return (
    <aside style={{ width: 240, minHeight: '100vh', background: '#fff', borderRight: '1px solid rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', padding: '24px 16px', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, paddingLeft: 4 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fa5d00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 36 36" fill="none"><path d="M9 27c0-5 4-8.5 9-8.5s9 3.5 9 8.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /><circle cx="18" cy="13" r="5" fill="#fff" /></svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f161e', lineHeight: 1.1 }}>SaathiAI</div>
          <div style={{ fontSize: 11, color: '#615f5c', fontWeight: 500 }}>Employer Portal</div>
        </div>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {NAV_ITEMS.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
      </nav>
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 16, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#fa5d00,#e85600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {mounted ? (user?.full_name?.charAt(0).toUpperCase() ?? 'E') : 'E'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f161e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mounted ? (user?.full_name ?? 'Employer') : 'Employer'}</div>
            <div style={{ fontSize: 11, color: '#615f5c', textTransform: 'capitalize' }}>{mounted ? user?.role : 'employer'}</div>
          </div>
        </div>
        <button onClick={handleSignout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.2)', background: 'transparent', color: '#dc2626', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}

export default function EmployerDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!authStore.isLoggedIn()) {
      router.replace('/signin');
      return;
    }
    const user = authStore.getUser();
    if (user && user.role !== 'employer') {
      router.replace('/signin');
    }
  }, [router]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fff8f1', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar pathname={pathname} />
      <main style={{ flex: 1, marginLeft: 240, minHeight: '100vh', overflowX: 'hidden' }}>
        {children}
      </main>
    </div>
  );
}
