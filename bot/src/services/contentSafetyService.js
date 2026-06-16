/**
 * Content Safety Service
 *
 * Filters messages for sensitive information before relay (employer-to-learner
 * or learner-to-employer). Detects Aadhaar numbers, bank account numbers,
 * OTP-related keywords, and enforces message length limits.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

const MAX_MESSAGE_LENGTH = 1000;

// Aadhaar: 12 digits with optional spaces or dashes between groups of 4
const AADHAAR_PATTERN = /\d{4}[\s-]?\d{4}[\s-]?\d{4}/;

// Bank account numbers: 9-18 consecutive digits
const BANK_ACCOUNT_PATTERN = /\d{9,18}/;

// OTP-related keywords (case-insensitive)
const OTP_PATTERNS = [
  /\bOTP\b/i,
  /\bone[\s-]?time\s*password\b/i,
  /\bverification\s*code\b/i
];

/**
 * Check a message for content safety violations.
 *
 * @param {string} content - The message content to check.
 * @returns {{ safe: boolean, reasons: string[] }} Result with rejection reasons if unsafe.
 */
export function checkMessage(content) {
  const reasons = [];

  if (typeof content !== 'string') {
    return { safe: false, reasons: ['Message content is invalid'] };
  }

  // Length check
  if (content.length > MAX_MESSAGE_LENGTH) {
    reasons.push(`Message exceeds the maximum allowed length of ${MAX_MESSAGE_LENGTH} characters`);
  }

  // Aadhaar number detection
  if (AADHAAR_PATTERN.test(content)) {
    reasons.push('Message contains a pattern matching an Aadhaar number');
  }

  // Bank account number detection (check on digit-only sequences)
  // We need to check for 9-18 consecutive digits that are NOT part of the Aadhaar match.
  // A simple approach: strip spaces/dashes and look for long digit runs,
  // but we also check the raw content for 9-18 digit sequences.
  if (hasBankAccountNumber(content)) {
    reasons.push('Message contains a pattern matching a bank account number');
  }

  // OTP keyword detection
  if (hasOTPKeyword(content)) {
    reasons.push('Message contains OTP or verification code related content');
  }

  return {
    safe: reasons.length === 0,
    reasons
  };
}

/**
 * Detect bank account number patterns (9-18 consecutive digits).
 * Note: An Aadhaar number (12 digits) would also match this pattern,
 * but both are sensitive — we flag both independently.
 */
function hasBankAccountNumber(content) {
  return BANK_ACCOUNT_PATTERN.test(content);
}

/**
 * Detect OTP-related keywords in the message.
 */
function hasOTPKeyword(content) {
  return OTP_PATTERNS.some((pattern) => pattern.test(content));
}

export const ContentSafetyService = {
  checkMessage
};

export default ContentSafetyService;
