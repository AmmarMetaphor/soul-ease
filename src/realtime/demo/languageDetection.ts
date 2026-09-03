import type { DetectedLanguage } from '../types';

/** Arabic + Arabic Supplement blocks (covers Urdu letters). Escaped so the
 *  source survives any charset mis-detection. */
const URDU_SCRIPT = /[؀-ۿݐ-ݿ]/;

/**
 * Common Roman-Urdu tokens. Deliberately everyday vocabulary — the point is
 * to recognise natural Pakistani code-switching, not literary Urdu.
 */
const ROMAN_URDU_TOKENS = new Set([
  'mera', 'meri', 'mere', 'mujhe', 'mujh', 'main', 'mein', 'hum', 'humein', 'tum', 'aap',
  'hai', 'hain', 'hoon', 'hun', 'tha', 'thi', 'the', 'ho', 'hota', 'hoti', 'raha', 'rahi', 'rahe',
  'nahi', 'nahin', 'nai', 'kya', 'kyun', 'kaise', 'kab', 'kahan', 'kaun', 'ke', 'ki', 'ka', 'ko', 'se',
  'aur', 'ya', 'lekin', 'magar', 'phir', 'bohat', 'bahut', 'bohot', 'thora', 'thori', 'zyada',
  'dimagh', 'dil', 'zindagi', 'ghar', 'kaam', 'baat', 'waqt', 'din', 'raat', 'neend', 'log',
  'pareshan', 'tension', 'udaas', 'ghabrahat', 'dar', 'darr', 'gussa', 'sukoon', 'acha', 'achi',
  'samajh', 'pata', 'lagta', 'lagti', 'chahta', 'chahti', 'karoon', 'karun', 'kar', 'karna', 'karti', 'karta',
  'ammi', 'abbu', 'abba', 'bhai', 'behan', 'baji', 'shadi', 'rishta', 'dost', 'biwi', 'shohar',
  'theek', 'thik', 'bas', 'abhi', 'kal', 'aaj', 'kuch', 'sab', 'koi', 'wo', 'woh', 'yeh', 'ye', 'is', 'us',
  'ji', 'haan', 'han', 'shukriya', 'salam', 'assalam', 'walaikum', 'inshallah', 'alhamdulillah', 'mashallah',
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Heuristic language detection for the demo engine. The production realtime
 * model handles this natively; this exists so the demo can mirror the
 * member's register (English / Roman Urdu / mixed / Urdu script).
 */
export function detectLanguage(text: string): DetectedLanguage {
  if (URDU_SCRIPT.test(text)) return 'ur';
  const tokens = tokenise(text);
  if (tokens.length === 0) return 'en';
  const urduCount = tokens.filter((t) => ROMAN_URDU_TOKENS.has(t)).length;
  const ratio = urduCount / tokens.length;
  if (ratio < 0.18) return 'en';
  // English "content" words (4+ letters, not in the Urdu list) alongside Urdu
  // tokens indicate genuine code-switching rather than pure Roman Urdu.
  const englishContent = tokens.filter((t) => !ROMAN_URDU_TOKENS.has(t) && t.length >= 4 && /^[a-z']+$/.test(t)).length;
  if (ratio >= 0.55 && englishContent === 0) return 'ur-roman';
  return 'mixed';
}
