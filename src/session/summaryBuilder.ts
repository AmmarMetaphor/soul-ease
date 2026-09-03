import type { ConcernId, NewSessionSummary } from '@/data/types';
import { detectTopic } from '@/realtime/demo/noorDemoScript';
import type { TranscriptTurn } from '@/realtime/types';
import type { SafetyState } from '@/safety/types';
import { EXERCISES, suggestExercise } from '@/toolkit/exercises';

export interface SummaryMaterial {
  sessionId: string;
  turns: TranscriptTurn[];
  agreedActions: string[];
  topic: ConcernId | null;
  interventionSlug: string | null;
  maxSafetyState: SafetyState;
  fallbackConcerns: ConcernId[];
}

const TOPIC_SENTENCE: Record<ConcernId, string> = {
  anxiety: 'the anxiety that has been building and how it shows up in your body and thoughts',
  low_mood: 'how low and heavy things have felt lately',
  stress: 'the pressure you are under and what is pressing hardest',
  overthinking: 'the thoughts that keep circling and how to slow them down',
  grief: 'the person you have lost and what you miss most',
  relationships: 'a relationship that has been weighing on you',
  someone_to_talk_to: 'what has been on your mind, without a fixed agenda',
  something_else: 'something you are still finding the words for',
};

/**
 * Derive topic tags from the whole conversation, not just the first line.
 */
export function deriveTopics(turns: TranscriptTurn[], fallback: ConcernId[]): ConcernId[] {
  const found = new Set<ConcernId>();
  for (const turn of turns) {
    if (turn.role !== 'user') continue;
    const topic = detectTopic(turn.text);
    if (topic) found.add(topic);
  }
  if (found.size === 0) for (const c of fallback.slice(0, 1)) found.add(c);
  return [...found];
}

/**
 * Build a plain, non-clinical summary. Phase 2 will have the model produce
 * this in the same shape; the wording rules stay the same: describe the
 * conversation, never make findings about the person.
 */
export function buildSessionSummary(material: SummaryMaterial): NewSessionSummary {
  const topics = deriveTopics(material.turns, material.fallbackConcerns);
  const primary = material.topic ?? topics[0] ?? null;
  const userTurns = material.turns.filter((t) => t.role === 'user');

  const talkedAbout = primary
    ? `You talked with Noor about ${TOPIC_SENTENCE[primary]}.`
    : userTurns.length > 0
      ? 'You talked with Noor about what has been on your mind.'
      : 'This was a short session without much conversation.';

  const secondary = topics.filter((t) => t !== primary);
  const talkedAboutFull =
    secondary.length > 0
      ? `${talkedAbout} ${secondary.length === 1 ? 'You also touched on' : 'You also touched on'} ${secondary
          .map((s) => s.replace(/_/g, ' '))
          .join(' and ')}.`
      : talkedAbout;

  const longest = userTurns.reduce<TranscriptTurn | null>((acc, t) => (acc && acc.text.length >= t.text.length ? acc : t), null);
  const mostImportant =
    material.maxSafetyState === 'SAFETY_MODE' || material.maxSafetyState === 'HUMAN_HANDOFF'
      ? 'Your safety came first in this conversation. Noor paused normal coaching to focus on it, and support options were shown.'
      : longest && longest.text.length > 40
        ? `What seemed to carry the most weight was when you said: “${trimQuote(longest.text)}”`
        : 'What seemed most important was simply having space to say things out loud.';

  const exercise =
    material.interventionSlug && EXERCISES.some((e) => e.slug === material.interventionSlug)
      ? material.interventionSlug
      : primary
        ? suggestExercise([primary]).slug
        : null;

  const agreed = material.agreedActions.slice(0, 2);
  const goalBeforeNext = agreed[0] ?? null;

  return {
    sessionId: material.sessionId,
    whatWeTalkedAbout: talkedAboutFull,
    mostImportant,
    agreedActions: agreed,
    recommendedExerciseSlug: material.maxSafetyState === 'NORMAL' || material.maxSafetyState === 'ELEVATED_SUPPORT' ? exercise : null,
    goalBeforeNext,
  };
}

function trimQuote(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > 140 ? `${cleaned.slice(0, 137)}…` : cleaned;
}
