'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, Briefcase, GraduationCap, LogOut, Bell } from 'lucide-react';
import { useAuth } from '@/src/lib/auth/authStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard/officer', icon: LayoutDashboard },
  { label: 'Learners', href: '/dashboard/officer/learners', icon: Users },
  { label: 'Employers', href: '/dashboard/officer/employers', icon: Briefcase },
  { label: 'Placements', href: '/dashboard/officer/placements', icon: GraduationCap },
];

export default function OfficerDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoggedIn, clearAuth } = useAuth();

  const [isMounted, setIsMounted] = React.useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Basic auth guard
  useEffect(() => {
    if (isMounted && !isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, router, isMounted]);

  if (!isMounted || !isLoggedIn) return null;

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-64 h-full bg-[#004038] text-white flex flex-col relative z-20 shadow-2xl"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#fa5d00] flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full" />
          </div>
          <span className="text-xl font-bold tracking-tight font-serif">SaathiAI</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-[#fa5d00]' : ''}`} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute left-0 w-1 h-8 bg-[#fa5d00] rounded-r-full"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 backdrop-blur-md mb-4">
            <Avatar className="w-10 h-10 border border-white/20">
              <AvatarFallback className="bg-[#00544c] text-white">
                {user?.full_name?.charAt(0) || 'O'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white truncate w-32">{user?.full_name || 'Officer'}</span>
              <span className="text-xs text-white/60 capitalize">{user?.role}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-white/70 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign out</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative z-10 min-w-0">
        {/* Top Header */}
        <header className="h-20 px-8 flex items-center justify-between bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-800">
              {NAV_ITEMS.find((item) => item.href === pathname)?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <button className="relative p-2 text-gray-500 hover:text-gray-800 transition-colors rounded-full hover:bg-gray-100">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-2 w-2 h-2 bg-[#fa5d00] rounded-full" />
            </button>
            <div className="h-8 w-[1px] bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">ITI Placement Cell</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9]">
          <div className="p-8 max-w-7xl mx-auto">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
