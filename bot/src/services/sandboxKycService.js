/**
 * sandboxKycService.js — Bot-side HTTP adapter for Sandbox KYC operations.
 *
 * All Sandbox API credentials live in the backend. The bot calls the backend's
 * internal proxy endpoints, forwarding the shared bot secret for auth.
 *
 * Environment variables:
 *   BACKEND_INTERNAL_URL — Base URL of the backend (default: http://localhost:4000)
 *   BOT_INTERNAL_SECRET  — Shared secret for x-bot-secret header (default: dev-bot-secret)
 */

function backendUrl() {
  return (process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

function botSecret() {
  return process.env.BOT_INTERNAL_SECRET ?? 'dev-bot-secret';
}

async function callBackend(path, body) {
  const res = await fetch(`${backendUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': botSecret(),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = json?.error ?? json?.message ?? `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    if (res.status === 422) err.otpInvalid = true;
    throw err;
  }

  return json;
}

export class SandboxKycService {
  /**
   * Extract a 12-digit Aadhaar number from an image/PDF buffer.
   *
   * @param {Buffer} buffer - File content
   * @param {string} mimeType - MIME type of the file
   * @param {string} [filename] - Optional original filename
   * @returns {Promise<string|null>} 12-digit Aadhaar number or null
   */
  async extractAadhaarNumber(buffer, mimeType, filename) {
    const result = await callBackend('/internal/extract-aadhaar', {
      fileBase64: buffer.toString('base64'),
      mimeType,
      filename: filename ?? 'aadhaar',
    });
    return result.aadhaarNumber ?? null;
  }

  /**
   * Generate an Aadhaar OTP via Sandbox.
   *
   * @param {string} aadhaarNumber - 12-digit Aadhaar number (no spaces/dashes)
   * @returns {Promise<{ referenceId: string, transactionId: string }>}
   */
  async generateAadhaarOtp(aadhaarNumber) {
    return callBackend('/internal/kyc/aadhaar-otp', { aadhaarNumber });
  }

  /**
   * Verify an Aadhaar OTP and return the full KYC payload.
   *
   * @param {string} referenceId - From generateAadhaarOtp response
   * @param {string} otp - OTP entered by the user
   * @returns {Promise<{
   *   aadhaarNumber: string,
   *   name: string,
   *   dob: string,
   *   gender: string,
   *   address: { line, district, state, pincode },
   *   photo: string   // base64 JPEG
   * }>}
   * @throws {Error} with .otpInvalid = true when OTP is wrong
   */
  async verifyAadhaarOtp(referenceId, otp) {
    return callBackend('/internal/kyc/aadhaar-verify', { referenceId, otp });
  }
}
