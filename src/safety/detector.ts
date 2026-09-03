/**
 * Conversation safety screen — PHASE 1 HEURISTIC.
 *
 * This is a deliberately conservative keyword screen used by the demo
 * conversation engine so that the Safety Mode architecture can be exercised
 * end-to-end. It is NOT clinically reviewed and must be replaced or wrapped
 * by reviewed safety logic before production. It understands English, Urdu
 * script and common Roman-Urdu phrasing.
 *
 * Output levels:
 *  - 'none'            nothing noteworthy detected
 *  - 'concern'         distress that warrants ELEVATED_SUPPORT
 *  - 'immediate_risk'  language suggesting intent to end life or self-harm
 */
export type SafetySignalLevel = 'none' | 'concern' | 'immediate_risk';

const IMMEDIATE_RISK_PATTERNS: RegExp[] = [
  /\b(kill|end|take)\s+(my|myself|my own)\s*(life|self)?\b/i,
  /\b(want|going|plan(ning)?)\s+to\s+(die|kill myself|end it( all)?)\b/i,
  /\bsuicid(e|al)\b/i,
  /\bbetter off dead\b/i,
  /\b(hurt|harm)(ing)?\s+myself\b/i,
  /\b(don'?t|do not)\s+want\s+to\s+(live|be alive|be here)( any ?more)?\b/i,
  // Roman Urdu
  /\bkhud\s*kushi\b/i,
  /\b(mar(na)?|marne)\s+(chahta|chahti|ka|ki)\b/i,
  /\bzindagi\s+(khatam|khatm)\b/i,
  /\bapni\s+jaan\s+(le|lena|de)/i,
  /\b(jeena|jina)\s+nahi\s+chahta|(jeena|jina)\s+nahi\s+chahti\b/i,
  // Urdu script
  /خودکشی/,
  /مرنا چاہت/,
  /زندگی ختم/,
  /اپنی جان/,
  /جینا نہیں چاہت/,
];

const CONCERN_PATTERNS: RegExp[] = [
  /\bhopeless\b/i,
  /\bworthless\b/i,
  /\bcan'?t (go on|cope|take (it|this) any ?more)\b/i,
  /\bno (point|reason)( in| to)? (living|anything|going on)\b/i,
  /\beveryone would be better without me\b/i,
  /\bgive up\b/i,
  // Roman Urdu
  /\bkoi\s+faida\s+nahi\b/i,
  /\bhimmat\s+nahi\b/i,
  /\bsab\s+khatam\b/i,
  /\bbardasht\s+nahi\b/i,
  // Urdu script
  /کوئی فائدہ نہیں/,
  /برداشت نہیں/,
  /ہمت نہیں/,
];

export function screenTextForSafety(text: string): SafetySignalLevel {
  const normalised = text.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!normalised) return 'none';
  if (IMMEDIATE_RISK_PATTERNS.some((re) => re.test(normalised))) return 'immediate_risk';
  if (CONCERN_PATTERNS.some((re) => re.test(normalised))) return 'concern';
  return 'none';
}

/**
 * Detects a member explicitly asking for a human. Kept separate from risk
 * screening because it is a request, not a risk signal.
 */
const HUMAN_REQUEST_PATTERNS: RegExp[] = [
  /\b(talk|speak) (to|with) (a |an )?(human|person|real person|therapist|psychologist|counsell?or|doctor)\b/i,
  /\b(need|want) (a |an )?(human|real person|professional)\b/i,
  /\bkisi\s+(insaan|doctor|professional)\s+se\s+baat\b/i,
  /کسی (انسان|ڈاکٹر) سے بات/,
];

export function detectsHumanSupportRequest(text: string): boolean {
  return HUMAN_REQUEST_PATTERNS.some((re) => re.test(text));
}
