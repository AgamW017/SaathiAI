import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { supabase, supabaseAdmin } from '../db/client.js';
import type { JwtPayload } from '../middleware/auth.js';
import type { UserRole, UserRow } from '../db/types.js';

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    role: UserRole;
    full_name: string | null;
  };
}

/**
 * Authenticate via email+password or phone+password using Supabase Auth.
 * Returns our own JWT (not Supabase's) so we control role + expiry.
 */
export async function loginWithEmailPassword(
  email: string | undefined,
  phone: string | undefined,
  password: string
): Promise<LoginResult> {
  // Supabase handles password verification
  let supabaseUserId: string;
  let resolvedEmail: string | undefined = email;

  if (email) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }
    supabaseUserId = data.user.id;
  } else if (phone) {
    // Supabase phone+password requires phone to be in E.164 format
    const { data, error } = await supabase.auth.signInWithPassword({ phone, password });
    if (error || !data.user) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }
    supabaseUserId = data.user.id;
    resolvedEmail = data.user.email ?? undefined;
  } else {
    throw Object.assign(new Error('Email or phone required'), { status: 400 });
  }

  return issueTokensForUser(supabaseUserId, resolvedEmail ?? null, phone ?? null);
}

/**
 * Issue new JWT pair from a valid Supabase refresh_token.
 */
export async function refreshSession(refreshToken: string): Promise<LoginResult> {
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.user) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
  }
  return issueTokensForUser(data.user.id, data.user.email ?? null, data.user.phone ?? null);
}

/**
 * Sign out — invalidates the Supabase session (best effort).
 */
export async function revokeSession(userId: string): Promise<void> {
  await supabaseAdmin.signOut(userId);
}

/**
 * Exchange a Google OAuth code for tokens.
 */
export async function loginWithGoogleCode(code: string): Promise<LoginResult> {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    throw Object.assign(new Error('OAuth failed'), { status: 401 });
  }
  return issueTokensForUser(data.user.id, data.user.email ?? null, null);
}

// ─── Internal helpers ─────────────────────────────────────────────────────

async function issueTokensForUser(
  userId: string,
  email: string | null,
  phone: string | null
): Promise<LoginResult> {
  // Fetch role & profile from our users table
  const { data: userRow, error } = await supabase
    .from('users')
    .select('role, full_name, district, is_active')
    .eq('id', userId)
    .single();

  const user = userRow as Pick<UserRow, 'role' | 'full_name' | 'district' | 'is_active'> | null;

  if (error || !user) {
    throw Object.assign(new Error('User profile not found. Contact an administrator.'), {
      status: 403,
    });
  }

  if (!user.is_active) {
    throw Object.assign(new Error('Account is disabled'), { status: 403 });
  }

  const payload: JwtPayload = {
    sub: userId,
    email,
    phone,
    role: user.role as UserRole,
    district: user.district,
  };

  const access_token = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });

  const refresh_token = jwt.sign(
    { sub: userId, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'] }
  );

  return {
    access_token,
    refresh_token,
    expires_in: 7 * 24 * 60 * 60, // 7 days in seconds
    user: {
      id: userId,
      email,
      phone,
      role: user.role as UserRole,
      full_name: user.full_name,
    },
  };
}

/**
 * Verifies a refresh token and issues a new access token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<LoginResult> {
  let payload: { sub: string; type: string };
  try {
    payload = jwt.verify(refreshToken, config.jwt.secret) as { sub: string; type: string };
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
  }

  if (payload.type !== 'refresh') {
    throw Object.assign(new Error('Invalid token type'), { status: 401 });
  }

  // Get user profile
  const { data: authUser } = await supabaseAdmin.getUserById(payload.sub);
  if (!authUser?.user) {
    throw Object.assign(new Error('User not found'), { status: 401 });
  }

  return issueTokensForUser(
    authUser.user.id,
    authUser.user.email ?? null,
    authUser.user.phone ?? null
  );
}
