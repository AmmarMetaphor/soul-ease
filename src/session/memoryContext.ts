import type { Goal, MemoryItem, Profile, SessionSummary, WellbeingSession } from '@/data/types';
import type { NoorSessionContext } from '@/noor/realtimeInstructions';
import type { ConsentState } from '@/memory/permissions';
import { canPersistLongTermMemory } from '@/memory/permissions';

/**
 * Bounded context payload for a realtime session.
 *
 * Deliberately small: previous transcripts are never replayed into the model.
 * Only a member's name (if given), their active goals, the actions they
 * agreed last time, a one-line gist of the last session, and memory lines
 * they explicitly allowed. Phase 3 deepens the memory engine; this is the
 * hook it will grow from.
 */

export const MEMORY_LIMITS = {
  memoryLines: 8,
  goals: 3,
  recentActions: 2,
  gistChars: 220,
} as const;

export interface MemorySources {
  profile: Profile | null;
  consent: ConsentState;
  memories: MemoryItem[];
  goals: Goal[];
  lastEndedSession: WellbeingSession | null;
  lastSummary: SessionSummary | null;
  /** Total ended sessions, used to decide whether this is a first session. */
  endedSessionCount: number;
}

function trim(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Build the context Noor is given. Missing or unavailable memory must never
 * break a session: every field degrades to empty and the conversation still
 * works, with Noor told plainly that it knows nothing.
 */
export function buildMemoryContext(sources: MemorySources): NoorSessionContext {
  const memoryAllowed = canPersistLongTermMemory(sources.consent);

  const memoryLines = memoryAllowed
    ? sources.memories
        .slice(0, MEMORY_LIMITS.memoryLines)
        .map((m) => trim(m.content, 160))
        .filter((line) => line.length > 0)
    : [];

  const goals = sources.goals
    .filter((g) => g.status === 'active')
    .slice(0, MEMORY_LIMITS.goals)
    .map((g) => trim(g.title, 120));

  const recentActions = (sources.lastSummary?.agreedActions ?? [])
    .slice(0, MEMORY_LIMITS.recentActions)
    .map((a) => trim(a, 140));

  const lastSessionGist = sources.lastSummary?.whatWeTalkedAbout
    ? trim(sources.lastSummary.whatWeTalkedAbout, MEMORY_LIMITS.gistChars)
    : null;

  const previousMax = sources.lastEndedSession?.maxSafetyState ?? null;

  return {
    displayName: sources.profile?.displayName ?? null,
    preferredLanguage: sources.profile?.preferredLanguage ?? 'en',
    memoryLines,
    goals,
    recentActions,
    lastSessionGist,
    openGently: previousMax === 'SAFETY_MODE' || previousMax === 'HUMAN_HANDOFF',
    firstSession: sources.endedSessionCount === 0,
  };
}

/** Language hints for input transcription, derived from the member's setting. */
export function transcriptionLanguages(preferred: 'en' | 'ur'): string[] {
  // Both are always allowed: Pakistani members code-switch mid-sentence, and
  // constraining to one language degrades the other.
  return preferred === 'ur' ? ['ur', 'en'] : ['en', 'ur'];
}
