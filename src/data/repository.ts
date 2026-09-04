import type { ConsentType } from '@/memory/permissions';
import type {
  AssessmentRun,
  ConsentRecord,
  CopingPreference,
  EndSessionInput,
  FollowUpItem,
  FollowUpStatus,
  Goal,
  GoalStatus,
  HumanSupportRequest,
  InteractionMode,
  JournalEntry,
  MemoryItem,
  MoodCheckin,
  NewAssessmentRun,
  NewCopingPreference,
  NewFollowUpItem,
  NewGoal,
  NewHumanSupportRequest,
  NewJournalEntry,
  NewMemoryItem,
  NewSafetyEvent,
  NewSessionSummary,
  Profile,
  ProfileUpdate,
  SafetyEvent,
  SavedCopingTool,
  SessionSummary,
  SessionTurn,
  TurnRole,
  UsageEntitlement,
  WellbeingSession,
} from './types';

/**
 * The single data-access contract used by the UI.
 *
 * Two implementations exist:
 *  - SupabaseRepository — production path, RLS-protected Postgres.
 *  - DemoRepository     — browser-local storage used when Supabase is not
 *                         configured, so the product can be reviewed safely.
 *
 * Every method is scoped to the authenticated member; implementations must
 * never accept a foreign user id.
 */
export interface SoulEaseRepository {
  /* Profile & consent */
  getProfile(): Promise<Profile>;
  updateProfile(update: ProfileUpdate): Promise<Profile>;
  listConsents(): Promise<ConsentRecord[]>;
  recordConsent(consentType: ConsentType, granted: boolean, version: string): Promise<ConsentRecord>;

  /* Assessments */
  listAssessmentRuns(): Promise<AssessmentRun[]>;
  createAssessmentRun(input: NewAssessmentRun): Promise<AssessmentRun>;

  /* Sessions */
  listSessions(): Promise<WellbeingSession[]>;
  getSession(id: string): Promise<WellbeingSession | null>;
  startSession(mode: InteractionMode): Promise<WellbeingSession>;
  endSession(input: EndSessionInput): Promise<WellbeingSession>;
  renameSession(id: string, title: string | null): Promise<WellbeingSession>;
  deleteSession(id: string): Promise<void>;
  appendTurn(sessionId: string, role: TurnRole, content: string, language: string | null): Promise<SessionTurn>;
  listTurns(sessionId: string): Promise<SessionTurn[]>;
  getSummary(sessionId: string): Promise<SessionSummary | null>;
  saveSummary(input: NewSessionSummary): Promise<SessionSummary>;

  /* Memory */
  listMemories(): Promise<MemoryItem[]>;
  addMemories(items: NewMemoryItem[]): Promise<MemoryItem[]>;
  deleteMemory(id: string): Promise<void>;
  deleteAllMemories(): Promise<void>;

  /* Goals */
  listGoals(): Promise<Goal[]>;
  createGoal(input: NewGoal): Promise<Goal>;
  updateGoalStatus(id: string, status: GoalStatus): Promise<Goal>;
  deleteGoal(id: string): Promise<void>;

  /* Journal */
  listJournalEntries(): Promise<JournalEntry[]>;
  createJournalEntry(input: NewJournalEntry): Promise<JournalEntry>;
  updateJournalEntry(id: string, input: NewJournalEntry): Promise<JournalEntry>;
  deleteJournalEntry(id: string): Promise<void>;

  /* Mood */
  listMoodCheckins(limit?: number): Promise<MoodCheckin[]>;
  addMoodCheckin(mood: number, note: string | null): Promise<MoodCheckin>;

  /* Coping tools */
  listSavedTools(): Promise<SavedCopingTool[]>;
  saveTool(toolSlug: string): Promise<SavedCopingTool>;
  unsaveTool(toolSlug: string): Promise<void>;

  /**
   * Coping preferences — what has and has not helped.
   *
   * Read at session start so Noor never re-suggests something the member
   * already said did not work for them.
   */
  listCopingPreferences(): Promise<CopingPreference[]>;
  recordCopingPreference(input: NewCopingPreference): Promise<CopingPreference>;
  deleteCopingPreference(id: string): Promise<void>;

  /* Follow-ups the member asked Noor to remember */
  listFollowUps(status?: FollowUpStatus): Promise<FollowUpItem[]>;
  createFollowUp(input: NewFollowUpItem): Promise<FollowUpItem>;
  updateFollowUpStatus(id: string, status: FollowUpStatus): Promise<FollowUpItem>;
  deleteFollowUp(id: string): Promise<void>;

  /* Safety */
  logSafetyEvent(input: NewSafetyEvent): Promise<SafetyEvent>;

  /* Entitlement */
  getEntitlement(): Promise<UsageEntitlement>;

  /* Human support */
  listHumanSupportRequests(): Promise<HumanSupportRequest[]>;
  createHumanSupportRequest(input: NewHumanSupportRequest): Promise<HumanSupportRequest>;

  /* Account */
  deleteAccount(): Promise<void>;
}

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}
