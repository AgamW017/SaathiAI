// Locale metadata — single source of truth for all locale-related UI
export const LOCALES = [
  {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    scriptChar: 'A',
    samplePhrase1: 'Ready for your next job?',
    samplePhrase2: 'Your first opportunity starts here',
    activeUsers: 265000,
    switchConfirm: 'Language changed ✓',
  },
  {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    scriptChar: 'अ',
    samplePhrase1: 'नौकरी के लिए तैयार हैं?',
    samplePhrase2: 'आपकी पहली नौकरी यहाँ से शुरू होती है',
    activeUsers: 480000,
    switchConfirm: 'भाषा बदल गई ✓',
  },
  {
    code: 'bn',
    nativeName: 'বাংলা',
    englishName: 'Bengali',
    scriptChar: 'আ',
    samplePhrase1: 'চাকরির জন্য প্রস্তুত?',
    samplePhrase2: 'আপনার প্রথম চাকরি এখান থেকেই শুরু',
    activeUsers: 195000,
    switchConfirm: 'ভাষা পরিবর্তিত হয়েছে ✓',
  },
  {
    code: 'mr',
    nativeName: 'मराठी',
    englishName: 'Marathi',
    scriptChar: 'म',
    samplePhrase1: 'नोकरीसाठी तयार आहात?',
    samplePhrase2: 'तुमची पहिली नोकरी इथूनच सुरू होते',
    activeUsers: 175000,
    switchConfirm: 'भाषा बदलली ✓',
  },
  {
    code: 'te',
    nativeName: 'తెలుగు',
    englishName: 'Telugu',
    scriptChar: 'అ',
    samplePhrase1: 'ఉద్యోగానికి సిద్ధంగా ఉన్నారా?',
    samplePhrase2: 'మీ మొదటి ఉద్యోగం ఇక్కడ నుండే మొదలవుతుంది',
    activeUsers: 142000,
    switchConfirm: 'భాష మారింది ✓',
  },
  {
    code: 'ta',
    nativeName: 'தமிழ்',
    englishName: 'Tamil',
    scriptChar: 'அ',
    samplePhrase1: 'வேலைக்கு தயாரா?',
    samplePhrase2: 'உங்கள் முதல் வேலை இங்கிருந்தே தொடங்கும்',
    activeUsers: 138000,
    switchConfirm: 'மொழி மாற்றப்பட்டது ✓',
  },
  {
    code: 'kn',
    nativeName: 'ಕನ್ನಡ',
    englishName: 'Kannada',
    scriptChar: 'ಅ',
    samplePhrase1: 'ಉದ್ಯೋಗಕ್ಕೆ ಸಿದ್ಧರಾ?',
    samplePhrase2: 'ನಿಮ್ಮ ಮೊದಲ ಕೆಲಸ ಇಲ್ಲಿಂದ ಶುರುವಾಗುತ್ತದೆ',
    activeUsers: 98000,
    switchConfirm: 'ಭಾಷೆ ಬದಲಾಯಿತು ✓',
  },
  {
    code: 'gu',
    nativeName: 'ગુજરાતી',
    englishName: 'Gujarati',
    scriptChar: 'અ',
    samplePhrase1: 'નોકરી માટે તૈયાર છો?',
    samplePhrase2: 'તમારી પ્રથમ નોકરી અહીંથી શરૂ થાય છે',
    activeUsers: 87000,
    switchConfirm: 'ભાષા બદલાઈ ✓',
  },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

export const DEFAULT_LOCALE: LocaleCode = 'en';

export const LOCALE_COOKIE = 'saathi-locale';

export function getLocaleData(code: LocaleCode) {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

export function isLocaleCode(value: string): value is LocaleCode {
  return LOCALES.some((locale) => locale.code === value);
}

export function formatUserCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M+`;
  if (n >= 1000) return `${Math.round(n / 1000)}K+`;
  return n.toString();
}
