import { FREE_SESSION_ALLOWANCE } from '@/config/app';
import { newId, nowIso } from '@/lib/ids';
import type { ConsentType } from '@/memory/permissions';
import { RepositoryError, type SoulEaseRepository } from './repository';
import type {
  AssessmentRun,
  ConsentRecord,
  CopingPreference,
  FollowUpItem,
  FollowUpStatus,
  NewCopingPreference,
  NewFollowUpItem,
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

type Collection =
  | 'profile'
  | 'consents'
  | 'assessments'
  | 'sessions'
  | 'turns'
  | 'summaries'
  | 'memories'
  | 'goals'
  | 'journal'
  | 'moods'
  | 'tools'
  | 'copingPreferences'
  | 'followUps'
  | 'safety'
  | 'entitlement'
  | 'support';

/**
 * DEMO MODE repository — everything lives in this browser's localStorage,
 * namespaced per demo user. Mirrors the Supabase implementation so the UI is
 * identical in both modes. Not encrypted; not for real member data.
 */
export class DemoRepository implements SoulEaseRepository {
  constructor(private readonly userId: string) {}

  /* ─── storage helpers ───────────────────────────────────────────────── */

  private key(collection: Collection): string {
    return `soulease:demo:${this.userId}:${collection}`;
  }

  private read<T>(collection: Collection): T[] {
    try {
      const raw = localStorage.getItem(this.key(collection));
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch (error) {
      throw new RepositoryError(`Could not read local ${collection}.`, error);
    }
  }

  private write<T>(collection: Collection, items: T[]): void {
    try {
      localStorage.setItem(this.key(collection), JSON.stringify(items));
    } catch (error) {
      throw new RepositoryError(`Could not save local ${collection}. Storage may be full.`, error);
    }
  }

  private readOne<T>(collection: Collection): T | null {
    return this.read<T>(collection)[0] ?? null;
  }

  private writeOne<T>(collection: Collection, item: T): void {
    this.write(collection, [item]);
  }

  /* ─── Profile & consent ─────────────────────────────────────────────── */

  async getProfile(): Promise<Profile> {
    const existing = this.readOne<Profile>('profile');
    if (existing) return existing;
    const created: Profile = {
      id: this.userId,
      displayName: null,
      preferredLanguage: 'en',
      preferredMode: 'audio',
      ageConfirmedAt: null,
      onboardingCompletedAt: null,
      primaryConcerns: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.writeOne('profile', created);
    return created;
  }

  async updateProfile(update: ProfileUpdate): Promise<Profile> {
    const current = await this.getProfile();
    const next: Profile = { ...current, ...update, updatedAt: nowIso() };
    this.writeOne('profile', next);
    return next;
  }

  async listConsents(): Promise<ConsentRecord[]> {
    return this.read<ConsentRecord>('consents');
  }

  async recordConsent(consentType: ConsentType, granted: boolean, version: string): Promise<ConsentRecord> {
    const record: ConsentRecord = {
      id: newId(),
      userId: this.userId,
      consentType,
      granted,
      version,
      recordedAt: nowIso(),
    };
    this.write('consents', [...this.read<ConsentRecord>('consents'), record]);
    return record;
  }

  /* ─── Assessments ───────────────────────────────────────────────────── */

  async listAssessmentRuns(): Promise<AssessmentRun[]> {
    return this.read<AssessmentRun>('assessments').sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  async createAssessmentRun(input: NewAssessmentRun): Promise<AssessmentRun> {
    const run: AssessmentRun = {
      id: newId(),
      userId: this.userId,
      instrument: input.instrument,
      locale: input.locale,
      responses: input.responses,
      totalScore: input.totalScore,
      band: input.band,
      flaggedSafetyItem: input.flaggedSafetyItem,
      completedAt: nowIso(),
      sessionId: input.sessionId ?? null,
    };
    this.write('assessments', [...this.read<AssessmentRun>('assessments'), run]);
    return run;
  }

  /* ─── Sessions ──────────────────────────────────────────────────────── */

  async listSessions(): Promise<WellbeingSession[]> {
    return this.read<WellbeingSession>('sessions').sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getSession(id: string): Promise<WellbeingSession | null> {
    return this.read<WellbeingSession>('sessions').find((s) => s.id === id) ?? null;
  }

  async startSession(mode: InteractionMode): Promise<WellbeingSession> {
    const entitlement = await this.getEntitlement();
    if (entitlement.plan === 'free' && entitlement.sessionsUsed >= entitlement.freeSessionAllowance) {
      throw new RepositoryError('ENTITLEMENT_EXHAUSTED');
    }
    const session: WellbeingSession = {
      id: newId(),
      userId: this.userId,
      mode,
      status: 'active',
      title: null,
      startedAt: nowIso(),
      endedAt: null,
      durationSeconds: null,
      topicTags: [],
      languageDetected: null,
      maxSafetyState: 'NORMAL',
      countedTowardsAllowance: false,
    };
    this.write('sessions', [...this.read<WellbeingSession>('sessions'), session]);
    return session;
  }

  async endSession(input: EndSessionInput): Promise<WellbeingSession> {
    const sessions = this.read<WellbeingSession>('sessions');
    const idx = sessions.findIndex((s) => s.id === input.sessionId);
    if (idx === -1) throw new RepositoryError('Session not found.');
    const current = sessions[idx];
    const shouldCount = input.countedTowardsAllowance && !current.countedTowardsAllowance;
    const updated: WellbeingSession = {
      ...current,
      status: 'ended',
      endedAt: nowIso(),
      durationSeconds: input.durationSeconds,
      topicTags: input.topicTags,
      languageDetected: input.languageDetected,
      maxSafetyState: input.maxSafetyState,
      countedTowardsAllowance: current.countedTowardsAllowance || input.countedTowardsAllowance,
    };
    sessions[idx] = updated;
    this.write('sessions', sessions);
    if (shouldCount) {
      const entitlement = await this.getEntitlement();
      this.writeOne<UsageEntitlement>('entitlement', {
        ...entitlement,
        sessionsUsed: entitlement.sessionsUsed + 1,
        updatedAt: nowIso(),
      });
    }
    return updated;
  }

  async renameSession(id: string, title: string | null): Promise<WellbeingSession> {
    const sessions = this.read<WellbeingSession>('sessions');
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx === -1) throw new RepositoryError('Session not found.');
    sessions[idx] = { ...sessions[idx], title };
    this.write('sessions', sessions);
    return sessions[idx];
  }

  async deleteSession(id: string): Promise<void> {
    this.write('sessions', this.read<WellbeingSession>('sessions').filter((s) => s.id !== id));
    this.write('turns', this.read<SessionTurn>('turns').filter((t) => t.sessionId !== id));
    this.write('summaries', this.read<SessionSummary>('summaries').filter((s) => s.sessionId !== id));
  }

  async appendTurn(sessionId: string, role: TurnRole, content: string, language: string | null): Promise<SessionTurn> {
    const turns = this.read<SessionTurn>('turns');
    const turn: SessionTurn = {
      id: newId(),
      sessionId,
      userId: this.userId,
      turnIndex: turns.filter((t) => t.sessionId === sessionId).length,
      role,
      content,
      language,
      createdAt: nowIso(),
    };
    this.write('turns', [...turns, turn]);
    return turn;
  }

  async listTurns(sessionId: string): Promise<SessionTurn[]> {
    return this.read<SessionTurn>('turns')
      .filter((t) => t.sessionId === sessionId)
      .sort((a, b) => a.turnIndex - b.turnIndex);
  }

  async getSummary(sessionId: string): Promise<SessionSummary | null> {
    return this.read<SessionSummary>('summaries').find((s) => s.sessionId === sessionId) ?? null;
  }

  async saveSummary(input: NewSessionSummary): Promise<SessionSummary> {
    const summaries = this.read<SessionSummary>('summaries').filter((s) => s.sessionId !== input.sessionId);
    const summary: SessionSummary = {
      id: newId(),
      userId: this.userId,
      sessionId: input.sessionId,
      whatWeTalkedAbout: input.whatWeTalkedAbout,
      mostImportant: input.mostImportant,
      agreedActions: input.agreedActions,
      recommendedExerciseSlug: input.recommendedExerciseSlug,
      goalBeforeNext: input.goalBeforeNext,
      createdAt: nowIso(),
    };
    this.write('summaries', [...summaries, summary]);
    return summary;
  }

  /* ─── Memory ────────────────────────────────────────────────────────── */

  async listMemories(): Promise<MemoryItem[]> {
    return this.read<MemoryItem>('memories').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addMemories(items: NewMemoryItem[]): Promise<MemoryItem[]> {
    const created = items.map<MemoryItem>((item) => ({
      id: newId(),
      userId: this.userId,
      category: item.category,
      content: item.content,
      sourceSessionId: item.sourceSessionId,
      createdAt: nowIso(),
      lastReferencedAt: null,
    }));
    this.write('memories', [...this.read<MemoryItem>('memories'), ...created]);
    return created;
  }

  async deleteMemory(id: string): Promise<void> {
    this.write('memories', this.read<MemoryItem>('memories').filter((m) => m.id !== id));
  }

  async deleteAllMemories(): Promise<void> {
    this.write('memories', []);
  }

  /* ─── Goals ─────────────────────────────────────────────────────────── */

  async listGoals(): Promise<Goal[]> {
    return this.read<Goal>('goals').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createGoal(input: NewGoal): Promise<Goal> {
    const goal: Goal = {
      id: newId(),
      userId: this.userId,
      title: input.title,
      description: input.description ?? null,
      status: 'active',
      targetDate: input.targetDate ?? null,
      sessionId: input.sessionId ?? null,
      createdAt: nowIso(),
      completedAt: null,
    };
    this.write('goals', [...this.read<Goal>('goals'), goal]);
    return goal;
  }

  async updateGoalStatus(id: string, status: GoalStatus): Promise<Goal> {
    const goals = this.read<Goal>('goals');
    const idx = goals.findIndex((g) => g.id === id);
    if (idx === -1) throw new RepositoryError('Goal not found.');
    goals[idx] = { ...goals[idx], status, completedAt: status === 'completed' ? nowIso() : null };
    this.write('goals', goals);
    return goals[idx];
  }

  async deleteGoal(id: string): Promise<void> {
    this.write('goals', this.read<Goal>('goals').filter((g) => g.id !== id));
  }

  /* ─── Journal ───────────────────────────────────────────────────────── */

  async listJournalEntries(): Promise<JournalEntry[]> {
    return this.read<JournalEntry>('journal').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createJournalEntry(input: NewJournalEntry): Promise<JournalEntry> {
    const entry: JournalEntry = {
      id: newId(),
      userId: this.userId,
      title: input.title ?? null,
      body: input.body,
      mood: input.mood ?? null,
      sessionId: input.sessionId ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.write('journal', [...this.read<JournalEntry>('journal'), entry]);
    return entry;
  }

  async updateJournalEntry(id: string, input: NewJournalEntry): Promise<JournalEntry> {
    const entries = this.read<JournalEntry>('journal');
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) throw new RepositoryError('Journal entry not found.');
    entries[idx] = {
      ...entries[idx],
      title: input.title ?? null,
      body: input.body,
      mood: input.mood ?? null,
      sessionId: input.sessionId ?? entries[idx].sessionId,
      updatedAt: nowIso(),
    };
    this.write('journal', entries);
    return entries[idx];
  }

  async deleteJournalEntry(id: string): Promise<void> {
    this.write('journal', this.read<JournalEntry>('journal').filter((e) => e.id !== id));
  }

  /* ─── Mood ──────────────────────────────────────────────────────────── */

  async listMoodCheckins(limit = 14): Promise<MoodCheckin[]> {
    return this.read<MoodCheckin>('moods')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async addMoodCheckin(mood: number, note: string | null): Promise<MoodCheckin> {
    const checkin: MoodCheckin = { id: newId(), userId: this.userId, mood, note, createdAt: nowIso() };
    this.write('moods', [...this.read<MoodCheckin>('moods'), checkin]);
    return checkin;
  }

  /* ─── Coping tools ──────────────────────────────────────────────────── */

  async listSavedTools(): Promise<SavedCopingTool[]> {
    return this.read<SavedCopingTool>('tools');
  }

  async saveTool(toolSlug: string): Promise<SavedCopingTool> {
    const tools = this.read<SavedCopingTool>('tools');
    const existing = tools.find((t) => t.toolSlug === toolSlug);
    if (existing) return existing;
    const saved: SavedCopingTool = { id: newId(), userId: this.userId, toolSlug, note: null, savedAt: nowIso() };
    this.write('tools', [...tools, saved]);
    return saved;
  }

  async unsaveTool(toolSlug: string): Promise<void> {
    this.write('tools', this.read<SavedCopingTool>('tools').filter((t) => t.toolSlug !== toolSlug));
  }

  /* ─── Coping preferences ────────────────────────────────────────────── */

  async listCopingPreferences(): Promise<CopingPreference[]> {
    return this.read<CopingPreference>('copingPreferences');
  }

  /** One row per approach: a later report replaces an earlier one. */
  async recordCopingPreference(input: NewCopingPreference): Promise<CopingPreference> {
    const rows = this.read<CopingPreference>('copingPreferences');
    const existing = rows.find((r) => r.toolSlug === input.toolSlug);
    const now = nowIso();
    const row: CopingPreference = {
      id: existing?.id ?? newId(),
      userId: this.userId,
      toolSlug: input.toolSlug,
      outcome: input.outcome,
      note: input.note ?? null,
      sourceSessionId: input.sourceSessionId ?? null,
      suggestedAt: existing?.suggestedAt ?? now,
      reportedAt: input.outcome === 'suggested' ? null : now,
      updatedAt: now,
    };
    this.write('copingPreferences', [...rows.filter((r) => r.toolSlug !== input.toolSlug), row]);
    return row;
  }

  async deleteCopingPreference(id: string): Promise<void> {
    this.write('copingPreferences', this.read<CopingPreference>('copingPreferences').filter((r) => r.id !== id));
  }

  /* ─── Follow-ups ────────────────────────────────────────────────────── */

  async listFollowUps(status?: FollowUpStatus): Promise<FollowUpItem[]> {
    const rows = this.read<FollowUpItem>('followUps');
    return (status ? rows.filter((r) => r.status === status) : rows).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async createFollowUp(input: NewFollowUpItem): Promise<FollowUpItem> {
    const now = nowIso();
    const row: FollowUpItem = {
      id: newId(),
      userId: this.userId,
      prompt: input.prompt,
      status: 'open',
      sourceSessionId: input.sourceSessionId ?? null,
      dueAfter: input.dueAfter ?? null,
      raisedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.write('followUps', [...this.read<FollowUpItem>('followUps'), row]);
    return row;
  }

  async updateFollowUpStatus(id: string, status: FollowUpStatus): Promise<FollowUpItem> {
    const rows = this.read<FollowUpItem>('followUps');
    const found = rows.find((r) => r.id === id);
    if (!found) throw new RepositoryError('Follow-up not found');
    const updated: FollowUpItem = {
      ...found,
      status,
      raisedAt: status === 'raised' ? nowIso() : found.raisedAt,
      updatedAt: nowIso(),
    };
    this.write('followUps', rows.map((r) => (r.id === id ? updated : r)));
    return updated;
  }

  async deleteFollowUp(id: string): Promise<void> {
    this.write('followUps', this.read<FollowUpItem>('followUps').filter((r) => r.id !== id));
  }

  /* ─── Safety ────────────────────────────────────────────────────────── */

  async logSafetyEvent(input: NewSafetyEvent): Promise<SafetyEvent> {
    const event: SafetyEvent = { id: newId(), userId: this.userId, ...input, createdAt: nowIso() };
    this.write('safety', [...this.read<SafetyEvent>('safety'), event]);
    return event;
  }

  /* ─── Entitlement ───────────────────────────────────────────────────── */

  async getEntitlement(): Promise<UsageEntitlement> {
    const existing = this.readOne<UsageEntitlement>('entitlement');
    if (existing) return existing;
    const created: UsageEntitlement = {
      userId: this.userId,
      plan: 'free',
      freeSessionAllowance: FREE_SESSION_ALLOWANCE,
      sessionsUsed: 0,
      updatedAt: nowIso(),
    };
    this.writeOne('entitlement', created);
    return created;
  }

  /* ─── Human support ─────────────────────────────────────────────────── */

  async listHumanSupportRequests(): Promise<HumanSupportRequest[]> {
    return this.read<HumanSupportRequest>('support').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createHumanSupportRequest(input: NewHumanSupportRequest): Promise<HumanSupportRequest> {
    const request: HumanSupportRequest = {
      id: newId(),
      userId: this.userId,
      requestType: input.requestType,
      preferredContact: input.preferredContact,
      preferredLanguage: input.preferredLanguage,
      note: input.note ?? null,
      status: 'submitted',
      createdAt: nowIso(),
    };
    this.write('support', [...this.read<HumanSupportRequest>('support'), request]);
    return request;
  }

  /* ─── Account ───────────────────────────────────────────────────────── */

  async deleteAccount(): Promise<void> {
    const prefix = `soulease:demo:${this.userId}:`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
    try {
      const accountsRaw = localStorage.getItem('soulease:demo:accounts');
      if (accountsRaw) {
        const accounts = (JSON.parse(accountsRaw) as Array<{ id: string }>).filter((a) => a.id !== this.userId);
        localStorage.setItem('soulease:demo:accounts', JSON.stringify(accounts));
      }
    } catch {
      /* best-effort */
    }
  }
}
