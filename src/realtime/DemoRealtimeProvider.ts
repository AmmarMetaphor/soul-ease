import { newId } from '@/lib/ids';
import type { SafetyState } from '@/safety/types';
import { createDemoState, openingLine, respond, type DemoEngineState } from './demo/noorDemoScript';
import { detectLanguage } from './demo/languageDetection';
import { diagnostics } from './diagnostics';
import {
  RealtimeError,
  type ConversationState,
  type DetectedLanguage,
  type ProviderCapabilities,
  type RealtimeConnectOptions,
  type RealtimeConversationProvider,
  type RealtimeEvent,
} from './types';

type Listener = (event: RealtimeEvent) => void;

function speechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function hasSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function hasMediaDevices(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

const LANG_TAG: Record<DetectedLanguage, string> = {
  en: 'en-US',
  mixed: 'en-US',
  'ur-roman': 'en-US',
  ur: 'ur-PK',
};

/**
 * Scripted demonstration harness for the session interface.
 *
 * Exercises the real interface plumbing with no credentials configured:
 *  - real microphone permission flow and live input-level metering
 *  - in-browser speech recognition where the browser offers it (Chromium)
 *  - pre-written replies read out by browser speechSynthesis, or revealed as
 *    timed text where synthesis is unavailable
 *  - tap-to-interrupt barge-in that cancels mid-sentence
 *
 * What it is NOT: Noor. The replies come from noorDemoScript's fixed line
 * pools, and the voice is the browser's, which Phase 2 explicitly rules out
 * as a production voice. It is reachable only through an explicit
 * `VITE_REALTIME_PROVIDER=demo` build, and it announces itself in the session
 * UI, because a member cannot consent to a fabricated conversation they were
 * not told about.
 */
export class DemoRealtimeProvider implements RealtimeConversationProvider {
  readonly kind = 'demo' as const;
  readonly capabilities: ProviderCapabilities;

  private listeners = new Set<Listener>();
  private state: ConversationState = 'idle';
  private options: RealtimeConnectOptions | null = null;
  private engine: DemoEngineState = createDemoState('en');
  private safetyState: SafetyState = 'NORMAL';

  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelFrame: number | null = null;
  private lastLevelEmit = 0;

  private recognition: SpeechRecognitionLike | null = null;
  private recognitionWanted = false;
  private interimTurnId: string | null = null;

  private speakingTurnId: string | null = null;
  private speakTimers: number[] = [];
  private thinkingTimer: number | null = null;
  private paused = false;
  private micActive = false;
  private disconnected = false;

  constructor() {
    const recognition = speechRecognitionCtor() !== null;
    const synthesis = hasSpeechSynthesis();
    this.capabilities = {
      voiceInput: recognition && hasMediaDevices(),
      voiceOutput: synthesis,
      bargeIn: true,
      liveTranscription: recognition,
      note: recognition
        ? 'Demonstration harness — pre-written replies, spoken by your browser. Not Noor, and not a conversation.'
        : 'Demonstration harness — pre-written replies, and this browser cannot hear you, so type instead. Not Noor.',
    };
  }

  /* ─── Subscription ──────────────────────────────────────────────────── */

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: RealtimeEvent): void {
    if (event.type === 'turn_completed' && event.turn.text.trim()) {
      diagnostics.bumpStatus('conversationTurnCount');
      if (event.turn.role === 'user') diagnostics.bumpStatus('userTurnCount');
    }
    for (const listener of this.listeners) listener(event);
  }

  private setState(state: ConversationState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit({ type: 'state', state });
  }

  /* ─── Lifecycle ─────────────────────────────────────────────────────── */

  async connect(options: RealtimeConnectOptions): Promise<void> {
    this.options = options;
    this.disconnected = false;
    this.engine = createDemoState(options.preferredLanguage);
    // Declared loudly in diagnostics: whatever is said from here on is a
    // pre-written line, not a model reading the member's words.
    diagnostics.resetStatus({ demoMode: true, engine: 'scripted_demo' });
    diagnostics.push('connection', 'scripted demo harness started (not the realtime model)');
    this.setState('connecting');
    this.emit({ type: 'connection', state: 'connecting' });
    await delay(650);
    if (this.disconnected) return;
    this.emit({ type: 'connection', state: 'connected', detail: 'demo' });
    this.setState('ready');

    const opening = openingLine(this.engine, {
      displayName: options.displayName,
      openGently: options.openGently,
      memoryContext: options.memoryContext,
    });
    window.setTimeout(() => {
      if (!this.disconnected) this.speak(opening);
    }, 500);
  }

  async disconnect(): Promise<void> {
    this.disconnected = true;
    this.setState('ending');
    this.cancelSpeech(false);
    this.clearThinking();
    this.teardownRecognition();
    this.teardownAudio();
    this.setState('ended');
    this.emit({ type: 'connection', state: 'disconnected' });
  }

  updateSafetyState(state: SafetyState): void {
    this.safetyState = state;
  }

  /* ─── Microphone ────────────────────────────────────────────────────── */

  async startListening(): Promise<void> {
    if (!hasMediaDevices()) {
      this.emit({ type: 'mic_permission', state: 'unavailable' });
      throw new RealtimeError('microphone_unavailable', 'This browser does not expose a microphone.', true);
    }
    if (!this.mediaStream) {
      this.emit({ type: 'mic_permission', state: 'prompt' });
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (error) {
        const name = (error as { name?: string })?.name;
        const denied = name === 'NotAllowedError' || name === 'SecurityError';
        this.emit({ type: 'mic_permission', state: denied ? 'denied' : 'unavailable' });
        throw new RealtimeError(
          denied ? 'microphone_denied' : 'microphone_unavailable',
          denied
            ? 'Microphone access was declined. You can allow it in your browser settings, or continue by typing.'
            : 'No microphone could be opened. You can continue by typing.',
          true,
        );
      }
      this.emit({ type: 'mic_permission', state: 'granted' });
      this.setupAnalyser();
    }
    for (const track of this.mediaStream.getAudioTracks()) track.enabled = true;
    this.micActive = true;
    this.recognitionWanted = this.capabilities.liveTranscription;
    if (!this.paused && this.state !== 'speaking' && this.state !== 'thinking') {
      this.setState('listening');
      this.startRecognition();
    }
  }

  stopListening(): void {
    this.micActive = false;
    this.recognitionWanted = false;
    if (this.mediaStream) {
      for (const track of this.mediaStream.getAudioTracks()) track.enabled = false;
    }
    this.teardownRecognition();
    if (this.state === 'listening') this.setState('ready');
  }

  private setupAnalyser(): void {
    if (!this.mediaStream || typeof AudioContext === 'undefined') return;
    try {
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
      const buffer = new Uint8Array(this.analyser.fftSize);
      const tick = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (const sample of buffer) {
          const v = (sample - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buffer.length);
        const now = performance.now();
        if (now - this.lastLevelEmit > 50 && this.micActive && this.state !== 'speaking') {
          this.lastLevelEmit = now;
          this.emit({ type: 'audio_level', source: 'user', level: Math.min(1, rms * 4) });
        }
        this.levelFrame = requestAnimationFrame(tick);
      };
      this.levelFrame = requestAnimationFrame(tick);
    } catch {
      // Metering is cosmetic; the conversation continues without it.
    }
  }

  private teardownAudio(): void {
    if (this.levelFrame !== null) cancelAnimationFrame(this.levelFrame);
    this.levelFrame = null;
    this.analyser = null;
    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) track.stop();
      this.mediaStream = null;
    }
    this.micActive = false;
  }

  /* ─── Speech recognition ────────────────────────────────────────────── */

  private startRecognition(): void {
    if (!this.recognitionWanted || this.recognition || this.paused) return;
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = LANG_TAG[this.engine.language];
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalBuffer = '';
    let silenceTimer: number | null = null;
    const flush = () => {
      const text = finalBuffer.trim();
      finalBuffer = '';
      if (text) this.handleUserUtterance(text);
    };

    recognition.onstart = () => {
      this.emit({ type: 'user_speech_started' });
    };
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalBuffer += `${transcript} `;
        else interim += transcript;
      }
      if (!this.interimTurnId) this.interimTurnId = newId();
      const shown = `${finalBuffer}${interim}`.trim();
      if (shown) {
        this.emit({
          type: 'user_transcript',
          turnId: this.interimTurnId,
          text: shown,
          final: false,
          language: detectLanguage(shown),
        });
      }
      if (silenceTimer !== null) window.clearTimeout(silenceTimer);
      silenceTimer = window.setTimeout(flush, 900);
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.recognitionWanted = false;
        this.emit({ type: 'mic_permission', state: 'denied' });
        this.emit({
          type: 'error',
          code: 'microphone_denied',
          message: 'Speech recognition was blocked by the browser. You can continue by typing.',
          recoverable: true,
        });
      }
      // 'no-speech' and 'aborted' are routine; onend handles restart.
    };
    recognition.onend = () => {
      this.emit({ type: 'user_speech_stopped' });
      this.recognition = null;
      if (this.recognitionWanted && !this.paused && this.state === 'listening' && !this.disconnected) {
        window.setTimeout(() => this.startRecognition(), 250);
      }
    };
    try {
      recognition.start();
      this.recognition = recognition;
    } catch {
      this.recognition = null;
    }
  }

  private teardownRecognition(): void {
    if (this.recognition) {
      const r = this.recognition;
      this.recognition = null;
      r.onend = null;
      try {
        r.abort();
      } catch {
        /* already stopped */
      }
    }
  }

  /* ─── Pause / resume ────────────────────────────────────────────────── */

  pause(): void {
    this.paused = true;
    this.cancelSpeech(true);
    this.clearThinking();
    this.teardownRecognition();
    this.setState('paused');
  }

  resume(): void {
    this.paused = false;
    if (this.micActive) {
      this.setState('listening');
      this.startRecognition();
    } else {
      this.setState('ready');
    }
  }

  /* ─── Conversation ──────────────────────────────────────────────────── */

  sendText(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (this.state === 'speaking') this.interrupt();
    this.handleUserUtterance(trimmed);
  }

  interrupt(): void {
    if (this.state !== 'speaking') return;
    this.cancelSpeech(true);
    this.setState('interrupted');
    window.setTimeout(() => {
      if (this.disconnected || this.paused) return;
      if (this.micActive) {
        this.setState('listening');
        this.startRecognition();
      } else {
        this.setState('ready');
      }
    }, 300);
  }

  private handleUserUtterance(text: string): void {
    const turnId = this.interimTurnId ?? newId();
    this.interimTurnId = null;
    const language = detectLanguage(text);
    this.emit({ type: 'user_transcript', turnId, text, final: true, language });
    this.emit({
      type: 'turn_completed',
      turn: { id: turnId, role: 'user', text, language, final: true, startedAt: Date.now() },
    });
    this.teardownRecognition();
    this.setState('thinking');
    const thinkFor = 700 + Math.min(1200, text.length * 12);
    this.thinkingTimer = window.setTimeout(() => {
      this.thinkingTimer = null;
      if (this.disconnected || this.paused) return;
      const before = this.engine;
      const reply = respond(before, text, this.safetyState);
      this.engine = reply.state;
      this.emitInsights(before, reply.state);
      this.speak(reply.text);
    }, thinkFor);
  }

  /** Surface what the scripted engine learned so the app can build a summary. */
  private emitInsights(before: DemoEngineState, after: DemoEngineState): void {
    if (after.topic && after.topic !== before.topic) {
      this.emit({ type: 'session_insight', insight: { kind: 'topic', topic: after.topic } });
    }
    for (const action of after.agreedActions.slice(before.agreedActions.length)) {
      this.emit({ type: 'session_insight', insight: { kind: 'agreed_action', text: action } });
    }
    if (after.interventionSlug && after.interventionAccepted !== null && before.interventionAccepted === null) {
      this.emit({
        type: 'session_insight',
        insight: { kind: 'exercise', slug: after.interventionSlug, accepted: after.interventionAccepted },
      });
    }
  }

  private clearThinking(): void {
    if (this.thinkingTimer !== null) window.clearTimeout(this.thinkingTimer);
    this.thinkingTimer = null;
  }

  /* ─── Noor speaking ─────────────────────────────────────────────────── */

  private speak(text: string): void {
    const turnId = newId();
    this.speakingTurnId = turnId;
    const language = detectLanguage(text);
    this.setState('speaking');
    this.emit({ type: 'assistant_speech_started', turnId });

    const words = text.split(/\s+/);
    const useSynthesis = this.options?.mode === 'audio' && this.capabilities.voiceOutput;
    const perWordMs = useSynthesis ? 330 : 220;
    let revealed = 0;

    const revealNext = () => {
      if (this.speakingTurnId !== turnId) return;
      revealed = Math.min(words.length, revealed + 1);
      this.emit({
        type: 'assistant_text',
        turnId,
        text: words.slice(0, revealed).join(' '),
        final: false,
        language,
      });
      this.emit({
        type: 'audio_level',
        source: 'noor',
        level: 0.35 + 0.45 * Math.abs(Math.sin(revealed * 0.9)) + Math.random() * 0.15,
      });
      if (revealed < words.length) {
        this.speakTimers.push(window.setTimeout(revealNext, perWordMs));
      }
    };
    this.speakTimers.push(window.setTimeout(revealNext, 120));

    const finish = () => {
      if (this.speakingTurnId !== turnId) return;
      this.speakingTurnId = null;
      this.clearSpeakTimers();
      this.emit({ type: 'assistant_text', turnId, text, final: true, language });
      this.emit({ type: 'assistant_speech_stopped', turnId, cancelled: false });
      this.emit({ type: 'audio_level', source: 'noor', level: 0 });
      this.emit({
        type: 'turn_completed',
        turn: { id: turnId, role: 'noor', text, language, final: true, startedAt: Date.now() },
      });
      if (this.disconnected || this.paused) return;
      if (this.micActive) {
        this.setState('listening');
        this.startRecognition();
      } else {
        this.setState('ready');
      }
    };

    if (useSynthesis) {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = LANG_TAG[language];
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.onend = finish;
        utterance.onerror = finish;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        // Safety net: some engines never fire onend.
        this.speakTimers.push(window.setTimeout(finish, words.length * perWordMs + 2500));
        return;
      } catch {
        // fall through to timed reveal
      }
    }
    this.speakTimers.push(window.setTimeout(finish, words.length * perWordMs + 400));
  }

  private cancelSpeech(emitCancelled: boolean): void {
    const turnId = this.speakingTurnId;
    this.speakingTurnId = null;
    this.clearSpeakTimers();
    if (hasSpeechSynthesis()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    if (turnId && emitCancelled) {
      this.emit({ type: 'assistant_speech_stopped', turnId, cancelled: true });
      this.emit({ type: 'audio_level', source: 'noor', level: 0 });
    }
  }

  private clearSpeakTimers(): void {
    for (const timer of this.speakTimers) window.clearTimeout(timer);
    this.speakTimers = [];
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
