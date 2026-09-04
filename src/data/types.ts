import type { InstrumentId, AssessmentLocale } from '@/assessments/types';
import type { SeverityBand } from '@/config/thresholds';
import type { ConsentType } from '@/memory/permissions';
import type { SafetyState, SafetyTriggerSource } from '@/safety/types';

export type UiLocale = 'en' | 'ur';
export type InteractionMode = 'audio' | 'text';

export type ConcernId =
  | 'anxiety'
  | 'low_mood'
  | 'stress'
  | 'overthinking'
  | 'grief'
  | 'relationships'
  | 'someone_to_talk_to'
  | 'something_else';

export const CONCERN_IDS: ConcernId[] = [
  'anxiety',
  'low_mood',
  'stress',
  'overthinking',
  'grief',
  'relationships',
  'someone_to_talk_to',
  'something_else',
];

export interface Profile {
  id: string;
  displayName: string | null;
  preferredLanguage: UiLocale;
  preferredMode: InteractionMode;
  /** When the member confirmed they are 18+. Null until onboarding step 2. */
  ageConfirmedAt: string | null;
  onboardingCompletedAt: string | null;
  primaryConcerns: ConcernId[];
  createdAt: string;
  updatedAt: string;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  version: string;
  recordedAt: string;
}

export interface AssessmentRun {
  id: string;
  userId: string;
  instrument: InstrumentId;
  locale: AssessmentLocale;
  responses: number[];
  totalScore: number;
  band: SeverityBand;
  flaggedSafetyItem: boolean;
  completedAt: string;
  sessionId: string | null;
}

export type SessionStatus = 'active' | 'ended' | 'abandoned';

export interface WellbeingSession {
  id: string;
  userId: string;
  mode: InteractionMode;
  status: SessionStatus;
  /** Member-controlled title. Null shows a generated fallback. */
  title: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  topicTags: string[];
  languageDetected: string | null;
  maxSafetyState: SafetyState;
  countedTowardsAllowance: boolean;
}

export type TurnRole = 'user' | 'noor' | 'system';

export interface SessionTurn {
  id: string;
  sessionId: string;
  userId: string;
  turnIndex: number;
  role: TurnRole;
  content: string;
  language: string | null;
  createdAt: string;
}

export interface SessionSummary {
  id: string;
  sessionId: string;
  userId: string;
  whatWeTalkedAbout: string;
  mostImportant: string;
  agreedActions: string[];
  recommendedExerciseSlug: string | null;
  goalBeforeNext: string | null;
  createdAt: string;
}

/**
 * Kinds of durable memory a session can propose.
 *
 * Mirrors the `memory_category` enum. Nothing here is saved automatically —
 * the member reviews proposals on the session summary and only the survivors
 * are written.
 */
export type MemoryCategory =
  | 'stressor'
  | 'relationship'
  | 'goal'
  | 'coping_preference'
  | 'topic_to_revisit'
  | 'agreed_action'
  | 'context'
  | 'communication_preference'
  | 'follow_up';

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  'stressor',
  'relationship',
  'goal',
  'coping_preference',
  'topic_to_revisit',
  'agreed_action',
  'context',
  'communication_preference',
  'follow_up',
];

export interface MemoryItem {
  id: string;
  userId: string;
  category: MemoryCategory;
  content: string;
  sourceSessionId: string | null;
  createdAt: string;
  lastReferencedAt: string | null;
}

export type GoalStatus = 'active' | 'completed' | 'let_go';

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  targetDate: string | null;
  sessionId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string | null;
  body: string;
  /** 1 (very low) – 5 (very good). */
  mood: number | null;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MoodCheckin {
  id: string;
  userId: string;
  mood: number;
  note: string | null;
  createdAt: string;
}

export interface SavedCopingTool {
  id: string;
  userId: string;
  toolSlug: string;
  note: string | null;
  savedAt: string;
}

export interface SafetyEvent {
  id: string;
  userId: string;
  sessionId: string | null;
  fromState: SafetyState;
  toState: SafetyState;
  triggerSource: SafetyTriggerSource;
  resourcesShown: boolean;
  humanSupportOffered: boolean;
  createdAt: string;
}

export interface UsageEntitlement {
  userId: string;
  plan: 'free' | 'supporter';
  freeSessionAllowance: number;
  sessionsUsed: number;
  updatedAt: string;
}

export type HumanSupportRequestType = 'talk_to_professional' | 'referral' | 'booking' | 'urgent';
export type HumanSupportRequestStatus = 'submitted' | 'reviewing' | 'matched' | 'closed';

export interface HumanSupportRequest {
  id: string;
  userId: string;
  requestType: HumanSupportRequestType;
  preferredContact: 'email' | 'phone' | 'in_app';
  preferredLanguage: UiLocale | 'mixed';
  note: string | null;
  status: HumanSupportRequestStatus;
  createdAt: string;
}

export type FollowUpStatus = 'open' | 'raised' | 'closed';

/**
 * Something the member asked Noor to check back on.
 *
 * Created only with their agreement. `raisedAt` exists so Noor asks once and
 * then lets it go: a follow-up is a kindness, not a debt the member owes.
 */
export interface FollowUpItem {
  id: string;
  userId: string;
  prompt: string;
  status: FollowUpStatus;
  sourceSessionId: string | null;
  /** Not raised before this time, when the member named a horizon. */
  dueAfter: string | null;
  raisedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewFollowUpItem {
  prompt: string;
  sourceSessionId?: string | null;
  dueAfter?: string | null;
}

/**
 * 'unknown' is the honest default for something suggested but never reported
 * back on — distinct from 'not_tried', which the member actually told us.
 */
export type CopingOutcome = 'suggested' | 'tried_helpful' | 'tried_unhelpful' | 'not_tried' | 'unknown';

/**
 * What a member has told us about an approach. Its whole purpose is the
 * negative case: never suggest again something they said did not help.
 */
export interface CopingPreference {
  id: string;
  userId: string;
  toolSlug: string;
  outcome: CopingOutcome;
  note: string | null;
  sourceSessionId: string | null;
  suggestedAt: string;
  reportedAt: string | null;
  updatedAt: string;
}

export interface NewCopingPreference {
  toolSlug: string;
  outcome: CopingOutcome;
  note?: string | null;
  sourceSessionId?: string | null;
}

/* ─── Input shapes ─────────────────────────────────────────────────────── */

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | 'displayName'
    | 'preferredLanguage'
    | 'preferredMode'
    | 'ageConfirmedAt'
    | 'onboardingCompletedAt'
    | 'primaryConcerns'
  >
>;

export interface NewAssessmentRun {
  instrument: InstrumentId;
  locale: AssessmentLocale;
  responses: number[];
  totalScore: number;
  band: SeverityBand;
  flaggedSafetyItem: boolean;
  sessionId?: string | null;
}

export interface NewSessionSummary {
  sessionId: string;
  whatWeTalkedAbout: string;
  mostImportant: string;
  agreedActions: string[];
  recommendedExerciseSlug: string | null;
  goalBeforeNext: string | null;
}

export interface NewMemoryItem {
  category: MemoryCategory;
  content: string;
  sourceSessionId: string | null;
}

export interface NewGoal {
  title: string;
  description?: string | null;
  targetDate?: string | null;
  sessionId?: string | null;
}

export interface NewJournalEntry {
  title?: string | null;
  body: string;
  mood?: number | null;
  sessionId?: string | null;
}

export interface NewSafetyEvent {
  sessionId: string | null;
  fromState: SafetyState;
  toState: SafetyState;
  triggerSource: SafetyTriggerSource;
  resourcesShown: boolean;
  humanSupportOffered: boolean;
}

export interface NewHumanSupportRequest {
  requestType: HumanSupportRequestType;
  preferredContact: HumanSupportRequest['preferredContact'];
  preferredLanguage: HumanSupportRequest['preferredLanguage'];
  note?: string | null;
}

export interface EndSessionInput {
  sessionId: string;
  durationSeconds: number;
  topicTags: string[];
  languageDetected: string | null;
  maxSafetyState: SafetyState;
  countedTowardsAllowance: boolean;
}
