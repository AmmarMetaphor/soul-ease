import type { SafetyState } from '@/safety/types';
import {
  RealtimeError,
  type ProviderCapabilities,
  type RealtimeConnectOptions,
  type RealtimeConversationProvider,
  type RealtimeEvent,
} from './types';

export interface OpenAIRealtimeProviderDeps {
  /** Returns the member's current Supabase access token, or null if signed out. */
  getAccessToken: () => Promise<string | null>;
  /** Same-origin Netlify Function that mints a short-lived client credential. */
  tokenEndpoint?: string;
}

interface ClientCredential {
  clientSecret: string;
  expiresAt: number;
  model: string;
}

/**
 * OpenAI Realtime (WebRTC) provider — PHASE 2 SCAFFOLD.
 *
 * What exists now:
 *  - the vendor-neutral contract is implemented so the UI never changes
 *  - credential retrieval goes through our backend only; the permanent API
 *    key is never present in the browser
 *
 * What Phase 2 adds (deliberately not fabricated here):
 *  1. RTCPeerConnection with the microphone track attached
 *  2. a data channel ("oai-events") for JSON events
 *  3. SDP offer → POST to the Realtime endpoint with the ephemeral secret →
 *     remote answer
 *  4. mapping of vendor events to RealtimeEvent:
 *       input_audio_buffer.speech_started/stopped → user_speech_*
 *       conversation.item.input_audio_transcription.* → user_transcript
 *       response.audio_transcript.delta/done → assistant_text
 *       response.audio.delta/done → assistant_speech_*
 *       output_audio_buffer.cleared / response.cancel → barge-in
 *  5. reconnection with backoff, ICE failure handling, device switching
 *
 * Until then connect() reports `not_implemented` and the factory falls back
 * to the demo provider so the product still demonstrates honestly.
 */
export class OpenAIRealtimeProvider implements RealtimeConversationProvider {
  readonly kind = 'openai_realtime_webrtc' as const;
  readonly capabilities: ProviderCapabilities = {
    voiceInput: true,
    voiceOutput: true,
    bargeIn: true,
    liveTranscription: true,
    note: 'Live conversational voice via a realtime model (Phase 2).',
  };

  private listeners = new Set<(event: RealtimeEvent) => void>();
  private readonly tokenEndpoint: string;

  constructor(private readonly deps: OpenAIRealtimeProviderDeps) {
    this.tokenEndpoint = deps.tokenEndpoint ?? '/api/realtime/token';
  }

  subscribe(listener: (event: RealtimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: RealtimeEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  async connect(_options: RealtimeConnectOptions): Promise<void> {
    this.emit({ type: 'connection', state: 'connecting' });
    if (typeof RTCPeerConnection === 'undefined') {
      this.emit({ type: 'connection', state: 'failed', detail: 'unsupported_browser' });
      throw new RealtimeError('unsupported_browser', 'This browser does not support WebRTC.', false);
    }

    // Step 1 — obtain a short-lived credential from our own backend.
    const credential = await this.fetchClientCredential();
    void credential;

    // Steps 2–5 are Phase 2. Fail honestly rather than pretending to connect.
    this.emit({ type: 'connection', state: 'failed', detail: 'not_implemented' });
    throw new RealtimeError(
      'not_implemented',
      'Live realtime voice is scheduled for Phase 2. The demo guide will be used instead.',
      true,
    );
  }

  private async fetchClientCredential(): Promise<ClientCredential> {
    const accessToken = await this.deps.getAccessToken();
    if (!accessToken) {
      throw new RealtimeError('credential_failed', 'You need to be signed in to start a live session.', false);
    }
    let response: Response;
    try {
      response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      throw new RealtimeError('connection_failed', 'Could not reach the realtime token service.', true);
    }
    if (response.status === 503) {
      throw new RealtimeError('not_configured', 'Realtime voice is not configured on this deployment.', true);
    }
    if (!response.ok) {
      throw new RealtimeError('credential_failed', `Token service responded ${response.status}.`, true);
    }
    const body = (await response.json()) as Partial<ClientCredential>;
    if (!body.clientSecret || !body.expiresAt || !body.model) {
      throw new RealtimeError('credential_failed', 'Token service returned an unexpected payload.', true);
    }
    return { clientSecret: body.clientSecret, expiresAt: body.expiresAt, model: body.model };
  }

  async disconnect(): Promise<void> {
    this.emit({ type: 'connection', state: 'disconnected' });
  }

  updateSafetyState(_state: SafetyState): void {
    /* Phase 2: send a session.update with adjusted instructions. */
  }

  async startListening(): Promise<void> {
    throw new RealtimeError('not_implemented', 'Phase 2', true);
  }
  stopListening(): void {}
  pause(): void {}
  resume(): void {}
  sendText(_text: string): void {}
  interrupt(): void {}
}
