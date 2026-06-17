/**
 * Field Validator — validates AI-extracted values before they're stored.
 * 
 * This is the gatekeeper between AI responses and the database.
 * No field value gets stored without passing through this validation.
 * 
 * Protocol:
 * - AI returns { field: value, confidence: number }
 * - Validator checks value against rules for that field type
 * - Returns { valid: boolean, value: sanitized_value, reason?: string }
 */

// Words that are NEVER valid field values (conversational noise)
const NOISE_WORDS = new Set([
  'yes', 'no', 'ok', 'okay', 'haan', 'ha', 'nahi', 'nahin',
  'theek', 'sahi', 'galat', 'badlo', 'sure', 'later',
  'thanks', 'thank', 'dhanyavaad', 'shukriya',
  'hello', 'hi', 'hey', 'namaste',
  'start', 'stop', 'help', 'jobs', 'card', 'status', 'practice',
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'y', 'n', 'han', 'ji', 'hmm', 'acha', 'accha',
  'hmmm', 'kya', 'kaise', 'kab', 'kaun', 'kyun',
  'more', 'aur', 'none', 'koi nahi',
]);

// Minimum lengths for each field
const MIN_LENGTHS = {
  name: 2,
  trade: 2,
  district: 2,
  state: 2,
  certificateType: 2,
};

// Maximum lengths for each field
const MAX_LENGTHS = {
  name: 60,
  trade: 100,
  district: 50,
  state: 30,
  certificateType: 50,
};

/**
 * Validate a single field value extracted by AI.
 * 
 * @param {string} field - Field name (name, trade, district, state, certificateType)
 * @param {any} value - The extracted value
 * @param {number} confidence - AI confidence (0-1)
 * @returns {{ valid: boolean, value: string|null, reason?: string }}
 */
export function validateField(field, value, confidence = 1) {
  // Null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return { valid: false, value: null, reason: 'empty' };
  }

  const strValue = String(value).trim();

  // Check minimum length
  const minLen = MIN_LENGTHS[field] ?? 2;
  if (strValue.length < minLen) {
    return { valid: false, value: null, reason: `too_short (min ${minLen})` };
  }

  // Check maximum length
  const maxLen = MAX_LENGTHS[field] ?? 100;
  if (strValue.length > maxLen) {
    return { valid: false, value: strValue.slice(0, maxLen), reason: 'truncated' };
  }

  // Check against noise words (case-insensitive)
  const normalized = strValue.toLowerCase().trim();
  if (NOISE_WORDS.has(normalized)) {
    return { valid: false, value: null, reason: `noise_word: "${strValue}" is conversational, not a ${field}` };
  }

  // Field-specific validation
  switch (field) {
    case 'name':
      return validateName(strValue, confidence);
    case 'trade':
      return validateTrade(strValue, confidence);
    case 'district':
    case 'state':
      return validateLocation(strValue, field, confidence);
    case 'certificateType':
      return validateCertificate(strValue, confidence);
    default:
      return { valid: true, value: strValue };
  }
}

/**
 * Validate a complete extraction result (multiple fields).
 * Returns only the valid fields.
 */
export function validateExtraction(extraction) {
  const validated = {};
  const rejected = [];

  for (const [field, value] of Object.entries(extraction)) {
    if (['confidence', 'flags', 'missingFields'].includes(field)) continue;
    if (value === null || value === undefined || value === '') continue;

    const result = validateField(field, value, extraction.confidence ?? 0.8);
    if (result.valid) {
      validated[field] = result.value;
    } else {
      rejected.push({ field, value, reason: result.reason });
    }
  }

  return { validated, rejected };
}

// ─── Field-specific validators ────────────────────────────────────────────────

function validateName(value, confidence) {
  // Name should not be a common word or phrase
  const lower = value.toLowerCase();
  
  // Reject if it looks like a sentence (has spaces and common sentence words)
  if (/^(i am|my name|mera naam|main|mai|hum|mere|meri)\b/i.test(value)) {
    // Try to extract the actual name from "I am X" or "Mera naam X hai"
    const match = value.match(/(?:i am|my name is|mera naam|naam)\s+(.+?)(?:\s+hai)?$/i);
    if (match && match[1]) {
      const extracted = match[1].trim();
      if (extracted.length >= 2 && !NOISE_WORDS.has(extracted.toLowerCase())) {
        return { valid: true, value: extracted };
      }
    }
    return { valid: false, value: null, reason: 'looks_like_sentence_not_name' };
  }

  // Reject single common words
  if (value.split(/\s+/).length === 1 && lower.length <= 4) {
    // Short single words that could be noise
    const shortNoisePatterns = /^(sir|bhai|ji|didi|bro|mai|mam|sir|boss)$/i;
    if (shortNoisePatterns.test(value)) {
      return { valid: false, value: null, reason: 'too_generic' };
    }
  }

  // Low confidence names need extra scrutiny
  if (confidence < 0.5 && value.split(/\s+/).length < 2) {
    return { valid: false, value: null, reason: 'low_confidence_single_word' };
  }

  return { valid: true, value: value };
}

function validateTrade(value, confidence) {
  // Trade should not contain full sentences
  if (value.split(/\s+/).length > 5) {
    return { valid: false, value: null, reason: 'too_many_words_for_trade' };
  }

  return { valid: true, value: value };
}

function validateLocation(value, field, confidence) {
  // Location should not be a number
  if (/^\d+$/.test(value)) {
    return { valid: false, value: null, reason: `${field}_is_just_a_number` };
  }

  return { valid: true, value: value };
}

function validateCertificate(value, confidence) {
  return { valid: true, value: value };
}
