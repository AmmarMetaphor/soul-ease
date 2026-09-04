import type { ConcernId, NewSessionSummary } from '@/data/types';
import { generateMemoryCandidates, followUpCandidates, type MemoryCandidate } from '@/memory/candidates';
import type { DetectedLanguage, TranscriptTurn } from '@/realtime/types';
import type { SafetyState } from '@/safety/types';
import { buildSessionSummary, deriveTopics } from './summaryBuilder';

/**
 * The structured result of a finished session — memory layer 2.
 *
 * One object assembled once, so the summary screen, the memory-approval list
 * and the several tables that persist parts of it all read the same thing.
 * Previously the summary text and the memory candidates were derived
 * separately from the same turns, which is how a summary and its proposed
 * memories drift apart.
 *
 * Deliberately descriptive, never diagnostic. It records what was discussed
 * and what the member said they would try. It contains no assessment of the
 * person, no severity, no inference about a condition — those are not
 * conclusions a wellbeing companion is in any position to draw, and a stored
 * one would follow the member around.
 */
export interface SessionOutcome {
  sessionId: string;
  /** Topic tags derived from the whole conversation. */
  primaryTopics: ConcernId[];
  /** Member-facing summary, persisted to session_summaries. */
  summary: NewSessionSummary;
  /** Coping approaches actually raised in the conversation. */
  copingToolsDiscussed: string[];
  /** Next steps the member agreed to, already trimmed. */
  actionsAgreed: string[];
  /** Goal-shaped proposals worth offering as a saved goal. */
  goalProposals: string[];
  /** Things the member asked to be checked back on. */
  followUpTopics: string[];
  /** Proposed durable memories, awaiting the member's approval. */
  memoryCandidates: MemoryCandidate[];
  /** Highest safety state the session reached. */
  maxSafetyState: SafetyState;
  /** The register the member actually spoke in, if it could be told. */
  languageObserved: DetectedLanguage | null;
  /** Turn counts, so a one-line session is not summarised as a conversation. */
  userTurnCount: number;
  noorTurnCount: number;
}

export interface OutcomeMaterial {
  sessionId: string;
  turns: TranscriptTurn[];
  agreedActions: string[];
  topic: ConcernId | null;
  interventionSlug: string | null;
  maxSafetyState: SafetyState;
  fallbackConcerns: ConcernId[];
  /** Explicit follow-up requests captured during the session. */
  followUpRequests?: string[];
  /** Coping approaches Noor raised during the session. */
  copingToolsDiscussed?: string[];
}

/** The register the member spoke in most often across their own turns. */
export function observedLanguage(turns: TranscriptTurn[]): DetectedLanguage | null {
  const counts = new Map<DetectedLanguage, number>();
  for (const turn of turns) {
    if (turn.role !== 'user' || !turn.language) continue;
    counts.set(turn.language, (counts.get(turn.language) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function buildSessionOutcome(material: OutcomeMaterial): SessionOutcome {
  const primaryTopics = deriveTopics(material.turns, material.fallbackConcerns);
  const summary = buildSessionSummary(material);
  const userTurns = material.turns.filter((t) => t.role === 'user');
  const languageObserved = observedLanguage(material.turns);

  const candidates = generateMemoryCandidates({
    sessionId: material.sessionId,
    topic: material.topic ?? primaryTopics[0] ?? null,
    agreedActions: material.agreedActions,
    userTurns: userTurns.map((t) => t.text),
    recommendedExerciseSlug: summary.recommendedExerciseSlug,
    followUpRequests: material.followUpRequests,
    languageObserved,
  });

  const copingToolsDiscussed = [
    ...new Set(
      [...(material.copingToolsDiscussed ?? []), material.interventionSlug, summary.recommendedExerciseSlug].filter(
        (slug): slug is string => typeof slug === 'string' && slug.length > 0,
      ),
    ),
  ];

  return {
    sessionId: material.sessionId,
    primaryTopics,
    summary,
    copingToolsDiscussed,
    actionsAgreed: summary.agreedActions,
    goalProposals: candidates.filter((c) => c.category === 'goal').map((c) => c.content),
    followUpTopics: followUpCandidates(candidates).map((c) => c.content),
    // Follow-ups get their own rows, so they are not also offered as facts to
    // remember about the member.
    memoryCandidates: candidates.filter((c) => c.category !== 'follow_up'),
    maxSafetyState: material.maxSafetyState,
    languageObserved,
    userTurnCount: userTurns.length,
    noorTurnCount: material.turns.length - userTurns.length,
  };
}
