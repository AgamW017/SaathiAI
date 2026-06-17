/**
 * Auth store — persists access_token + refresh_token to localStorage.
 * Framework-agnostic (no Zustand dep needed — just plain module state + events).
 *
 * Usage:
 *   import { authStore } from '@/lib/auth/authStore';
 *
 *   // After successful login:
 *   authStore.setAuth(result);
 *
 *   // Read current user:
 *   const user = authStore.getUser();
 *
 *   // Check if logged in:
 *   if (authStore.isLoggedIn()) { ... }
 *
 *   // Sign out:
 *   authStore.clearAuth();
 */

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: 'learner' | 'employer' | 'officer' | 'dssdo' | 'admin' | 'trainee';
  full_name: string | null;
}

export interface AuthResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AuthUser;
}

const ACCESS_TOKEN_KEY = 'saathi_access_token';
const REFRESH_TOKEN_KEY = 'saathi_refresh_token';
const USER_KEY = 'saathi_user';

function safeLocalStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

/** Role → dashboard path mapping */
const ROLE_DASHBOARD: Record<string, string> = {
  learner: '/dashboard/learner',
  employer: '/dashboard/employer',
  officer: '/dashboard/officer',
  dssdo: '/dashboard/officer',
  admin: '/dashboard/officer',
  trainee: '/dashboard/learner',
};

export const authStore = {
  setAuth(result: AuthResult) {
    const ls = safeLocalStorage();
    if (!ls) return;
    ls.setItem(ACCESS_TOKEN_KEY, result.access_token);
    ls.setItem(REFRESH_TOKEN_KEY, result.refresh_token);
    ls.setItem(USER_KEY, JSON.stringify(result.user));
    // Dispatch a custom event so React components can react to auth changes
    window.dispatchEvent(new CustomEvent('saathi:auth:change', { detail: result.user }));
  },

  clearAuth() {
    const ls = safeLocalStorage();
    if (!ls) return;
    ls.removeItem(ACCESS_TOKEN_KEY);
    ls.removeItem(REFRESH_TOKEN_KEY);
    ls.removeItem(USER_KEY);
    window.dispatchEvent(new CustomEvent('saathi:auth:change', { detail: null }));
  },

  getAccessToken(): string | null {
    return safeLocalStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
  },

  getRefreshToken(): string | null {
    return safeLocalStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
  },

  getUser(): AuthUser | null {
    const raw = safeLocalStorage()?.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  },

  /** Returns the dashboard URL for the current user's role */
  getDashboardPath(): string {
    const user = this.getUser();
    if (!user) return '/login';
    return ROLE_DASHBOARD[user.role] ?? '/';
  },
};

/**
 * React hook that returns the current auth user and re-renders on auth changes.
 * Safe to use in client components.
 *
 * Initializes as `null` to avoid hydration mismatch (server has no localStorage).
 * The real auth state is read in a useEffect after mount.
 */
import { useEffect, useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Sync from localStorage after mount to avoid SSR/client mismatch
    setUser(authStore.getUser());
    setHydrated(true);

    function handleChange(e: Event) {
      setUser((e as CustomEvent<AuthUser | null>).detail);
    }
    window.addEventListener('saathi:auth:change', handleChange);
    return () => window.removeEventListener('saathi:auth:change', handleChange);
  }, []);

  return {
    user,
    isLoggedIn: !!user,
    hydrated,
    dashboardPath: authStore.getDashboardPath(),
    clearAuth: authStore.clearAuth.bind(authStore),
  };
}
