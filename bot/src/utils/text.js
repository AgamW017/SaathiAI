export function normalizeText(text = '') {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ');
}

export function includesAny(normalizedText, patterns) {
  return patterns.some((pattern) => normalizedText.includes(pattern));
}

export function isAffirmative(text = '') {
  const value = normalizeText(text);
  return (
    ['1', 'yes', 'y', 'haan', 'ha', 'han', 'ok', 'okay', 'start', 'sure'].includes(value) ||
    includesAny(value, ['हाँ', 'हां', 'sahi', 'correct', 'ठीक', 'theek'])
  );
}

export function isNegative(text = '') {
  const value = normalizeText(text);
  return (
    ['2', 'no', 'n', 'nahin', 'nahi', 'later'].includes(value) ||
    includesAny(value, ['नहीं', 'गलत', 'badlo', 'बदलो'])
  );
}

export function parseNumberChoice(text = '', max = 3) {
  const value = normalizeText(text);
  const match = value.match(/\b([1-9])\b/);
  if (!match) return null;
  const number = Number(match[1]);
  return number >= 1 && number <= max ? number : null;
}

export function uniqueList(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

export function compact(value) {
  return value === undefined || value === null || value === '' ? null : value;
}
