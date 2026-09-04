import type { ConcernId } from '@/data/types';

/**
 * Topic tagging for session history and summaries.
 *
 * This is a labelling utility, not a conversation engine: it decides which
 * chips appear on a past session in the member's history. It never chooses
 * what Noor says — Noor's replies come from the realtime model reading the
 * member's actual words, and picking a reply by topic regex is exactly the
 * behaviour that made her sound scripted.
 *
 * Patterns cover English, Urdu script and Roman Urdu, because members write
 * their history entries in all three.
 */

const TOPIC_PATTERNS: Array<{ topic: ConcernId; re: RegExp }> = [
  { topic: 'grief', re: /\b(died|passed away|death|funeral|lost my|miss (him|her|them)|intaqal|wafat|guzar gay|fout|janaza)\b|فوت|انتقال|وفات|گزر گ/i },
  { topic: 'relationships', re: /\b(wife|husband|partner|marriage|married|divorce|in-?laws|saas|susraal|biwi|shohar|shadi|rishta|boyfriend|girlfriend|ammi|abbu|amma|abba|my (mother|father|brother|sister|family)|dost|friend)\b|بیوی|شوہر|شادی|رشتہ|امی|ابو|خاندان|دوست/i },
  { topic: 'overthinking', re: /\b(overthink\w*|over-thinking|can'?t stop thinking|keep thinking|thoughts? (won'?t|don'?t) stop|loop|dimagh|sochta|sochti|soch|sochein)\b|سوچ|دماغ/i },
  { topic: 'anxiety', re: /\b(anxious|anxiety|panic|nervous|on edge|worr(y|ied|ying)|ghabrahat|ghabra|dar lagta|darr|bechain)\b|گھبراہٹ|بےچین|ڈر/i },
  { topic: 'low_mood', re: /\b(sad|down|depressed|low|empty|numb|hopeless|no energy|tired of everything|udaas|dil nahi|mann nahi|akela|alone|lonely)\b|اداس|اکیل|تنہا/i },
  { topic: 'stress', re: /\b(stress(ed)?|pressure|deadline|boss|office|work|job|exam|kaam|tension|naukri|paise|money|bills?)\b|دباؤ|کام|نوکری|ٹینشن|پیسے/i },
];

/** The first topic whose vocabulary appears in the text, or null. */
export function detectTopic(text: string): ConcernId | null {
  for (const { topic, re } of TOPIC_PATTERNS) {
    if (re.test(text)) return topic;
  }
  return null;
}
