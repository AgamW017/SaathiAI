const DEVANAGARI_RE = /[\u0900-\u097F]/g;
const GUJARATI_RE = /[\u0A80-\u0AFF]/g;
const BENGALI_RE = /[\u0980-\u09FF]/g;
const LETTER_RE = /\p{L}/gu;

const HINGLISH_WORDS = new Set([
  'aap',
  'aapka',
  'aapki',
  'hai',
  'hain',
  'hoon',
  'hu',
  'mera',
  'meri',
  'kya',
  'kaam',
  'nahi',
  'nahin',
  'haan',
  'ji',
  'mujhe',
  'chahiye',
  'job',
  'madad',
  'karo',
  'batao',
  'start',
  'ok',
  'okay',
  'yes',
  'y',
  'district',
  'trade'
]);

// Marathi-specific words that distinguish it from Hindi when both use Devanagari
const MARATHI_MARKERS = new Set([
  'mi', 'mee', 'aahe', 'ahe', 'naav', 'nav', 'tumcha', 'tumhi',
  'kasa', 'kashi', 'kay', 'mala', 'tyala', 'tila', 'amhi',
  'kela', 'keli', 'zala', 'zali', 'hota', 'hoti', 'aahes',
  'mhanun', 'pan', 'kinva', 'ani', 'karun', 'sangitla',
  'माझे', 'माझा', 'माझी', 'आहे', 'नाव', 'तुमचा', 'तुम्ही',
  'कसा', 'काय', 'मला', 'आम्ही', 'केला', 'केली', 'झाला', 'झाली',
  'म्हणून', 'पण', 'किंवा', 'आणि', 'करून', 'सांगितला'
]);

export function detectScript(text = '') {
  const letters = text.match(LETTER_RE) ?? [];
  if (letters.length === 0) {
    return { script: 'roman', confidence: 0.4, detectedLanguage: null };
  }

  const gujaratiCount = (text.match(GUJARATI_RE) ?? []).length;
  const bengaliCount = (text.match(BENGALI_RE) ?? []).length;
  const devanagariCount = (text.match(DEVANAGARI_RE) ?? []).length;

  const gujaratiRatio = gujaratiCount / letters.length;
  const bengaliRatio = bengaliCount / letters.length;
  const devanagariRatio = devanagariCount / letters.length;

  // Gujarati script detected
  if (gujaratiRatio > 0.3) {
    return { script: 'roman', confidence: gujaratiRatio, detectedLanguage: 'gujarati' };
  }

  // Bengali script detected
  if (bengaliRatio > 0.3) {
    return { script: 'roman', confidence: bengaliRatio, detectedLanguage: 'bengali' };
  }

  // Devanagari script detected — could be Hindi or Marathi
  if (devanagariRatio > 0.4) {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);
    const marathiHits = words.filter(w => MARATHI_MARKERS.has(w)).length;
    const detectedLanguage = marathiHits >= 2 ? 'marathi' : 'hindi';
    return { script: 'devanagari', confidence: devanagariRatio, detectedLanguage };
  }

  // Latin script — check for Hinglish vs English
  const words = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  const hinglishHits = words.filter((word) => HINGLISH_WORDS.has(word)).length;

  if (hinglishHits > 0) {
    return { script: 'roman', confidence: Math.min(0.95, 0.45 + hinglishHits / 10), detectedLanguage: 'hinglish' };
  }

  if (words.length <= 2) {
    return { script: 'roman', confidence: 0.45, detectedLanguage: null };
  }

  return { script: 'english', confidence: 0.7, detectedLanguage: 'english' };
}

export function chooseScript(session, incomingText) {
  const detected = detectScript(incomingText);
  if (!session.script) return detected.script;

  const userSwitchedClearly = detected.script !== session.script && detected.confidence >= 0.85;
  return userSwitchedClearly ? detected.script : session.script;
}

