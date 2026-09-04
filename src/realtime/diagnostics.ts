import { env } from '@/config/env';

/**
 * Development-only realtime diagnostics.
 *
 * Two things live here:
 *
 *  1. A bounded ring buffer of connection and turn events.
 *  2. A live status snapshot answering the question that matters when Noor
 *     sounds repetitive: is a realtime model actually producing these replies,
 *     or is something local answering?
 *
 * Neither ever contains a key, an ephemeral secret, or what the member said.
 * The status snapshot records that a transcript exists and how long it was —
 * never its content — because a wellbeing transcript is the most private thing
 * this product handles, and a diagnostics panel is not the place for it.
 */

export interface DiagnosticEntry {
  at: number;
  channel: 'connection' | 'peer' | 'data' | 'turn' | 'audio' | 'error';
  label: string;
  detail?: string;
}

/**
 * Live realtime status.
 *
 * Read this top to bottom to tell a genuine conversation from a fabricated
 * one. If `realtimeConnected` is false, or `responseCreatedByRealtimeModel`
 * never rises, then whatever Noor is saying did not come from the model.
 */
export interface RealtimeStatus {
  /** A realtime peer connection and its data channel are open. */
  realtimeConnected: boolean;
  /** This build was explicitly configured to run the scripted demo harness. */
  demoMode: boolean;
  /** Which engine is answering. 'none' before a session starts. */
  engine: 'openai_realtime_webrtc' | 'scripted_demo' | 'none';
  /** The member's current turn reached the model (audio committed, or text item created). */
  currentUserTurnReceived: boolean;
  /** A transcript of the member's last turn arrived. Length only, never content. */
  userTranscriptAvailable: boolean;
  lastUserTranscriptChars: number;
  /** The server confirmed `conversation.item.created` for the member's turn. */
  conversationItemCreated: boolean;
  /** Count of `response.created` events — replies the realtime model began. */
  responseCreatedByRealtimeModel: number;
  /** Completed turns on both sides in this session. */
  conversationTurnCount: number;
  /** Member turns the model has been given. Should equal or trail the above. */
  userTurnCount: number;
  /** Session history was re-seeded after a reconnection (context preserved). */
  historyReseededTurns: number;
  /** Instruction block length, so a truncated or empty prompt is visible. */
  instructionChars: number;
}

const EMPTY_STATUS: RealtimeStatus = {
  realtimeConnected: false,
  demoMode: false,
  engine: 'none',
  currentUserTurnReceived: false,
  userTranscriptAvailable: false,
  lastUserTranscriptChars: 0,
  conversationItemCreated: false,
  responseCreatedByRealtimeModel: 0,
  conversationTurnCount: 0,
  userTurnCount: 0,
  historyReseededTurns: 0,
  instructionChars: 0,
};

const MAX_ENTRIES = 120;

/** Redact anything that looks like a credential before it is ever stored. */
function scrub(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  return detail
    .replace(/\bek_[A-Za-z0-9_-]+/g, 'ek_[redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]+/g, 'sk-[redacted]')
    .replace(/\bey[A-Za-z0-9._-]{20,}/g, '[jwt redacted]')
    .slice(0, 200);
}

class DiagnosticsLog {
  /**
   * Collect only where the diagnostics panel can actually be opened. That is
   * dev builds, plus a deployed preview that opted in with
   * VITE_ENABLE_DEV_TOOLS — the case this exists for, since a misbehaving
   * deployment is the one you cannot reproduce locally. Off by default in
   * production, so no ordinary member's session is ever instrumented.
   */
  readonly enabled = env.devToolsEnabled;
  private entries: DiagnosticEntry[] = [];
  private status: RealtimeStatus = { ...EMPTY_STATUS };
  private listeners = new Set<(entries: DiagnosticEntry[]) => void>();
  private statusListeners = new Set<(status: RealtimeStatus) => void>();

  push(channel: DiagnosticEntry['channel'], label: string, detail?: string): void {
    if (!this.enabled) return;
    this.entries = [...this.entries.slice(-(MAX_ENTRIES - 1)), { at: Date.now(), channel, label, detail: scrub(detail) }];
    for (const listener of this.listeners) listener(this.entries);
  }

  /**
   * Merge a status update. Always safe to call: the fields are booleans,
   * counters and lengths, so nothing private can be passed in by mistake.
   */
  setStatus(update: Partial<RealtimeStatus>): void {
    if (!this.enabled) return;
    this.status = { ...this.status, ...update };
    for (const listener of this.statusListeners) listener(this.status);
  }

  bumpStatus(field: 'responseCreatedByRealtimeModel' | 'conversationTurnCount' | 'userTurnCount', by = 1): void {
    if (!this.enabled) return;
    this.setStatus({ [field]: this.status[field] + by } as Partial<RealtimeStatus>);
  }

  /** Called when a new session begins, so counters do not carry over. */
  resetStatus(update: Partial<RealtimeStatus> = {}): void {
    if (!this.enabled) return;
    this.status = { ...EMPTY_STATUS, ...update };
    for (const listener of this.statusListeners) listener(this.status);
  }

  statusSnapshot(): RealtimeStatus {
    return this.status;
  }

  clear(): void {
    this.entries = [];
    for (const listener of this.listeners) listener(this.entries);
  }

  snapshot(): DiagnosticEntry[] {
    return this.entries;
  }

  subscribe(listener: (entries: DiagnosticEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.entries);
    return () => this.listeners.delete(listener);
  }

  subscribeStatus(listener: (status: RealtimeStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }
}

export const diagnostics = new DiagnosticsLog();
