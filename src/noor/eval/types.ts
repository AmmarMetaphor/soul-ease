/**
 * Semantic evaluation fixtures for Noor's conversation.
 *
 * Criteria describe *concepts*, never exact sentences. Asserting a wording
 * would test that the model memorised a line, which is the very behaviour
 * Stage 3 exists to remove — and it would fail a perfectly good reply that
 * said the same thing differently.
 *
 * So a concept is a set of surface forms that all count as engaging with it.
 * "the interview" is satisfied by "interview", "the panel", "tomorrow's
 * meeting"; it is not satisfied by a warm sentence about stress in general.
 * This is a coarse instrument and does not pretend otherwise: it catches
 * ignoring the member and generic filler, which is what actually went wrong,
 * and it cannot judge tone. Tone is a person's job — see
 * docs/LIVE_REALTIME_ACCEPTANCE.md.
 */

export type EvalLanguage = 'en' | 'ur' | 'mixed';

export type EvalCategory =
  | 'work_stress'
  | 'interview_anxiety'
  | 'overthinking'
  | 'relationship_conflict'
  | 'breakup'
  | 'grief'
  | 'loneliness'
  | 'neutral_conversation'
  | 'good_mood'
  | 'sleep_stress'
  | 'family_conflict'
  | 'decision_uncertainty'
  | 'multi_turn_continuity'
  | 'user_correction'
  | 'interruption_intent'
  | 'memory_recall'
  | 'deleted_memory'
  | 'no_memory_user'
  | 'unhelpful_coping_preference'
  | 'safety';

/** A concept a reply must (or must not) engage with. */
export interface Concept {
  /** Short label used in failure messages. */
  label: string;
  /**
   * Surface forms that count as engaging with the concept. Matched
   * case-insensitively on word boundaries where the alphabet allows it, so
   * Urdu-script forms match as substrings.
   */
  anyOf: string[];
}

/** One turn of the member's side of the conversation. */
export interface EvalTurn {
  member: string;
  /** Criteria that apply to Noor's reply to THIS turn. */
  expect: EvalExpectation;
}

export interface EvalExpectation {
  /** Every concept here must appear. */
  mustEngage?: Concept[];
  /** None of these may appear. */
  mustNotMention?: Concept[];
  /** Upper bound on questions in one spoken turn. Defaults to 1. */
  maxQuestions?: number;
  /** Requires at least one question, for turns where asking is the point. */
  requiresQuestion?: boolean;
  /** Upper bound on words, so a spoken turn stays speakable. */
  maxWords?: number;
  /** Reply must be in this language register. */
  language?: EvalLanguage;
}

export interface EvalFixture {
  id: string;
  language: EvalLanguage;
  category: EvalCategory;
  /** What this fixture is actually testing, in one line. */
  intent: string;
  /**
   * Context the session would have been built with. Only the fields a fixture
   * cares about; the rest come from EMPTY_SESSION_CONTEXT.
   */
  context?: {
    memoryLines?: string[];
    goals?: string[];
    followUps?: string[];
    unhelpfulTools?: string[];
    helpfulTools?: string[];
    displayName?: string | null;
    firstSession?: boolean;
    /** Memory the member deleted — must NOT reach the prompt. */
    deletedMemoryLines?: string[];
  };
  /** One or more member turns. Criteria attach to the reply to each. */
  turns: EvalTurn[];
}
