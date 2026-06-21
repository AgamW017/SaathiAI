import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { supabase as _supabase, supabaseAdmin } from '../db/client.js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../config/logger.js';
const supabase = _supabase as any;
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

  const authClient = createClient(config.supabase.url, config.supabase.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  if (email) {
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }
    supabaseUserId = data.user.id;
  } else if (phone) {
    // Supabase phone+password requires phone to be in E.164 format
    const { data, error } = await authClient.auth.signInWithPassword({ phone, password });
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
  const authClient = createClient(config.supabase.url, config.supabase.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });
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
  const authClient = createClient(config.supabase.url, config.supabase.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await authClient.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    throw Object.assign(new Error('OAuth failed'), { status: 401 });
  }
  return issueTokensForUser(data.user.id, data.user.email ?? null, null);
}

// ─── Signup ──────────────────────────────────────────────────────────────────

type SignupPayload =
  | { role: 'learner'; phone: string; password: string; full_name: string }
  | {
      role: 'employer';
      email?: string;
      phone?: string;
      password: string;
      company_name: string;
      contact_name: string;
      udyam?: string;
      verification_type?: 'none' | 'aadhaar' | 'entitylocker';
      aadhaar_kyc?: {
        aadhaarNumber: string;
        name: string;
        dob: string;
        gender: string;
        address: { line: string | null; district: string | null; state: string | null; pincode: string | null };
        photoUrl?: string;
      };
      entity_data?: {
        id: string;
        name: string;
        email: string;
        mobile: string;
        dateOfIncorporation: string;
        verifiedBy: 'pan' | 'ud' | 'cin';
      };
    }
  | {
      role: 'officer';
      email: string;
      password: string;
      full_name: string;
      iti_name?: string;
      district?: string;
    }
  | {
      role: 'dssdo';
      email: string;
      password: string;
      full_name: string;
      district?: string;
    }
  | { role: 'admin'; email: string; password: string; full_name: string };

/**
 * Create a new Supabase Auth user and insert the corresponding row in public.users.
 * For employers, also stores company metadata.
 */
export async function signupUser(payload: SignupPayload): Promise<LoginResult> {
  const { role, password } = payload;

  // 1. Create the Supabase Auth user
  const email = 'email' in payload ? payload.email : undefined;
  const phone = 'phone' in payload ? payload.phone : undefined;

  if (role === 'employer' && !email && !phone) {
    throw Object.assign(new Error('Email or phone number is required for employer signup'), { status: 400 });
  }
  const full_name =
    'full_name' in payload
      ? payload.full_name
      : 'contact_name' in payload
        ? payload.contact_name
        : null;

  const { data: authData, error: authError } = await supabaseAdmin.createUser({
    email,
    phone,
    password,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { role, full_name },
  });

  if (authError || !authData.user) {
    // Surface readable Supabase errors (e.g. "User already registered")
    throw Object.assign(
      new Error(authError?.message ?? 'Failed to create user'),
      { status: 400 }
    );
  }

  const userId = authData.user.id;
  const district = 'district' in payload ? payload.district : null;

  // 2. Insert into public.users
  const { error: userError } = await supabase.from('users').insert({
    id: userId,
    email: email ?? null,
    phone: phone ?? null,
    role: role as UserRole,
    full_name: full_name ?? null,
    district: district ?? null,
    is_active: true,
  });

  if (userError) {
    // Rollback auth user if DB insert fails
    await supabaseAdmin.deleteUser(userId);
    throw Object.assign(new Error('Failed to create user profile: ' + userError.message), {
      status: 500,
    });
  }

  // 3. For employer: create row in employers table + store metadata
  if (role === 'employer') {
    const emp = payload as Extract<SignupPayload, { role: 'employer' }>;
    const verType = emp.verification_type ?? 'none';

    const verificationStatus =
      verType === 'aadhaar' ? 'aadhaar_verified' :
      verType === 'entitylocker' ? 'entitylocker_verified' :
      'phone_verified';

    // Derive company_name from entity data if available
    const companyName =
      verType === 'entitylocker' && emp.entity_data
        ? emp.entity_data.name
        : emp.company_name;

    const employerRow: Record<string, any> = {
      id: userId,
      company_name: companyName,
      contact_name: emp.contact_name,
      udyam_number: emp.udyam ?? null,
      verification_status: verificationStatus,
      verification_type: verType,
    };

    if (verType === 'aadhaar' && emp.aadhaar_kyc) {
      employerRow.aadhaar_name = emp.aadhaar_kyc.name;
      employerRow.aadhaar_dob = emp.aadhaar_kyc.dob;
      employerRow.aadhaar_gender = emp.aadhaar_kyc.gender;
      employerRow.aadhaar_address = emp.aadhaar_kyc.address;
      employerRow.aadhaar_photo_url = emp.aadhaar_kyc.photoUrl ?? null;
    }

    if (verType === 'entitylocker' && emp.entity_data) {
      employerRow.entity_id = emp.entity_data.id;
      employerRow.entity_date_of_incorp = emp.entity_data.dateOfIncorporation;
      employerRow.entity_verified_by = emp.entity_data.verifiedBy;
    }

    const { error: empError } = await supabase
      .from('employers')
      .upsert(employerRow, { onConflict: 'id' });

    if (empError) {
      logger.error({ error: empError, userId }, 'Failed to create employer profile row');
    }

    await supabaseAdmin.updateUserById(userId, {
      user_metadata: {
        role,
        company_name: companyName,
        contact_name: emp.contact_name,
        udyam: emp.udyam ?? null,
        verification_type: verType,
      },
    });
  }

  // 4. Issue JWT pair
  return issueTokensForUser(userId, email ?? null, phone ?? null);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

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
