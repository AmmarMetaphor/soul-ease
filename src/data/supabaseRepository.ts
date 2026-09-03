import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { ConsentType } from '@/memory/permissions';
import { RepositoryError, type SoulEaseRepository } from './repository';
import type {
  AssessmentRun,
  ConsentRecord,
  EndSessionInput,
  Goal,
  GoalStatus,
  HumanSupportRequest,
  InteractionMode,
  JournalEntry,
  MemoryItem,
  MoodCheckin,
  NewAssessmentRun,
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

/* ─── Row shapes (snake_case, as stored) ─────────────────────────────── */

interface ProfileRow {
  id: string;
  display_name: string | null;
  preferred_language: Profile['preferredLanguage'];
  preferred_mode: Profile['preferredMode'];
  age_confirmed_at: string | null;
  onboarding_completed_at: string | null;
  primary_concerns: Profile['primaryConcerns'] | null;
  created_at: string;
  updated_at: string;
}

interface ConsentRow {
  id: string;
  user_id: string;
  consent_type: ConsentType;
  granted: boolean;
  version: string;
  recorded_at: string;
}

interface AssessmentRow {
  id: string;
  user_id: string;
  instrument: AssessmentRun['instrument'];
  locale: AssessmentRun['locale'];
  responses: number[];
  total_score: number;
  severity_band: AssessmentRun['band'];
  flagged_safety_item: boolean;
  completed_at: string;
  session_id: string | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  mode: InteractionMode;
  status: WellbeingSession['status'];
  title: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  topic_tags: string[] | null;
  language_detected: string | null;
  max_safety_state: WellbeingSession['maxSafetyState'];
  counted_towards_allowance: boolean;
}

interface TurnRow {
  id: string;
  session_id: string;
  user_id: string;
  turn_index: number;
  role: TurnRole;
  content: string;
  language: string | null;
  created_at: string;
}

interface SummaryRow {
  id: string;
  session_id: string;
  user_id: string;
  what_we_talked_about: string;
  most_important: string;
  agreed_actions: string[] | null;
  recommended_exercise_slug: string | null;
  goal_before_next: string | null;
  created_at: string;
}

interface MemoryRow {
  id: string;
  user_id: string;
  category: MemoryItem['category'];
  content: string;
  source_session_id: string | null;
  created_at: string;
  last_referenced_at: string | null;
}

interface GoalRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  target_date: string | null;
  session_id: string | null;
  created_at: string;
  completed_at: string | null;
}

interface JournalRow {
  id: string;
  user_id: string;
  title: string | null;
  body: string;
  mood: number | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MoodRow {
  id: string;
  user_id: string;
  mood: number;
  note: string | null;
  created_at: string;
}

interface ToolRow {
  id: string;
  user_id: string;
  tool_slug: string;
  note: string | null;
  saved_at: string;
}

interface SafetyRow {
  id: string;
  user_id: string;
  session_id: string | null;
  from_state: SafetyEvent['fromState'];
  to_state: SafetyEvent['toState'];
  trigger_source: SafetyEvent['triggerSource'];
  resources_shown: boolean;
  human_support_offered: boolean;
  created_at: string;
}

interface EntitlementRow {
  user_id: string;
  plan: UsageEntitlement['plan'];
  free_session_allowance: number;
  sessions_used: number;
  updated_at: string;
}

interface SupportRow {
  id: string;
  user_id: string;
  request_type: HumanSupportRequest['requestType'];
  preferred_contact: HumanSupportRequest['preferredContact'];
  preferred_language: HumanSupportRequest['preferredLanguage'];
  note: string | null;
  status: HumanSupportRequest['status'];
  created_at: string;
}

/* ─── Mappers ────────────────────────────────────────────────────────── */

const mapProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  displayName: r.display_name,
  preferredLanguage: r.preferred_language,
  preferredMode: r.preferred_mode,
  ageConfirmedAt: r.age_confirmed_at,
  onboardingCompletedAt: r.onboarding_completed_at,
  primaryConcerns: r.primary_concerns ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapConsent = (r: ConsentRow): ConsentRecord => ({
  id: r.id,
  userId: r.user_id,
  consentType: r.consent_type,
  granted: r.granted,
  version: r.version,
  recordedAt: r.recorded_at,
});

const mapAssessment = (r: AssessmentRow): AssessmentRun => ({
  id: r.id,
  userId: r.user_id,
  instrument: r.instrument,
  locale: r.locale,
  responses: r.responses,
  totalScore: r.total_score,
  band: r.severity_band,
  flaggedSafetyItem: r.flagged_safety_item,
  completedAt: r.completed_at,
  sessionId: r.session_id,
});

const mapSession = (r: SessionRow): WellbeingSession => ({
  id: r.id,
  userId: r.user_id,
  mode: r.mode,
  status: r.status,
  title: r.title,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  durationSeconds: r.duration_seconds,
  topicTags: r.topic_tags ?? [],
  languageDetected: r.language_detected,
  maxSafetyState: r.max_safety_state,
  countedTowardsAllowance: r.counted_towards_allowance,
});

const mapTurn = (r: TurnRow): SessionTurn => ({
  id: r.id,
  sessionId: r.session_id,
  userId: r.user_id,
  turnIndex: r.turn_index,
  role: r.role,
  content: r.content,
  language: r.language,
  createdAt: r.created_at,
});

const mapSummary = (r: SummaryRow): SessionSummary => ({
  id: r.id,
  sessionId: r.session_id,
  userId: r.user_id,
  whatWeTalkedAbout: r.what_we_talked_about,
  mostImportant: r.most_important,
  agreedActions: r.agreed_actions ?? [],
  recommendedExerciseSlug: r.recommended_exercise_slug,
  goalBeforeNext: r.goal_before_next,
  createdAt: r.created_at,
});

const mapMemory = (r: MemoryRow): MemoryItem => ({
  id: r.id,
  userId: r.user_id,
  category: r.category,
  content: r.content,
  sourceSessionId: r.source_session_id,
  createdAt: r.created_at,
  lastReferencedAt: r.last_referenced_at,
});

const mapGoal = (r: GoalRow): Goal => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  description: r.description,
  status: r.status,
  targetDate: r.target_date,
  sessionId: r.session_id,
  createdAt: r.created_at,
  completedAt: r.completed_at,
});

const mapJournal = (r: JournalRow): JournalEntry => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  body: r.body,
  mood: r.mood,
  sessionId: r.session_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapMood = (r: MoodRow): MoodCheckin => ({
  id: r.id,
  userId: r.user_id,
  mood: r.mood,
  note: r.note,
  createdAt: r.created_at,
});

const mapTool = (r: ToolRow): SavedCopingTool => ({
  id: r.id,
  userId: r.user_id,
  toolSlug: r.tool_slug,
  note: r.note,
  savedAt: r.saved_at,
});

const mapSafety = (r: SafetyRow): SafetyEvent => ({
  id: r.id,
  userId: r.user_id,
  sessionId: r.session_id,
  fromState: r.from_state,
  toState: r.to_state,
  triggerSource: r.trigger_source,
  resourcesShown: r.resources_shown,
  humanSupportOffered: r.human_support_offered,
  createdAt: r.created_at,
});

const mapEntitlement = (r: EntitlementRow): UsageEntitlement => ({
  userId: r.user_id,
  plan: r.plan,
  freeSessionAllowance: r.free_session_allowance,
  sessionsUsed: r.sessions_used,
  updatedAt: r.updated_at,
});

const mapSupport = (r: SupportRow): HumanSupportRequest => ({
  id: r.id,
  userId: r.user_id,
  requestType: r.request_type,
  preferredContact: r.preferred_contact,
  preferredLanguage: r.preferred_language,
  note: r.note,
  status: r.status,
  createdAt: r.created_at,
});

function fail(action: string, error: PostgrestError | Error | null): never {
  const message = error?.message ?? 'Unknown error';
  if (/ENTITLEMENT_EXHAUSTED/.test(message)) throw new RepositoryError('ENTITLEMENT_EXHAUSTED', error);
  throw new RepositoryError(`${action} failed: ${message}`, error);
}

/**
 * Production repository. Every query runs as the signed-in member; Postgres
 * Row Level Security ensures a member can only ever touch their own rows.
 * Sensitive operations (starting/ending sessions with entitlement accounting,
 * account deletion) go through SECURITY DEFINER functions defined in the
 * migrations so business rules cannot be bypassed from the client.
 */
export class SupabaseRepository implements SoulEaseRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  /* ─── Profile & consent ─────────────────────────────────────────────── */

  async getProfile(): Promise<Profile> {
    const { data, error } = await this.client.from('profiles').select('*').eq('id', this.userId).maybeSingle();
    if (error) fail('Loading profile', error);
    if (data) return mapProfile(data as ProfileRow);
    // The auth trigger normally creates the row; recover gracefully if it
    // has not run yet (e.g. race right after sign-up).
    const { data: created, error: insertError } = await this.client
      .from('profiles')
      .insert({ id: this.userId })
      .select('*')
      .single();
    if (insertError) fail('Creating profile', insertError);
    return mapProfile(created as ProfileRow);
  }

  async updateProfile(update: ProfileUpdate): Promise<Profile> {
    const patch: Partial<ProfileRow> = {};
    if (update.displayName !== undefined) patch.display_name = update.displayName;
    if (update.preferredLanguage !== undefined) patch.preferred_language = update.preferredLanguage;
    if (update.preferredMode !== undefined) patch.preferred_mode = update.preferredMode;
    if (update.ageConfirmedAt !== undefined) patch.age_confirmed_at = update.ageConfirmedAt;
    if (update.onboardingCompletedAt !== undefined) patch.onboarding_completed_at = update.onboardingCompletedAt;
    if (update.primaryConcerns !== undefined) patch.primary_concerns = update.primaryConcerns;
    const { data, error } = await this.client
      .from('profiles')
      .update(patch)
      .eq('id', this.userId)
      .select('*')
      .single();
    if (error) fail('Updating profile', error);
    return mapProfile(data as ProfileRow);
  }

  async listConsents(): Promise<ConsentRecord[]> {
    const { data, error } = await this.client
      .from('consent_records')
      .select('*')
      .eq('user_id', this.userId)
      .order('recorded_at', { ascending: true });
    if (error) fail('Loading consents', error);
    return (data as ConsentRow[]).map(mapConsent);
  }

  async recordConsent(consentType: ConsentType, granted: boolean, version: string): Promise<ConsentRecord> {
    const { data, error } = await this.client
      .from('consent_records')
      .insert({ user_id: this.userId, consent_type: consentType, granted, version })
      .select('*')
      .single();
    if (error) fail('Recording consent', error);
    return mapConsent(data as ConsentRow);
  }

  /* ─── Assessments ───────────────────────────────────────────────────── */

  async listAssessmentRuns(): Promise<AssessmentRun[]> {
    const { data, error } = await this.client
      .from('assessment_runs')
      .select('*')
      .eq('user_id', this.userId)
      .order('completed_at', { ascending: false });
    if (error) fail('Loading assessments', error);
    return (data as AssessmentRow[]).map(mapAssessment);
  }

  async createAssessmentRun(input: NewAssessmentRun): Promise<AssessmentRun> {
    const { data, error } = await this.client
      .from('assessment_runs')
      .insert({
        user_id: this.userId,
        instrument: input.instrument,
        locale: input.locale,
        responses: input.responses,
        total_score: input.totalScore,
        severity_band: input.band,
        flagged_safety_item: input.flaggedSafetyItem,
        session_id: input.sessionId ?? null,
      })
      .select('*')
      .single();
    if (error) fail('Saving assessment', error);
    return mapAssessment(data as AssessmentRow);
  }

  /* ─── Sessions ──────────────────────────────────────────────────────── */

  async listSessions(): Promise<WellbeingSession[]> {
    const { data, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('user_id', this.userId)
      .order('started_at', { ascending: false });
    if (error) fail('Loading sessions', error);
    return (data as SessionRow[]).map(mapSession);
  }

  async getSession(id: string): Promise<WellbeingSession | null> {
    const { data, error } = await this.client.from('sessions').select('*').eq('id', id).maybeSingle();
    if (error) fail('Loading session', error);
    return data ? mapSession(data as SessionRow) : null;
  }

  async startSession(mode: InteractionMode): Promise<WellbeingSession> {
    const { data, error } = await this.client.rpc('start_wellbeing_session', { p_mode: mode });
    if (error) fail('Starting session', error);
    return mapSession(data as SessionRow);
  }

  async endSession(input: EndSessionInput): Promise<WellbeingSession> {
    const { data, error } = await this.client.rpc('end_wellbeing_session', {
      p_session_id: input.sessionId,
      p_duration_seconds: input.durationSeconds,
      p_topic_tags: input.topicTags,
      p_language_detected: input.languageDetected,
      p_max_safety_state: input.maxSafetyState,
      p_count_towards_allowance: input.countedTowardsAllowance,
    });
    if (error) fail('Ending session', error);
    return mapSession(data as SessionRow);
  }

  async renameSession(id: string, title: string | null): Promise<WellbeingSession> {
    const { data, error } = await this.client.from('sessions').update({ title }).eq('id', id).select('*').single();
    if (error) fail('Renaming session', error);
    return mapSession(data as SessionRow);
  }

  async deleteSession(id: string): Promise<void> {
    const { error } = await this.client.from('sessions').delete().eq('id', id);
    if (error) fail('Deleting session', error);
  }

  async appendTurn(sessionId: string, role: TurnRole, content: string, language: string | null): Promise<SessionTurn> {
    const { count, error: countError } = await this.client
      .from('session_turns')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId);
    if (countError) fail('Counting turns', countError);
    const { data, error } = await this.client
      .from('session_turns')
      .insert({ session_id: sessionId, user_id: this.userId, turn_index: count ?? 0, role, content, language })
      .select('*')
      .single();
    if (error) fail('Saving turn', error);
    return mapTurn(data as TurnRow);
  }

  async listTurns(sessionId: string): Promise<SessionTurn[]> {
    const { data, error } = await this.client
      .from('session_turns')
      .select('*')
      .eq('session_id', sessionId)
      .order('turn_index', { ascending: true });
    if (error) fail('Loading transcript', error);
    return (data as TurnRow[]).map(mapTurn);
  }

  async getSummary(sessionId: string): Promise<SessionSummary | null> {
    const { data, error } = await this.client
      .from('session_summaries')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) fail('Loading summary', error);
    return data ? mapSummary(data as SummaryRow) : null;
  }

  async saveSummary(input: NewSessionSummary): Promise<SessionSummary> {
    const { data, error } = await this.client
      .from('session_summaries')
      .upsert(
        {
          session_id: input.sessionId,
          user_id: this.userId,
          what_we_talked_about: input.whatWeTalkedAbout,
          most_important: input.mostImportant,
          agreed_actions: input.agreedActions,
          recommended_exercise_slug: input.recommendedExerciseSlug,
          goal_before_next: input.goalBeforeNext,
        },
        { onConflict: 'session_id' },
      )
      .select('*')
      .single();
    if (error) fail('Saving summary', error);
    return mapSummary(data as SummaryRow);
  }

  /* ─── Memory ────────────────────────────────────────────────────────── */

  async listMemories(): Promise<MemoryItem[]> {
    const { data, error } = await this.client
      .from('memory_items')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false });
    if (error) fail('Loading memories', error);
    return (data as MemoryRow[]).map(mapMemory);
  }

  async addMemories(items: NewMemoryItem[]): Promise<MemoryItem[]> {
    if (items.length === 0) return [];
    const { data, error } = await this.client
      .from('memory_items')
      .insert(
        items.map((item) => ({
          user_id: this.userId,
          category: item.category,
          content: item.content,
          source_session_id: item.sourceSessionId,
        })),
      )
      .select('*');
    if (error) fail('Saving memories', error);
    return (data as MemoryRow[]).map(mapMemory);
  }

  async deleteMemory(id: string): Promise<void> {
    const { error } = await this.client.from('memory_items').delete().eq('id', id);
    if (error) fail('Deleting memory', error);
  }

  async deleteAllMemories(): Promise<void> {
    const { error } = await this.client.from('memory_items').delete().eq('user_id', this.userId);
    if (error) fail('Deleting memories', error);
  }

  /* ─── Goals ─────────────────────────────────────────────────────────── */

  async listGoals(): Promise<Goal[]> {
    const { data, error } = await this.client
      .from('goals')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false });
    if (error) fail('Loading goals', error);
    return (data as GoalRow[]).map(mapGoal);
  }

  async createGoal(input: NewGoal): Promise<Goal> {
    const { data, error } = await this.client
      .from('goals')
      .insert({
        user_id: this.userId,
        title: input.title,
        description: input.description ?? null,
        target_date: input.targetDate ?? null,
        session_id: input.sessionId ?? null,
      })
      .select('*')
      .single();
    if (error) fail('Creating goal', error);
    return mapGoal(data as GoalRow);
  }

  async updateGoalStatus(id: string, status: GoalStatus): Promise<Goal> {
    const { data, error } = await this.client
      .from('goals')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
      .eq('id', id)
      .select('*')
      .single();
    if (error) fail('Updating goal', error);
    return mapGoal(data as GoalRow);
  }

  async deleteGoal(id: string): Promise<void> {
    const { error } = await this.client.from('goals').delete().eq('id', id);
    if (error) fail('Deleting goal', error);
  }

  /* ─── Journal ───────────────────────────────────────────────────────── */

  async listJournalEntries(): Promise<JournalEntry[]> {
    const { data, error } = await this.client
      .from('journal_entries')
      .select('*')
      .eq('user_id', this.userId)
      .order('updated_at', { ascending: false });
    if (error) fail('Loading journal', error);
    return (data as JournalRow[]).map(mapJournal);
  }

  async createJournalEntry(input: NewJournalEntry): Promise<JournalEntry> {
    const { data, error } = await this.client
      .from('journal_entries')
      .insert({
        user_id: this.userId,
        title: input.title ?? null,
        body: input.body,
        mood: input.mood ?? null,
        session_id: input.sessionId ?? null,
      })
      .select('*')
      .single();
    if (error) fail('Saving journal entry', error);
    return mapJournal(data as JournalRow);
  }

  async updateJournalEntry(id: string, input: NewJournalEntry): Promise<JournalEntry> {
    const { data, error } = await this.client
      .from('journal_entries')
      .update({ title: input.title ?? null, body: input.body, mood: input.mood ?? null })
      .eq('id', id)
      .select('*')
      .single();
    if (error) fail('Updating journal entry', error);
    return mapJournal(data as JournalRow);
  }

  async deleteJournalEntry(id: string): Promise<void> {
    const { error } = await this.client.from('journal_entries').delete().eq('id', id);
    if (error) fail('Deleting journal entry', error);
  }

  /* ─── Mood ──────────────────────────────────────────────────────────── */

  async listMoodCheckins(limit = 14): Promise<MoodCheckin[]> {
    const { data, error } = await this.client
      .from('mood_checkins')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) fail('Loading mood check-ins', error);
    return (data as MoodRow[]).map(mapMood);
  }

  async addMoodCheckin(mood: number, note: string | null): Promise<MoodCheckin> {
    const { data, error } = await this.client
      .from('mood_checkins')
      .insert({ user_id: this.userId, mood, note })
      .select('*')
      .single();
    if (error) fail('Saving mood', error);
    return mapMood(data as MoodRow);
  }

  /* ─── Coping tools ──────────────────────────────────────────────────── */

  async listSavedTools(): Promise<SavedCopingTool[]> {
    const { data, error } = await this.client.from('saved_coping_tools').select('*').eq('user_id', this.userId);
    if (error) fail('Loading saved tools', error);
    return (data as ToolRow[]).map(mapTool);
  }

  async saveTool(toolSlug: string): Promise<SavedCopingTool> {
    const { data, error } = await this.client
      .from('saved_coping_tools')
      .upsert({ user_id: this.userId, tool_slug: toolSlug }, { onConflict: 'user_id,tool_slug' })
      .select('*')
      .single();
    if (error) fail('Saving tool', error);
    return mapTool(data as ToolRow);
  }

  async unsaveTool(toolSlug: string): Promise<void> {
    const { error } = await this.client
      .from('saved_coping_tools')
      .delete()
      .eq('user_id', this.userId)
      .eq('tool_slug', toolSlug);
    if (error) fail('Removing saved tool', error);
  }

  /* ─── Safety ────────────────────────────────────────────────────────── */

  async logSafetyEvent(input: NewSafetyEvent): Promise<SafetyEvent> {
    const { data, error } = await this.client
      .from('safety_events')
      .insert({
        user_id: this.userId,
        session_id: input.sessionId,
        from_state: input.fromState,
        to_state: input.toState,
        trigger_source: input.triggerSource,
        resources_shown: input.resourcesShown,
        human_support_offered: input.humanSupportOffered,
      })
      .select('*')
      .single();
    if (error) fail('Logging safety event', error);
    return mapSafety(data as SafetyRow);
  }

  /* ─── Entitlement ───────────────────────────────────────────────────── */

  async getEntitlement(): Promise<UsageEntitlement> {
    const { data, error } = await this.client
      .from('usage_entitlements')
      .select('*')
      .eq('user_id', this.userId)
      .maybeSingle();
    if (error) fail('Loading entitlement', error);
    if (data) return mapEntitlement(data as EntitlementRow);
    const { data: created, error: insertError } = await this.client
      .from('usage_entitlements')
      .insert({ user_id: this.userId })
      .select('*')
      .single();
    if (insertError) fail('Creating entitlement', insertError);
    return mapEntitlement(created as EntitlementRow);
  }

  /* ─── Human support ─────────────────────────────────────────────────── */

  async listHumanSupportRequests(): Promise<HumanSupportRequest[]> {
    const { data, error } = await this.client
      .from('human_support_requests')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false });
    if (error) fail('Loading support requests', error);
    return (data as SupportRow[]).map(mapSupport);
  }

  async createHumanSupportRequest(input: NewHumanSupportRequest): Promise<HumanSupportRequest> {
    const { data, error } = await this.client
      .from('human_support_requests')
      .insert({
        user_id: this.userId,
        request_type: input.requestType,
        preferred_contact: input.preferredContact,
        preferred_language: input.preferredLanguage,
        note: input.note ?? null,
      })
      .select('*')
      .single();
    if (error) fail('Submitting support request', error);
    return mapSupport(data as SupportRow);
  }

  /* ─── Account ───────────────────────────────────────────────────────── */

  async deleteAccount(): Promise<void> {
    const { error } = await this.client.rpc('delete_my_account');
    if (error) fail('Deleting account', error);
  }
}
