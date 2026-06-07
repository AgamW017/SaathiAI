import { includesAny, normalizeText } from '../utils/text.js';

const keywordMap = [
  { intent: 'jobs', patterns: ['jobs', 'job chahiye', 'kaam chahiye', 'काम चाहिए', 'जॉब'] },
  { intent: 'practice', patterns: ['practice', 'interview practice', 'प्रैक्टिस', 'practice karo'] },
  { intent: 'card', patterns: ['card', 'skill card', 'mera card', 'मेरा कार्ड'] },
  { intent: 'help', patterns: ['help', 'madad', 'help chahiye', 'मदद'] },
  { intent: 'stop', patterns: ['stop', 'mat bhejo', 'unsubscribe', 'बंद करो', 'मत भेजो'] },
  { intent: 'start', patterns: ['start', 'shuru', 'शुरू'] },
  { intent: 'status', patterns: ['status', 'स्थिति'] }
];

const distressPatterns = [
  'koi kaam nahi mila',
  'kaam nahi mila',
  'thak gaya',
  'family pressure',
  'paisa nahi',
  'नौकरी नहीं मिली',
  'काम नहीं मिला',
  'थक गया',
  'पैसा नहीं'
];

export function detectKeywordIntent(text) {
  const normalized = normalizeText(text);
  const match = keywordMap.find(({ patterns }) => includesAny(normalized, patterns));
  return match?.intent ?? null;
}

export function isDistressMessage(text) {
  return includesAny(normalizeText(text), distressPatterns);
}
