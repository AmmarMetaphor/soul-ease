import { newId } from '@/lib/ids';
import { safetyStateInstruction } from '@/noor/realtimeInstructions';
import type { SafetyState } from '@/safety/types';
import { diagnostics } from './diagnostics';
import { detectLanguage } from './demo/languageDetection';
import {
  RealtimeError,
  type ConversationState,
  type ProviderCapabilities,
  type RealtimeConnectOptions,
  type RealtimeConversationProvider,
  type RealtimeEvent,
} from './types';

/**
 * OpenAI Realtime provider over WebRTC — genuine speech-to-speech.
 *
 * The member's microphone track is sent directly to the realtime model and
 * the model's voice comes back as a media track that plays immediately. There
 * is no record → upload → transcribe → generate → synthesise pipeline; text
 * transcripts arrive alongside the audio purely for the transcript view,
 * session memory, summaries and the safety layer.
 *
 * The permanent API key never exists here. connect() asks our own backend
 * (/api/realtime/session) for a short-lived `ek_...` client secret, which is
 * the only credential the browser ever holds.
 *
 * Barge-in is handled in three moves the instant the member starts speaking
 * while Noor is talking:
 *   1. `output_audio_buffer.clear` — stops buffered audio mid-word, locally.
 *   2. `response.cancel` — stops the model generating any more of that turn.
 *   3. `conversation.item.truncate` — trims Noor's turn in the conversation
 *      history to the audio the member actually heard, so she never carries
 *      on as if the unheard half had been said.
 */

const DATA_CHANNEL = 'oai-events';
const DEFAULT_TOKEN_ENDPOINT = '/api/realtime/session';
const MAX_RECONNECT_ATTEMPTS = 2;

export interface OpenAIRealtimeProviderDeps {
  /** Returns the member's current Supabase access token, or null in demo mode. */
  getAccessToken: () => Promise<string | null>;
  tokenEndpoint?: string;
  /** Developer voice override, used only by the audition page. */
  voiceOverride?: string;
  /**
   * Whether this deployment has real authentication at all (Supabase
   * configured). In demo mode there is no member identity to obtain, so a 401
   * is a property of the deployment rather than something the member can fix
   * by signing in — it must lead to the demo guide, never to a sign-in prompt.
   */
  canAuthenticate?: boolean;
}

interface MintedSession {
  clientSecret: string;
  expiresAt: number;
  model: string;
  voice: string;
  callsUrl: string;
}

type Listener = (event: RealtimeEvent) => void;

interface RealtimeServerEvent {
  type: string;
  [key: string]: unknown;
}

/** Read the server's failure reason, tolerating a non-JSON body. */
async function readReason(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { reason?: string };
    return body?.reason ?? null;
  } catch {
    return null;
  }
}

export class OpenAIRealtimeProvider implements RealtimeConversationProvider {
  readonly kind = 'openai_realtime_webrtc' as const;
  readonly capabilities: ProviderCapabilities = {
    voiceInput: true,
    voiceOutput: true,
    bargeIn: true,
    liveTranscription: true,
    note: 'Live speech-to-speech conversation. Noor hears you continuously and you can interrupt her.',
  };

  private listeners = new Set<Listener>();
  private readonly tokenEndpoint: string;

  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private micStream: MediaStream | null = null;
  private micSender: RTCRtpSender | null = null;
  private audioEl: HTMLAudioElement | null = null;

  private audioContext: AudioContext | null = null;
  private userAnalyser: AnalyserNode | null = null;
  private noorAnalyser: AnalyserNode | null = null;
  private levelFrame: number | null = null;
  private lastLevelEmit = 0;

  private state: ConversationState = 'idle';
  private options: RealtimeConnectOptions | null = null;
  private safetyState: SafetyState = 'NORMAL';
  private voice = '';
  private model = '';

  /** Assistant turn currently being spoken, for truncation on barge-in. */
  private activeItemId: string | null = null;
  private activeTurnId: string | null = null;
  private audioStartedAt: number | null = null;
  private assistantText = new Map<string, string>();
  private userText = new Map<string, string>();

  private closed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private micMuted = false;
  private paused = false;

  constructor(private readonly deps: OpenAIRealtimeProviderDeps) {
    this.tokenEndpoint = deps.tokenEndpoint ?? DEFAULT_TOKEN_ENDPOINT;
  }

  /* ─── Subscription ──────────────────────────────────────────────────── */

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: RealtimeEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private setState(state: ConversationState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit({ type: 'state', state });
  }

  get currentVoice(): string {
    return this.voice;
  }

  get currentModel(): string {
    return this.model;
  }

  /* ─── Credential ────────────────────────────────────────────────────── */

  private async mintSession(options: RealtimeConnectOptions): Promise<MintedSession> {
    const accessToken = await this.deps.getAccessToken();
    let response: Response;
    try {
      response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          instructions: options.instructions,
          voice: this.deps.voiceOverride,
          languages: options.transcriptionLanguages,
        }),
      });
    } catch {
      throw new RealtimeError('connection_failed', 'Could not reach the Soul Ease server.', true);
    }

    // 503: this deployment cannot do realtime (no API key, or no way to
    // verify members). 404: no server function deployed at all. Both mean
    // "no realtime here" — fall back to the demo guide rather than failing.
    if (response.status === 503 || response.status === 404) {
      throw new RealtimeError('not_configured', 'Realtime voice is not configured on this deployment.', true);
    }

    if (response.status === 401 || response.status === 403) {
      // Without real authentication the member cannot resolve a 401 by
      // signing in, so this is a deployment issue, not an auth issue.
      if (this.deps.canAuthenticate === false) {
        throw new RealtimeError('not_configured', 'Realtime voice is unavailable on this deployment.', true);
      }
      const reason = await readReason(response);
      throw reason === 'token_rejected'
        ? new RealtimeError('session_expired', 'Your session has expired. Please sign in again.', false)
        : new RealtimeError('not_signed_in', 'You need to be signed in to start a live session.', false);
    }

    if (!response.ok) {
      throw new RealtimeError('credential_failed', "We couldn't start Noor's voice session right now.", true);
    }

    // A non-JSON 200 means something other than our function answered — a
    // host rewrite serving index.html, for example. Treat it as "no realtime
    // here" instead of surfacing a JSON parse error.
    let body: Partial<MintedSession>;
    try {
      body = (await response.json()) as Partial<MintedSession>;
    } catch {
      throw new RealtimeError('not_configured', 'The realtime endpoint did not respond as expected.', true);
    }
    if (!body.clientSecret || !body.callsUrl) {
      throw new RealtimeError('credential_failed', "We couldn't start Noor's voice session right now.", true);
    }
    return {
      clientSecret: body.clientSecret,
      expiresAt: body.expiresAt ?? Date.now() + 60_000,
      model: body.model ?? '',
      voice: body.voice ?? '',
      callsUrl: body.callsUrl,
    };
  }

  /* ─── Microphone ────────────────────────────────────────────────────── */

  /**
   * Opens the microphone. Called explicitly by the UI's "Start Conversation"
   * gate — nothing is captured before the member asks for it.
   */
  async startListening(): Promise<void> {
    if (this.micStream) {
      for (const track of this.micStream.getAudioTracks()) track.enabled = true;
      this.micMuted = false;
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.emit({ type: 'mic_permission', state: 'unavailable' });
      throw new RealtimeError('microphone_unavailable', 'This browser does not expose a microphone.', true);
    }
    this.emit({ type: 'mic_permission', state: 'prompt' });
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      const name = (error as { name?: string })?.name;
      const denied = name === 'NotAllowedError' || name === 'SecurityError';
      this.emit({ type: 'mic_permission', state: denied ? 'denied' : 'unavailable' });
      diagnostics.push('error', 'getUserMedia failed', name);
      throw new RealtimeError(
        denied ? 'microphone_denied' : 'microphone_unavailable',
        denied
          ? 'Microphone access was declined. You can allow it in your browser settings, or continue by typing.'
          : 'No microphone could be opened. You can continue by typing.',
        true,
      );
    }
    this.emit({ type: 'mic_permission', state: 'granted' });
    this.micMuted = false;
    diagnostics.push('audio', 'microphone opened');

    // Watch for the device disappearing mid-session (unplugged headset).
    for (const track of this.micStream.getAudioTracks()) {
      track.addEventListener('ended', () => {
        diagnostics.push('audio', 'microphone track ended');
        this.emit({ type: 'mic_permission', state: 'unavailable' });
        this.emit({
          type: 'error',
          code: 'microphone_unavailable',
          message: 'The microphone was disconnected. Reconnect it, or continue by typing.',
          recoverable: true,
        });
      });
    }

    // If already connected, attach the freshly opened track.
    if (this.micSender && this.micStream.getAudioTracks()[0]) {
      await this.micSender.replaceTrack(this.micStream.getAudioTracks()[0]);
    }
    this.setupUserMeter();
  }

  stopListening(): void {
    this.micMuted = true;
    if (this.micStream) {
      for (const track of this.micStream.getAudioTracks()) track.enabled = false;
    }
    diagnostics.push('audio', 'microphone muted');
    if (this.state === 'listening') this.setState('ready');
  }

  /* ─── Connect ───────────────────────────────────────────────────────── */

  async connect(options: RealtimeConnectOptions): Promise<void> {
    this.options = options;
    this.closed = false;
    this.setState('connecting');
    this.emit({ type: 'connection', state: 'connecting' });

    if (typeof RTCPeerConnection === 'undefined') {
      this.emit({ type: 'connection', state: 'failed', detail: 'unsupported_browser' });
      throw new RealtimeError('unsupported_browser', 'This browser does not support live voice conversation.', false);
    }

    const minted = await this.mintSession(options);
    this.voice = minted.voice;
    this.model = minted.model;
    diagnostics.push('connection', 'client secret minted', `model=${minted.model} voice=${minted.voice}`);

    // Voice mode needs the microphone before the offer is created so the
    // audio track is part of the initial SDP.
    if (options.mode === 'audio' && !this.micStream) {
      await this.startListening();
    }

    await this.establishPeerConnection(minted);
  }

  private async establishPeerConnection(minted: MintedSession): Promise<void> {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.pc = pc;

    pc.addEventListener('connectionstatechange', () => {
      diagnostics.push('peer', `connection ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.handleDropout();
      }
    });
    pc.addEventListener('iceconnectionstatechange', () => {
      diagnostics.push('peer', `ice ${pc.iceConnectionState}`);
    });

    // Noor's voice arrives as a remote track.
    pc.addEventListener('track', (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      diagnostics.push('audio', 'remote track received');
      this.attachRemoteAudio(stream);
    });

    // Microphone → model. A transceiver is added even in text mode so the
    // member can switch to voice mid-session without renegotiating.
    const micTrack = this.micStream?.getAudioTracks()[0] ?? null;
    if (micTrack) {
      this.micSender = pc.addTrack(micTrack, this.micStream!);
    } else {
      this.micSender = pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;
    }

    const channel = pc.createDataChannel(DATA_CHANNEL);
    this.channel = channel;
    channel.addEventListener('open', () => {
      diagnostics.push('data', 'data channel open');
      this.onChannelOpen();
    });
    channel.addEventListener('close', () => diagnostics.push('data', 'data channel closed'));
    channel.addEventListener('message', (event) => {
      this.handleServerEvent(event.data as string);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    let answer: string;
    try {
      const response = await fetch(`${minted.callsUrl}?model=${encodeURIComponent(minted.model)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${minted.clientSecret}`,
          'content-type': 'application/sdp',
        },
        body: offer.sdp ?? '',
      });
      if (!response.ok) {
        diagnostics.push('error', 'SDP exchange rejected', `status=${response.status}`);
        throw new RealtimeError('connection_failed', 'The live voice service refused the connection.', true);
      }
      answer = await response.text();
    } catch (error) {
      this.emit({ type: 'connection', state: 'failed', detail: 'sdp_exchange' });
      if (error instanceof RealtimeError) throw error;
      throw new RealtimeError('connection_failed', 'Could not reach the live voice service.', true);
    }

    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    diagnostics.push('connection', 'SDP answer applied');
    this.emit({ type: 'connection', state: 'connected', detail: 'webrtc' });
  }

  private attachRemoteAudio(stream: MediaStream): void {
    if (!this.audioEl) {
      const el = document.createElement('audio');
      el.autoplay = true;
      el.setAttribute('playsinline', 'true');
      el.style.display = 'none';
      document.body.appendChild(el);
      this.audioEl = el;
    }
    this.audioEl.srcObject = stream;
    void this.audioEl.play().catch(() => {
      diagnostics.push('error', 'audio playback blocked');
      this.emit({
        type: 'error',
        code: 'unknown',
        message: 'Your browser blocked audio playback. Tap the screen once to allow Noor to be heard.',
        recoverable: true,
      });
    });
    this.setupNoorMeter(stream);
  }

  private onChannelOpen(): void {
    // The client secret already carries voice, model and instructions. This
    // update is the place to refine anything that may legitimately change
    // during a session (instructions), never voice or model.
    this.sendEvent({
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions: this.options?.instructions,
      },
    });

    this.setState('ready');
    if (this.options?.mode === 'audio' && !this.micMuted) {
      this.setState('listening');
    }

    // Noor opens the conversation rather than waiting to be spoken to.
    if (this.options?.greetFirst !== false) {
      this.sendEvent({ type: 'response.create' });
      diagnostics.push('turn', 'requested opening turn');
    }
  }

  /* ─── Server events ─────────────────────────────────────────────────── */

  private handleServerEvent(raw: string): void {
    let event: RealtimeServerEvent;
    try {
      event = JSON.parse(raw) as RealtimeServerEvent;
    } catch {
      return;
    }

    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        diagnostics.push('connection', event.type);
        break;

      /* ── User speech ── */
      case 'input_audio_buffer.speech_started': {
        diagnostics.push('turn', 'user speech started');
        this.emit({ type: 'user_speech_started' });
        // Barge-in: the member has started talking over Noor.
        if (this.state === 'speaking') this.performBargeIn();
        else this.setState('listening');
        break;
      }
      case 'input_audio_buffer.speech_stopped': {
        diagnostics.push('turn', 'user speech stopped');
        this.emit({ type: 'user_speech_stopped' });
        break;
      }

      /* ── User transcription (for transcript, memory, safety) ── */
      case 'conversation.item.input_audio_transcription.delta': {
        const itemId = String(event.item_id ?? '');
        const delta = String(event.delta ?? '');
        if (!itemId || !delta) break;
        const next = (this.userText.get(itemId) ?? '') + delta;
        this.userText.set(itemId, next);
        this.emit({
          type: 'user_transcript',
          turnId: itemId,
          text: next,
          final: false,
          language: detectLanguage(next),
        });
        break;
      }
      case 'conversation.item.input_audio_transcription.completed': {
        const itemId = String(event.item_id ?? '');
        const text = String(event.transcript ?? this.userText.get(itemId) ?? '').trim();
        this.userText.delete(itemId);
        if (!text) break;
        const language = detectLanguage(text);
        this.emit({ type: 'user_transcript', turnId: itemId, text, final: true, language });
        this.emit({
          type: 'turn_completed',
          turn: { id: itemId, role: 'user', text, language, final: true, startedAt: Date.now() },
        });
        break;
      }
      case 'conversation.item.input_audio_transcription.failed': {
        diagnostics.push('error', 'input transcription failed');
        break;
      }

      /* ── Noor's turn ── */
      case 'response.created': {
        this.activeTurnId = newId();
        diagnostics.push('turn', 'response created');
        if (this.state !== 'speaking') this.setState('thinking');
        break;
      }
      case 'response.output_item.added': {
        const item = event.item as { id?: string } | undefined;
        if (item?.id) this.activeItemId = item.id;
        break;
      }
      case 'response.output_audio_transcript.delta': {
        const turnId = this.activeTurnId ?? newId();
        this.activeTurnId = turnId;
        const next = (this.assistantText.get(turnId) ?? '') + String(event.delta ?? '');
        this.assistantText.set(turnId, next);
        this.emit({
          type: 'assistant_text',
          turnId,
          text: next,
          final: false,
          language: detectLanguage(next),
        });
        break;
      }
      case 'response.output_audio_transcript.done': {
        const turnId = this.activeTurnId ?? newId();
        const text = String(event.transcript ?? this.assistantText.get(turnId) ?? '').trim();
        if (text) {
          this.assistantText.set(turnId, text);
          this.emit({ type: 'assistant_text', turnId, text, final: true, language: detectLanguage(text) });
        }
        break;
      }
      case 'output_audio_buffer.started': {
        this.audioStartedAt = Date.now();
        const turnId = this.activeTurnId ?? newId();
        this.activeTurnId = turnId;
        diagnostics.push('audio', 'Noor speaking');
        this.setState('speaking');
        this.emit({ type: 'assistant_speech_started', turnId });
        break;
      }
      case 'output_audio_buffer.stopped': {
        this.finishAssistantTurn(false);
        break;
      }
      case 'output_audio_buffer.cleared': {
        diagnostics.push('audio', 'Noor audio cleared (interrupted)');
        this.finishAssistantTurn(true);
        break;
      }
      case 'response.done': {
        const response = event.response as { status?: string } | undefined;
        diagnostics.push('turn', `response done (${response?.status ?? 'unknown'})`);
        if (this.state === 'thinking') {
          // A text-only or empty response never produced audio.
          this.finishAssistantTurn(response?.status === 'cancelled');
        }
        break;
      }
      case 'conversation.item.truncated': {
        diagnostics.push('turn', 'assistant turn truncated');
        break;
      }
      case 'error': {
        const error = event.error as { message?: string; code?: string } | undefined;
        diagnostics.push('error', 'server error', error?.code ?? error?.message);
        this.emit({
          type: 'error',
          code: 'unknown',
          message: 'Something interrupted the conversation. You can keep talking, or switch to text.',
          recoverable: true,
        });
        break;
      }
      default:
        break;
    }
  }

  private finishAssistantTurn(cancelled: boolean): void {
    const turnId = this.activeTurnId;
    this.audioStartedAt = null;
    if (turnId) {
      const text = (this.assistantText.get(turnId) ?? '').trim();
      this.emit({ type: 'assistant_speech_stopped', turnId, cancelled });
      this.emit({ type: 'audio_level', source: 'noor', level: 0 });
      if (text) {
        this.emit({
          type: 'turn_completed',
          turn: {
            id: turnId,
            // A cancelled turn is recorded with an em dash so the transcript
            // shows what the member actually heard, not the full sentence.
            text: cancelled ? `${text}—` : text,
            role: 'noor',
            language: detectLanguage(text),
            final: true,
            startedAt: Date.now(),
          },
        });
      }
      this.assistantText.delete(turnId);
    }
    this.activeTurnId = null;
    this.activeItemId = null;
    if (this.closed || this.paused) return;
    this.setState(this.options?.mode === 'audio' && !this.micMuted ? 'listening' : 'ready');
  }

  /* ─── Barge-in ──────────────────────────────────────────────────────── */

  /**
   * Stop Noor mid-sentence and hand the floor back.
   *
   * `interrupt_response: true` on semantic VAD means the server also cuts the
   * response when it detects speech; doing it here as well makes the local
   * audio stop immediately rather than after the round trip, and the
   * truncate keeps the model's own history honest about what was heard.
   */
  private performBargeIn(): void {
    const heardMs = this.audioStartedAt ? Math.max(0, Date.now() - this.audioStartedAt) : 0;
    diagnostics.push('turn', 'barge-in', `heard=${heardMs}ms`);

    // 1. Silence the buffered audio already on its way to the speaker.
    this.sendEvent({ type: 'output_audio_buffer.clear' });
    // 2. Stop the model generating the rest of this turn.
    this.sendEvent({ type: 'response.cancel' });
    // 3. Trim the turn in conversation history to what was actually heard.
    if (this.activeItemId) {
      this.sendEvent({
        type: 'conversation.item.truncate',
        item_id: this.activeItemId,
        content_index: 0,
        audio_end_ms: heardMs,
      });
    }

    this.setState('interrupted');
    // The UI shows "go ahead" briefly, then returns to listening.
    window.setTimeout(() => {
      if (!this.closed && !this.paused && this.state === 'interrupted') {
        this.setState('listening');
      }
    }, 250);
  }

  /** Manual interruption (the member taps the orb while Noor is speaking). */
  interrupt(): void {
    if (this.state !== 'speaking') return;
    this.performBargeIn();
  }

  /* ─── Controls ──────────────────────────────────────────────────────── */

  pause(): void {
    this.paused = true;
    if (this.micStream) for (const track of this.micStream.getAudioTracks()) track.enabled = false;
    this.sendEvent({ type: 'output_audio_buffer.clear' });
    this.sendEvent({ type: 'response.cancel' });
    if (this.audioEl) this.audioEl.muted = true;
    diagnostics.push('turn', 'paused');
    this.setState('paused');
  }

  resume(): void {
    this.paused = false;
    if (this.audioEl) this.audioEl.muted = false;
    if (this.micStream && !this.micMuted) {
      for (const track of this.micStream.getAudioTracks()) track.enabled = true;
    }
    diagnostics.push('turn', 'resumed');
    this.setState(this.options?.mode === 'audio' && !this.micMuted ? 'listening' : 'ready');
  }

  /** Typed message — same session, same Noor, same safety rules. */
  sendText(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (this.state === 'speaking') this.performBargeIn();
    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: trimmed }],
      },
    });
    const turnId = newId();
    const language = detectLanguage(trimmed);
    this.emit({ type: 'user_transcript', turnId, text: trimmed, final: true, language });
    this.emit({
      type: 'turn_completed',
      turn: { id: turnId, role: 'user', text: trimmed, language, final: true, startedAt: Date.now() },
    });
    this.sendEvent({ type: 'response.create' });
    this.setState('thinking');
  }

  /**
   * Ask Noor to say something specific next — used for the closing recap and
   * for the voice-audition page. The text is an instruction to Noor, not a
   * member message, so it never appears in the transcript as the member.
   */
  requestSpokenTurn(instruction: string): void {
    this.sendEvent({
      type: 'response.create',
      response: { instructions: instruction },
    });
    this.setState('thinking');
  }

  updateSafetyState(state: SafetyState): void {
    if (this.safetyState === state) return;
    this.safetyState = state;
    const extra = safetyStateInstruction(state);
    if (!extra || !this.options) return;
    diagnostics.push('turn', `safety state ${state}`);
    this.sendEvent({
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions: `${this.options.instructions}\n\n# Current application state\n${extra}`,
      },
    });
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    const el = this.audioEl as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!el?.setSinkId) return;
    await el.setSinkId(deviceId);
  }

  /* ─── Reconnection ──────────────────────────────────────────────────── */

  private handleDropout(): void {
    if (this.closed || this.reconnectTimer !== null) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.emit({ type: 'connection', state: 'failed', detail: 'reconnect_exhausted' });
      this.setState('error');
      return;
    }
    this.reconnectAttempts += 1;
    const delay = 800 * this.reconnectAttempts;
    this.emit({ type: 'connection', state: 'reconnecting' });
    diagnostics.push('connection', `reconnect attempt ${this.reconnectAttempts}`);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.reconnect();
    }, delay);
  }

  private async reconnect(): Promise<void> {
    if (this.closed || !this.options) return;
    this.teardownPeer();
    try {
      const minted = await this.mintSession(this.options);
      this.voice = minted.voice;
      this.model = minted.model;
      await this.establishPeerConnection(minted);
      this.reconnectAttempts = 0;
      diagnostics.push('connection', 'reconnected');
    } catch {
      this.handleDropout();
    }
  }

  /* ─── Level metering ────────────────────────────────────────────────── */

  private ensureAudioContext(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    if (!this.audioContext) {
      try {
        this.audioContext = new AudioContext();
      } catch {
        return null;
      }
    }
    return this.audioContext;
  }

  private setupUserMeter(): void {
    const ctx = this.ensureAudioContext();
    if (!ctx || !this.micStream) return;
    try {
      const source = ctx.createMediaStreamSource(this.micStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      this.userAnalyser = analyser;
      this.startMeterLoop();
    } catch {
      /* metering is cosmetic */
    }
  }

  private setupNoorMeter(stream: MediaStream): void {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    try {
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      this.noorAnalyser = analyser;
      this.startMeterLoop();
    } catch {
      /* metering is cosmetic */
    }
  }

  private startMeterLoop(): void {
    if (this.levelFrame !== null || typeof requestAnimationFrame === 'undefined') return;
    const buffer = new Uint8Array(512);
    const rms = (analyser: AnalyserNode | null): number => {
      if (!analyser) return 0;
      analyser.getByteTimeDomainData(buffer.subarray(0, analyser.fftSize));
      let sum = 0;
      for (let i = 0; i < analyser.fftSize; i += 1) {
        const v = (buffer[i] - 128) / 128;
        sum += v * v;
      }
      return Math.min(1, Math.sqrt(sum / analyser.fftSize) * 4);
    };
    const tick = () => {
      const now = performance.now();
      if (now - this.lastLevelEmit > 60) {
        this.lastLevelEmit = now;
        if (this.state === 'speaking') {
          this.emit({ type: 'audio_level', source: 'noor', level: rms(this.noorAnalyser) });
        } else if (!this.micMuted && !this.paused) {
          this.emit({ type: 'audio_level', source: 'user', level: rms(this.userAnalyser) });
        }
      }
      this.levelFrame = requestAnimationFrame(tick);
    };
    this.levelFrame = requestAnimationFrame(tick);
  }

  /* ─── Teardown ──────────────────────────────────────────────────────── */

  private sendEvent(event: Record<string, unknown>): void {
    if (this.channel?.readyState !== 'open') return;
    try {
      this.channel.send(JSON.stringify(event));
    } catch {
      diagnostics.push('error', 'data channel send failed', String(event.type));
    }
  }

  private teardownPeer(): void {
    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        /* already closed */
      }
      this.channel = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        /* already closed */
      }
      this.pc = null;
    }
    this.micSender = null;
  }

  async disconnect(): Promise<void> {
    this.closed = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.setState('ending');

    this.sendEvent({ type: 'output_audio_buffer.clear' });
    this.teardownPeer();

    if (this.levelFrame !== null) cancelAnimationFrame(this.levelFrame);
    this.levelFrame = null;
    this.userAnalyser = null;
    this.noorAnalyser = null;
    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }

    if (this.micStream) {
      for (const track of this.micStream.getTracks()) track.stop();
      this.micStream = null;
    }
    if (this.audioEl) {
      this.audioEl.srcObject = null;
      this.audioEl.remove();
      this.audioEl = null;
    }

    diagnostics.push('connection', 'disconnected');
    this.setState('ended');
    this.emit({ type: 'connection', state: 'disconnected' });
  }
}
