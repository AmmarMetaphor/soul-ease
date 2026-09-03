import type { SafetyState } from '@/safety/types';

/**
 * Vendor-neutral realtime conversation contract.
 *
 * The session UI talks only to this interface. Phase 1 ships a DemoProvider;
 * Phase 2 adds an OpenAI Realtime (WebRTC) provider behind the same contract
 * so no UI component is coupled to one vendor.
 */

export type ConversationState =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'paused'
  | 'ending'
  | 'ended'
  | 'error';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export type MicPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unavailable';

export type DetectedLanguage = 'en' | 'ur' | 'ur-roman' | 'mixed';

export type RealtimeErrorCode =
  | 'not_configured'
  | 'not_implemented'
  | 'unsupported_browser'
  | 'microphone_denied'
  | 'microphone_unavailable'
  | 'connection_failed'
  | 'credential_failed'
  | 'unknown';

export interface TranscriptTurn {
  id: string;
  role: 'user' | 'noor';
  text: string;
  language: DetectedLanguage | null;
  final: boolean;
  startedAt: number;
}

export type RealtimeEvent =
  | { type: 'connection'; state: ConnectionState; detail?: string }
  | { type: 'state'; state: ConversationState }
  | { type: 'mic_permission'; state: MicPermissionState }
  /** Normalised 0–1 input/output level for the orb animation. */
  | { type: 'audio_level'; source: 'user' | 'noor'; level: number }
  | { type: 'user_speech_started' }
  | { type: 'user_speech_stopped' }
  | { type: 'user_transcript'; turnId: string; text: string; final: boolean; language: DetectedLanguage | null }
  | { type: 'assistant_speech_started'; turnId: string }
  | { type: 'assistant_speech_stopped'; turnId: string; cancelled: boolean }
  | { type: 'assistant_text'; turnId: string; text: string; final: boolean; language: DetectedLanguage | null }
  | { type: 'turn_completed'; turn: TranscriptTurn }
  /**
   * Structured signals the engine surfaces for the session summary. In Phase
   * 2 these come from model tool-calls; the demo engine emits them directly.
   */
  | { type: 'session_insight'; insight: SessionInsight }
  | { type: 'error'; code: RealtimeErrorCode; message: string; recoverable: boolean };

export type SessionInsight =
  | { kind: 'topic'; topic: string }
  | { kind: 'agreed_action'; text: string }
  | { kind: 'exercise'; slug: string; accepted: boolean };

export interface RealtimeConnectOptions {
  mode: 'audio' | 'text';
  preferredLanguage: 'en' | 'ur';
  /** Short, member-approved memory lines Noor may draw on. */
  memoryContext: string[];
  displayName?: string | null;
  /** Full system instructions for the model (see noor/persona.ts). */
  instructions: string;
  /** Whether the conversation opens in a gentler register. */
  openGently: boolean;
}

export interface ProviderCapabilities {
  voiceInput: boolean;
  voiceOutput: boolean;
  bargeIn: boolean;
  liveTranscription: boolean;
  /** Human-readable note shown in the settings sheet. */
  note: string;
}

export interface RealtimeConversationProvider {
  readonly kind: 'demo' | 'openai_realtime_webrtc';
  readonly capabilities: ProviderCapabilities;

  connect(options: RealtimeConnectOptions): Promise<void>;
  disconnect(): Promise<void>;

  /** Open the microphone and begin voice activity detection. */
  startListening(): Promise<void>;
  /** Mute the microphone without tearing down the connection. */
  stopListening(): void;

  pause(): void;
  resume(): void;

  /** Send a typed message as a user turn (text mode or chat toggle). */
  sendText(text: string): void;

  /** Barge-in: cancel Noor's current speech and hand the floor to the user. */
  interrupt(): void;

  /** Optional output-device routing (not supported in every browser). */
  setOutputDevice?(deviceId: string): Promise<void>;

  /**
   * Inform the engine of the application's safety state so it can change
   * register (Phase 2: session.update instructions). The app, not the
   * provider, owns the Safety Mode decision.
   */
  updateSafetyState?(state: SafetyState): void;

  subscribe(listener: (event: RealtimeEvent) => void): () => void;
}

export class RealtimeError extends Error {
  constructor(
    public readonly code: RealtimeErrorCode,
    message: string,
    public readonly recoverable = false,
  ) {
    super(message);
    this.name = 'RealtimeError';
  }
}
