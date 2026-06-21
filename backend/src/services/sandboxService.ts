/**
 * sandboxService.ts — Sandbox.co.in Aadhaar KYC API client
 *
 * Handles authentication (with in-memory token caching) and the two-step
 * OTP flow for Aadhaar KYC verification.
 *
 * Environment variables (all read from process.env at call-time):
 *   SANDBOX_API_KEY    — API key (required)
 *   SANDBOX_API_SECRET — API secret (required)
 *   SANDBOX_BASE_URL   — Base URL (default: https://test-api.sandbox.co.in)
 */

interface TokenCache {
  token: string;
  expiresAt: number; // epoch ms
}

export interface AadhaarOtpResult {
  referenceId: string;
  transactionId: string;
}

export interface AadhaarVerifyResult {
  aadhaarNumber: string;
  name: string;
  dob: string;       // YYYY-MM-DD
  gender: string;
  address: {
    line: string | null;
    district: string | null;
    state: string | null;
    pincode: string | null;
  };
  photo: string;     // base64-encoded JPEG
}

// Module-level token cache (shared across all calls within the same process)
let tokenCache: TokenCache | null = null;

function baseUrl(): string {
  return (process.env.SANDBOX_BASE_URL ?? 'https://test-api.sandbox.co.in').replace(/\/$/, '');
}

function apiKey(): string {
  const v = process.env.SANDBOX_API_KEY;
  if (!v) throw new Error('SANDBOX_API_KEY environment variable is not set');
  return v;
}

function apiSecret(): string {
  const v = process.env.SANDBOX_API_SECRET;
  if (!v) throw new Error('SANDBOX_API_SECRET environment variable is not set');
  return v;
}

/**
 * Authenticate with Sandbox and return an access token.
 * Token is cached for 23 h (Sandbox tokens are valid for 24 h; we refresh
 * 1 h early to avoid races).
 */
async function authenticate(): Promise<string> {
  const CACHE_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours
  const REFRESH_BUFFER_MS = 5 * 60 * 1000;   // refresh 5 min before expiry

  if (tokenCache && tokenCache.expiresAt - Date.now() > REFRESH_BUFFER_MS) {
    return tokenCache.token;
  }

  const res = await fetch(`${baseUrl()}/authenticate`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey(),
      'x-api-secret': apiSecret(),
      'x-api-version': '1.0',
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sandbox authentication failed (${res.status}): ${body}`);
  }

  const data = await res.json() as { data?: { access_token?: string } };
  const token = data?.data?.access_token;
  if (!token) {
    throw new Error('Sandbox authentication response missing access_token');
  }

  tokenCache = { token, expiresAt: Date.now() + CACHE_TTL_MS };
  return token;
}

/**
 * Generate an Aadhaar OTP and return the reference / transaction IDs
 * needed for the subsequent verify call.
 */
export async function generateAadhaarOtp(aadhaarNumber: string): Promise<AadhaarOtpResult> {
  const token = await authenticate();

  const res = await fetch(`${baseUrl()}/kyc/aadhaar/okyc/otp`, {
    method: 'POST',
    headers: {
      authorization: token,
      'x-api-key': apiKey(),
      'x-api-version': '1.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request',
      aadhaar_number: aadhaarNumber,
      consent: 'Y',
      reason: 'Identity verification for SaathiAI learner onboarding',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sandbox generate OTP failed (${res.status}): ${body}`);
  }

  const data = await res.json() as Record<string, any>;
  const referenceId = String(data?.data?.reference_id ?? '');
  const transactionId = String(data?.transaction_id ?? data?.data?.transaction_id ?? '');

  if (!referenceId) {
    throw new Error(`Sandbox OTP response missing reference_id. Response: ${JSON.stringify(data)}`);
  }

  return { referenceId, transactionId: transactionId || referenceId };
}

/**
 * Verify an Aadhaar OTP using the reference ID from the generate step.
 * Returns the full KYC data including name, dob, gender, address and a
 * base64-encoded face photo.
 */
export async function verifyAadhaarOtp(
  referenceId: string,
  otp: string,
): Promise<AadhaarVerifyResult> {
  const token = await authenticate();

  const res = await fetch(`${baseUrl()}/kyc/aadhaar/okyc/otp/verify`, {
    method: 'POST',
    headers: {
      authorization: token,
      'x-api-key': apiKey(),
      'x-api-version': '1.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.request',
      reference_id: String(referenceId),
      otp: String(otp),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 422 || res.status === 400) {
      const err = new Error(`OTP verification failed (${res.status}): ${body}`) as Error & { otpInvalid: boolean };
      err.otpInvalid = true;
      throw err;
    }
    throw new Error(`Sandbox verify OTP failed (${res.status}): ${body}`);
  }

  const json = await res.json() as Record<string, any>;
  const d = json?.data;
  if (!d) throw new Error('Sandbox verify OTP response missing data');

  // Sandbox returns 200 even for invalid/expired OTP — check for error messages
  if (d.message && !d.name && !d.status) {
    const err = new Error(d.message) as Error & { otpInvalid: boolean };
    err.otpInvalid = true;
    throw err;
  }
  if (d.status && d.status !== 'VALID') {
    const err = new Error(d.message ?? `Aadhaar verification status: ${d.status}`) as Error & { otpInvalid: boolean };
    err.otpInvalid = true;
    throw err;
  }

  // Sandbox sometimes returns the photo with a data URI prefix; strip it so
  // callers always get a raw base64 JPEG string.
  const rawPhoto = (d.photo ?? '').replace(/^data:[^;]+;base64,/, '');

  return {
    aadhaarNumber: d.aadhaar_number ?? '',
    name: d.name ?? '',
    dob: d.dob ?? '',
    gender: d.gender ?? '',
    address: {
      line: d.address?.['street'] ?? d.address?.['vtc'] ?? d.address?.['house'] ?? null,
      district: d.address?.['dist'] ?? d.address?.['district'] ?? null,
      state: d.address?.['state'] ?? null,
      pincode: d.address?.['pc'] ?? d.address?.['pincode'] ?? null,
    },
    photo: rawPhoto,
  };
}

// ─── EntityLocker ─────────────────────────────────────────────────────────────

export interface EntityLockerSessionResult {
  authorizationUrl: string;
  sessionId: string;
}

export interface EntityDetails {
  id: string;
  name: string;
  email: string;
  mobile: string;
  dateOfIncorporation: string; // DD/MM/YYYY
  verifiedBy: 'pan' | 'ud' | 'cin';
}

/**
 * Initiate an EntityLocker session and return the authorization URL + session ID.
 * `redirectUrl` must be HTTPS and is where EntityLocker sends the user after consent.
 */
export async function initEntityLockerSession(
  flow: 'signin' | 'signup',
  redirectUrl: string,
  consentExpiry: number,
): Promise<EntityLockerSessionResult> {
  const token = await authenticate();

  const res = await fetch(`${baseUrl()}/kyc/entitylocker/sessions/init`, {
    method: 'POST',
    headers: {
      authorization: token,
      'x-api-key': apiKey(),
      'x-api-version': '1.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      '@entity': 'in.co.sandbox.kyc.entitylocker.session.request',
      flow,
      redirect_url: redirectUrl,
      consent_expiry: consentExpiry,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`EntityLocker session init failed (${res.status}): ${body}`);
  }

  const json = await res.json() as Record<string, any>;
  const data = json?.data;
  if (!data?.authorization_url || !data?.session_id) {
    throw new Error(`EntityLocker session response missing fields: ${JSON.stringify(json)}`);
  }

  return {
    authorizationUrl: data.authorization_url,
    sessionId: data.session_id,
  };
}

/**
 * Fetch entity details after the user has completed the EntityLocker consent flow.
 * Call this with the session_id from initEntityLockerSession after the redirect callback.
 */
export async function getEntityDetails(sessionId: string): Promise<EntityDetails> {
  const token = await authenticate();

  const res = await fetch(`${baseUrl()}/kyc/entitylocker/sessions/${encodeURIComponent(sessionId)}/entity`, {
    method: 'GET',
    headers: {
      authorization: token,
      'x-api-key': apiKey(),
      'x-api-version': '1.0.0',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`EntityLocker get entity details failed (${res.status}): ${body}`);
  }

  const json = await res.json() as Record<string, any>;
  const d = json?.data;
  if (!d?.name) {
    throw new Error(`EntityLocker entity response missing data: ${JSON.stringify(json)}`);
  }

  return {
    id: d.id ?? '',
    name: d.name ?? '',
    email: d.email ?? '',
    mobile: d.mobile ?? '',
    dateOfIncorporation: d.date_of_incorporation ?? '',
    verifiedBy: d.verified_by ?? 'pan',
  };
}

/** Exposed for testing: clear the in-memory token cache. */
export function _clearTokenCache(): void {
  tokenCache = null;
}
