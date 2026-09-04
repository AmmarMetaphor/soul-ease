import type {
  CopingPreference,
  FollowUpItem,
  Goal,
  JournalEntry,
  MemoryItem,
  Profile,
  SessionSummary,
  WellbeingSession,
} from '@/data/types';
import type { NoorSessionContext } from '@/noor/realtimeInstructions';
import type { ConsentState } from '@/memory/permissions';
import { canPersistLongTermMemory, canShareJournalWithNoor } from '@/memory/permissions';

/**
 * The bounded context package for a session — memory layer 3 in practice.
 *
 * Soul Ease keeps three layers (see src/memory/layers.ts):
 *   1. active session memory — held by the realtime session, dies with it
 *   2. session summary       — the structured result of a finished session
 *   3. approved long-term memory — what the member agreed may persist
 *
 * This builds the slice of layer 3 that a *new* session starts with. It is
 * deliberately small. Previous transcripts are never replayed: a whole history
 * dumped into a prompt costs latency, buries the current turn under old
 * material, and hands the model far more of someone's private life than the
 * conversation needs. Every limit below is a cap, not a target.
 *
 * Every field degrades to empty. A member whose memory is off, or who is new,
 * or whose data could not be loaded, still gets a working conversation — with
 * Noor told plainly that she knows nothing rather than left to improvise.
 */

export const MEMORY_LIMITS = {
  memoryLines: 8,
  goals: 3,
  recentActions: 2,
  followUps: 3,
  helpfulTools: 4,
  /** Every rejected approach is included: the whole point is not repeating one. */
  unhelpfulTools: 12,
  journalLines: 3,
  journalChars: 180,
  gistChars: 220,
} as const;

export interface MemorySources {
  profile: Profile | null;
  consent: ConsentState;
  memories: MemoryItem[];
  goals: Goal[];
  followUps: FollowUpItem[];
  copingPreferences: CopingPreference[];
  /** Recent entries. Only read when the member allowed journal access. */
  journalEntries: JournalEntry[];
  lastEndedSession: WellbeingSession | null;
  lastSummary: SessionSummary | null;
  /** Total ended sessions, used to decide whether this is a first session. */
  endedSessionCount: number;
}

function trim(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** A tool slug as a readable phrase: 'box-breathing' → 'box breathing'. */
export function readableTool(slug: string): string {
  return slug.replace(/[-_]+/g, ' ').trim();
}

/**
 * Build the context Noor is given.
 *
 * Note what is *excluded* as much as what is included: no transcripts, no
 * assessment scores, no safety history, no mood notes. Those exist in the
 * database for the member to look at, not for the model to be told about
 * unprompted.
 */
export function buildMemoryContext(sources: MemorySources): NoorSessionContext {
  const memoryAllowed = canPersistLongTermMemory(sources.consent);
  const journalAllowed = canShareJournalWithNoor(sources.consent);

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

  // Only open items, and only ones whose horizon has arrived. An item already
  // raised is not raised again: asking twice turns a kindness into nagging.
  const now = Date.now();
  const followUps = memoryAllowed
    ? sources.followUps
        .filter((f) => f.status === 'open' && (!f.dueAfter || Date.parse(f.dueAfter) <= now))
        .slice(0, MEMORY_LIMITS.followUps)
        .map((f) => trim(f.prompt, 160))
    : [];

  const helpfulTools = memoryAllowed
    ? sources.copingPreferences
        .filter((p) => p.outcome === 'tried_helpful')
        .slice(0, MEMORY_LIMITS.helpfulTools)
        .map((p) => readableTool(p.toolSlug))
    : [];

  // Rejected approaches are included even when long-term memory is off, but
  // only for approaches recorded in this account — this is a "do not repeat
  // this" instruction, not a personal detail, and re-suggesting something a
  // member has already dismissed is the loudest way to tell them nobody
  // listened.
  const unhelpfulTools = sources.copingPreferences
    .filter((p) => p.outcome === 'tried_unhelpful')
    .slice(0, MEMORY_LIMITS.unhelpfulTools)
    .map((p) => readableTool(p.toolSlug));

  const journalLines = journalAllowed
    ? sources.journalEntries
        .slice(0, MEMORY_LIMITS.journalLines)
        .map((e) => trim(e.title ? `${e.title}: ${e.body}` : e.body, MEMORY_LIMITS.journalChars))
        .filter((line) => line.length > 0)
    : [];

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
    followUps,
    helpfulTools,
    unhelpfulTools,
    journalLines,
    journalAccessAllowed: journalAllowed,
    lastSessionGist,
    openGently: previousMax === 'SAFETY_MODE' || previousMax === 'HUMAN_HANDOFF',
    firstSession: sources.endedSessionCount === 0,
  };
}

/** Language hints for input transcription, derived from the member's setting. */
export { transcriptionLanguagesFor as transcriptionLanguages } from '@/noor/spec/languageBehaviour';
