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

export type MemoryCategory =
  | 'stressor'
  | 'relationship'
  | 'goal'
  | 'coping_preference'
  | 'topic_to_revisit'
  | 'agreed_action'
  | 'context';

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
