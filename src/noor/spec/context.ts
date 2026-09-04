/**
 * The bounded context package a session is built from.
 *
 * Deliberately small and deliberately typed. Every field is something a member
 * either told Noor in this session, agreed she could keep, or asked her to
 * follow up on. Whole transcripts are never replayed: a long history dumped
 * into a prompt costs latency, buries the current turn, and hands the model
 * far more of someone's private life than the conversation needs.
 */
export interface NoorSessionContext {
  displayName?: string | null;
  /** The member's interface language — a starting register, not a constraint. */
  preferredLanguage: 'en' | 'ur';
  /** Short, member-approved memory lines. Empty when memory is off or new. */
  memoryLines: string[];
  /** Active goals, already trimmed by the caller. */
  goals: string[];
  /** Actions agreed in the last session. */
  recentActions: string[];
  /** Things the member asked Noor to check back on. */
  followUps: string[];
  /** Approaches the member reported as helpful. */
  helpfulTools: string[];
  /** Approaches the member reported as unhelpful — never suggest these again. */
  unhelpfulTools: string[];
  /** Recent journal lines, present only when the member allowed journal access. */
  journalLines: string[];
  /** Whether journal access is permitted at all (distinguishes "off" from "empty"). */
  journalAccessAllowed: boolean;
  /** One-line gist of the previous session, if any. */
  lastSessionGist: string | null;
  /** True when the previous session reached an elevated safety state. */
  openGently: boolean;
  /** True on the member's very first conversation. */
  firstSession: boolean;
}

/** A context package with nothing in it — a brand-new member. */
export const EMPTY_SESSION_CONTEXT: NoorSessionContext = {
  displayName: null,
  preferredLanguage: 'en',
  memoryLines: [],
  goals: [],
  recentActions: [],
  followUps: [],
  helpfulTools: [],
  unhelpfulTools: [],
  journalLines: [],
  journalAccessAllowed: false,
  lastSessionGist: null,
  openGently: false,
  firstSession: true,
};
