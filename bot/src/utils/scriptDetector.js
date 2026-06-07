const DEVANAGARI_RE = /[\u0900-\u097F]/g;
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
  'district',
  'trade'
]);

export function detectScript(text = '') {
  const letters = text.match(LETTER_RE) ?? [];
  if (letters.length === 0) {
    return { script: 'roman', confidence: 0.4 };
  }

  const devanagariCount = (text.match(DEVANAGARI_RE) ?? []).length;
  const devanagariRatio = devanagariCount / letters.length;

  if (devanagariRatio > 0.4) {
    return { script: 'devanagari', confidence: devanagariRatio };
  }

  const words = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  const hinglishHits = words.filter((word) => HINGLISH_WORDS.has(word)).length;

  if (hinglishHits > 0) {
    return { script: 'roman', confidence: Math.min(0.95, 0.45 + hinglishHits / 10) };
  }

  return { script: 'english', confidence: 0.7 };
}

export function chooseScript(session, incomingText) {
  const detected = detectScript(incomingText);
  if (!session.script) return detected.script;

  const userSwitchedClearly = detected.script !== session.script && detected.confidence >= 0.7;
  return userSwitchedClearly ? detected.script : session.script;
}
