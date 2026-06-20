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

  const res = await fetch(`${baseUrl()}/kyc/aadhaar/otp`, {
    method: 'POST',
    headers: {
      authorization: token,  // intentionally no "Bearer " prefix
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      '@entity': 'in.co.sandbox.kyc.aadhaar.otp.request',
      aadhaar_number: aadhaarNumber,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sandbox generate OTP failed (${res.status}): ${body}`);
  }

  const data = await res.json() as { data?: { transaction_id?: string; reference_id?: string } };
  const referenceId = data?.data?.reference_id;
  const transactionId = data?.data?.transaction_id;

  if (!referenceId || !transactionId) {
    throw new Error('Sandbox OTP response missing reference_id or transaction_id');
  }

  return { referenceId, transactionId };
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

  const res = await fetch(`${baseUrl()}/kyc/aadhaar/otp/verify`, {
    method: 'POST',
    headers: {
      authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      '@entity': 'in.co.sandbox.kyc.aadhaar.otp.verify.request',
      reference_id: referenceId,
      otp,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Surface OTP mismatch as a distinguishable error
    if (res.status === 422 || res.status === 400) {
      const err = new Error(`OTP verification failed (${res.status}): ${body}`) as Error & { otpInvalid: boolean };
      err.otpInvalid = true;
      throw err;
    }
    throw new Error(`Sandbox verify OTP failed (${res.status}): ${body}`);
  }

  const json = await res.json() as {
    data?: {
      aadhaar_number?: string;
      name?: string;
      dob?: string;
      gender?: string;
      address?: Record<string, string>;
      photo?: string;
    };
  };

  const d = json?.data;
  if (!d) throw new Error('Sandbox verify OTP response missing data');

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
    photo: d.photo ?? '',
  };
}

/** Exposed for testing: clear the in-memory token cache. */
export function _clearTokenCache(): void {
  tokenCache = null;
}
