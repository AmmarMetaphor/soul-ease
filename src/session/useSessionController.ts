import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { MIN_BILLABLE_SESSION_SECONDS } from '@/config/app';
import { useData } from '@/data/DataContext';
import type { ConcernId, InteractionMode, WellbeingSession } from '@/data/types';
import { RepositoryError } from '@/data/repository';
import { evaluateEntitlement } from '@/entitlements/entitlement';
import { canPersistTranscript, canPersistSessionSummary } from '@/memory/permissions';
import { buildNoorRealtimeInstructions } from '@/noor/realtimeInstructions';
import { createFallbackProvider, createRealtimeProvider, fallbackAllowed } from '@/realtime/createProvider';
import { diagnostics } from '@/realtime/diagnostics';
import {
  RealtimeError,
  type ConnectionState,
  type ConversationState,
  type MicPermissionState,
  type RealtimeConversationProvider,
  type RealtimeEvent,
  type TranscriptTurn,
} from '@/realtime/types';
import { detectsHumanSupportRequest, screenTextForSafety } from '@/safety/detector';
import { initialStateForNewSession, isCoachingAllowed, maxSafetyState, transitionSafetyState } from '@/safety/machine';
import type { SafetyState, SafetyTrigger } from '@/safety/types';
import { buildMemoryContext, transcriptionLanguages } from './memoryContext';
import { buildSessionSummary, deriveTopics } from './summaryBuilder';

/**
 * Session phases.
 *
 * 'gate' is the "Ready to talk?" screen: nothing is captured and no
 * credential is minted until the member asks for the conversation to start.
 */
export type SessionPhase =
  | 'checking'
  | 'gate'
  | 'blocked'
  | 'connecting'
  | 'live'
  | 'recapping'
  | 'ending'
  | 'ended'
  | 'failed';

export interface SessionControllerState {
  phase: SessionPhase;
  session: WellbeingSession | null;
  conversation: ConversationState;
  connection: ConnectionState;
  micPermission: MicPermissionState;
  safetyState: SafetyState;
  maxSafety: SafetyState;
  mode: InteractionMode;
  turns: TranscriptTurn[];
  liveUserText: string;
  liveNoorText: string;
  level: number;
  levelSource: 'user' | 'noor';
  elapsedSeconds: number;
  error: string | null;
  /** 'demo' when the demo guide is running, 'fallback' when it replaced realtime. */
  notice: 'demo' | 'fallback' | null;
  providerKind: RealtimeConversationProvider['kind'] | null;
  capabilities: RealtimeConversationProvider['capabilities'] | null;
  entitlementBlocked: boolean;
  agreedActions: string[];
  voice: string | null;
  model: string | null;
}

export function useSessionController(initialMode: InteractionMode) {
  const { repo, profile, consent, entitlement, refresh } = useData();
  const { getAccessToken } = useAuth();

  const providerRef = useRef<RealtimeConversationProvider | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const insightsRef = useRef<{ topic: ConcernId | null; exercise: string | null }>({ topic: null, exercise: null });
  const agreedRef = useRef<string[]>([]);
  const turnsRef = useRef<TranscriptTurn[]>([]);
  const safetyRef = useRef<SafetyState>('NORMAL');
  const maxSafetyRef = useRef<SafetyState>('NORMAL');
  const sessionRef = useRef<WellbeingSession | null>(null);
  const endingRef = useRef(false);
  const noorTextRef = useRef<Record<string, string>>({});
  const instructionsRef = useRef<string>('');

  const [state, setState] = useState<SessionControllerState>({
    phase: 'checking',
    session: null,
    conversation: 'idle',
    connection: 'disconnected',
    micPermission: 'unknown',
    safetyState: 'NORMAL',
    maxSafety: 'NORMAL',
    mode: initialMode,
    turns: [],
    liveUserText: '',
    liveNoorText: '',
    level: 0,
    levelSource: 'user',
    elapsedSeconds: 0,
    error: null,
    notice: null,
    providerKind: null,
    capabilities: null,
    entitlementBlocked: false,
    agreedActions: [],
    voice: null,
    model: null,
  });

  const patch = useCallback((update: Partial<SessionControllerState>) => {
    setState((prev) => ({ ...prev, ...update }));
  }, []);

  /* ─── Entitlement gate ──────────────────────────────────────────────── */

  useEffect(() => {
    if (!entitlement || !profile) return;
    const decision = evaluateEntitlement(entitlement);
    patch(
      decision.canStartSession
        ? { phase: 'gate', mode: profile.preferredMode, entitlementBlocked: false }
        : { phase: 'blocked', entitlementBlocked: true },
    );
  }, [entitlement, profile, patch]);

  /* ─── Safety ────────────────────────────────────────────────────────── */

  const applySafetyTrigger = useCallback(
    async (trigger: SafetyTrigger) => {
      const transition = transitionSafetyState(safetyRef.current, trigger);
      if (!transition.changed) return;
      safetyRef.current = transition.to;
      maxSafetyRef.current = maxSafetyState(maxSafetyRef.current, transition.to);
      patch({ safetyState: transition.to, maxSafety: maxSafetyRef.current });
      // Tell the model to change register immediately, mid-session.
      providerRef.current?.updateSafetyState?.(transition.to);
      try {
        await repo.logSafetyEvent({
          sessionId: sessionRef.current?.id ?? null,
          fromState: transition.from,
          toState: transition.to,
          triggerSource: transition.source,
          resourcesShown: transition.to === 'SAFETY_MODE' || transition.to === 'HUMAN_HANDOFF',
          humanSupportOffered: transition.to !== 'NORMAL',
        });
      } catch {
        // Logging must never interrupt the safety experience itself.
      }
    },
    [patch, repo],
  );

  /* ─── Provider events ───────────────────────────────────────────────── */

  const persistTurn = useCallback(
    (turn: TranscriptTurn) => {
      const session = sessionRef.current;
      if (!session || !canPersistTranscript(consent)) return;
      void repo.appendTurn(session.id, turn.role, turn.text, turn.language).catch(() => {
        // A failed transcript write is not fatal to the conversation.
      });
    },
    [consent, repo],
  );

  /**
   * Screen a completed user turn. This runs on transcripts produced by the
   * realtime model itself, so safety detection works during voice
   * conversations exactly as it does for typed messages.
   */
  const screenUserTurn = useCallback(
    (text: string) => {
      if (detectsHumanSupportRequest(text)) {
        void applySafetyTrigger({ type: 'user_requests_human' });
        return;
      }
      const level = screenTextForSafety(text);
      if (level !== 'none') void applySafetyTrigger({ type: 'conversation_signal', level });
    },
    [applySafetyTrigger],
  );

  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      switch (event.type) {
        case 'connection':
          patch({ connection: event.state });
          if (event.state === 'reconnecting') {
            patch({ error: null });
          }
          if (event.state === 'failed') {
            patch({ phase: 'failed', error: 'connection_lost' });
          }
          break;
        case 'state':
          patch({ conversation: event.state });
          break;
        case 'mic_permission':
          patch({ micPermission: event.state });
          break;
        case 'audio_level':
          patch({ level: event.level, levelSource: event.source });
          break;
        case 'user_transcript':
          patch({ liveUserText: event.final ? '' : event.text });
          break;
        case 'assistant_text':
          noorTextRef.current[event.turnId] = event.text;
          patch({ liveNoorText: event.final ? '' : event.text });
          break;
        case 'assistant_speech_stopped':
          delete noorTextRef.current[event.turnId];
          patch({ liveNoorText: '' });
          break;
        case 'turn_completed': {
          turnsRef.current = [...turnsRef.current, event.turn];
          patch({ turns: turnsRef.current, ...(event.turn.role === 'user' ? { liveUserText: '' } : {}) });
          persistTurn(event.turn);
          if (event.turn.role === 'user') screenUserTurn(event.turn.text);
          break;
        }
        case 'session_insight': {
          const insight = event.insight;
          if (insight.kind === 'agreed_action') {
            agreedRef.current = [...agreedRef.current, insight.text];
            patch({ agreedActions: agreedRef.current });
          } else if (insight.kind === 'topic') {
            insightsRef.current.topic = insight.topic as ConcernId;
          } else if (insight.kind === 'exercise') {
            insightsRef.current.exercise = insight.accepted ? insight.slug : null;
          }
          break;
        }
        case 'error':
          patch({ error: event.message });
          break;
      }
    },
    [patch, persistTurn, screenUserTurn],
  );

  /* ─── Connect ───────────────────────────────────────────────────────── */

  const connect = useCallback(
    async (mode: InteractionMode) => {
      if (!profile || !entitlement) return;
      const decision = evaluateEntitlement(entitlement);
      if (!decision.canStartSession) {
        patch({ phase: 'blocked', entitlementBlocked: true, mode });
        return;
      }
      patch({ phase: 'connecting', mode, error: null });

      let session: WellbeingSession;
      try {
        session = await repo.startSession(mode);
      } catch (err) {
        if (err instanceof RepositoryError && err.message === 'ENTITLEMENT_EXHAUSTED') {
          patch({ phase: 'blocked', entitlementBlocked: true });
          await refresh();
          return;
        }
        patch({ phase: 'failed', error: err instanceof Error ? err.message : 'session_start_failed' });
        return;
      }
      sessionRef.current = session;
      startedAtRef.current = Date.now();

      // Bounded context payload — never whole transcripts.
      let memories: Awaited<ReturnType<typeof repo.listMemories>> = [];
      let goals: Awaited<ReturnType<typeof repo.listGoals>> = [];
      let lastEnded: WellbeingSession | null = null;
      let lastSummary: Awaited<ReturnType<typeof repo.getSummary>> = null;
      let endedCount = 0;
      try {
        if (consent.longTermMemory) memories = await repo.listMemories();
        goals = await repo.listGoals();
        const sessions = await repo.listSessions();
        const ended = sessions.filter((s) => s.id !== session.id && s.status === 'ended');
        endedCount = ended.length;
        lastEnded = ended[0] ?? null;
        if (lastEnded) lastSummary = await repo.getSummary(lastEnded.id);
      } catch {
        // Memory is a nice-to-have; the conversation must work without it.
        diagnostics.push('connection', 'memory context unavailable');
      }

      const context = buildMemoryContext({
        profile,
        consent,
        memories,
        goals,
        lastEndedSession: lastEnded,
        lastSummary,
        endedSessionCount: endedCount,
      });

      const initialSafety = initialStateForNewSession(lastEnded?.maxSafetyState ?? null);
      safetyRef.current = initialSafety;
      maxSafetyRef.current = initialSafety;

      const instructions = buildNoorRealtimeInstructions(context);
      instructionsRef.current = instructions;

      const connectOptions = {
        mode,
        preferredLanguage: context.preferredLanguage,
        memoryContext: context.memoryLines,
        displayName: context.displayName,
        instructions,
        openGently: context.openGently,
        transcriptionLanguages: transcriptionLanguages(context.preferredLanguage),
        greetFirst: true,
      };

      let provider = createRealtimeProvider({ getAccessToken });
      let notice: SessionControllerState['notice'] = provider.kind === 'demo' ? 'demo' : null;
      let unsubscribe = provider.subscribe(handleEvent);
      try {
        await provider.connect(connectOptions);
      } catch (err) {
        unsubscribe();
        void provider.disconnect().catch(() => undefined);
        const notConfigured =
          err instanceof RealtimeError && (err.code === 'not_configured' || err.code === 'not_implemented');
        if (!notConfigured || !fallbackAllowed()) {
          const micDenied = err instanceof RealtimeError && err.code === 'microphone_denied';
          patch({
            phase: 'failed',
            error: err instanceof Error ? err.message : 'connect_failed',
            // Only narrow the mic state when we actually learned something.
            ...(micDenied ? { micPermission: 'denied' as const } : {}),
          });
          return;
        }
        // No realtime credentials on this deployment — run the demo guide and
        // say so plainly rather than pretending this is the real voice.
        provider = createFallbackProvider();
        notice = 'fallback';
        unsubscribe = provider.subscribe(handleEvent);
        try {
          await provider.connect(connectOptions);
        } catch (fallbackError) {
          unsubscribe();
          patch({ phase: 'failed', error: fallbackError instanceof Error ? fallbackError.message : 'connect_failed' });
          return;
        }
      }

      providerRef.current = provider;
      unsubscribeRef.current = unsubscribe;
      provider.updateSafetyState?.(initialSafety);

      const voiceProvider = provider as RealtimeConversationProvider & { currentVoice?: string; currentModel?: string };
      patch({
        phase: 'live',
        session,
        notice,
        providerKind: provider.kind,
        capabilities: provider.capabilities,
        safetyState: initialSafety,
        maxSafety: initialSafety,
        voice: voiceProvider.currentVoice ?? null,
        model: voiceProvider.currentModel ?? null,
      });

      // The demo provider opens its own microphone; the realtime provider
      // already did so before creating the offer.
      if (mode === 'audio' && provider.kind === 'demo') {
        try {
          await provider.startListening();
        } catch {
          /* surfaced through events */
        }
      }
    },
    [consent, entitlement, getAccessToken, handleEvent, patch, profile, refresh, repo],
  );

  /* ─── Controls ──────────────────────────────────────────────────────── */

  const toggleMic = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) return;
    const listening = state.conversation === 'listening' || state.conversation === 'speaking';
    if (state.micPermission === 'granted' && listening) {
      provider.stopListening();
      return;
    }
    try {
      await provider.startListening();
    } catch {
      /* surfaced through events */
    }
  }, [state.conversation, state.micPermission]);

  const pause = useCallback(() => providerRef.current?.pause(), []);
  const resume = useCallback(() => providerRef.current?.resume(), []);
  const interrupt = useCallback(() => providerRef.current?.interrupt(), []);
  const sendText = useCallback((text: string) => providerRef.current?.sendText(text), []);

  const switchMode = useCallback(
    (mode: InteractionMode) => {
      patch({ mode });
      const provider = providerRef.current;
      if (!provider) return;
      if (mode === 'text') provider.stopListening();
      else void provider.startListening().catch(() => undefined);
    },
    [patch],
  );

  const setOutputDevice = useCallback((deviceId: string) => {
    void providerRef.current?.setOutputDevice?.(deviceId).catch(() => undefined);
  }, []);

  const reportNotInDanger = useCallback(() => applySafetyTrigger({ type: 'user_reports_not_in_danger' }), [applySafetyTrigger]);
  const requestHuman = useCallback(() => applySafetyTrigger({ type: 'user_requests_human' }), [applySafetyTrigger]);

  /** Retry after a connection failure without losing the app. */
  const retry = useCallback(async () => {
    unsubscribeRef.current?.();
    await providerRef.current?.disconnect().catch(() => undefined);
    providerRef.current = null;
    turnsRef.current = [];
    patch({ phase: 'gate', turns: [], error: null, connection: 'disconnected', conversation: 'idle' });
  }, [patch]);

  /**
   * Ask Noor to close the conversation with a short spoken recap. The member
   * can also skip straight to the summary with `end()`.
   */
  const requestRecap = useCallback(() => {
    const provider = providerRef.current;
    patch({ phase: 'recapping' });
    provider?.requestSpokenTurn?.(
      'The member has chosen to finish. In no more than four short sentences: recap what you talked about today, name the one or two things they said they would try, and close warmly. Do not ask a new question.',
    );
  }, [patch]);

  /* ─── End ───────────────────────────────────────────────────────────── */

  const end = useCallback(async (): Promise<string | null> => {
    const session = sessionRef.current;
    if (!session || endingRef.current) return session?.id ?? null;
    endingRef.current = true;
    patch({ phase: 'ending' });

    unsubscribeRef.current?.();
    await providerRef.current?.disconnect().catch(() => undefined);

    const durationSeconds = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0;
    const turns = turnsRef.current;
    const topics = deriveTopics(turns, profile?.primaryConcerns ?? []);
    const languages = turns.map((t) => t.language).filter((l): l is NonNullable<typeof l> => l !== null);
    const languageDetected = languages.length > 0 ? mostCommon(languages) : null;
    const engineTopic: ConcernId | null = insightsRef.current.topic ?? topics[0] ?? null;

    try {
      const ended = await repo.endSession({
        sessionId: session.id,
        durationSeconds,
        topicTags: [...topics, ...(maxSafetyRef.current !== 'NORMAL' ? ['safety'] : [])],
        languageDetected,
        maxSafetyState: maxSafetyRef.current,
        countedTowardsAllowance: durationSeconds >= MIN_BILLABLE_SESSION_SECONDS,
      });
      sessionRef.current = ended;

      if (canPersistSessionSummary(consent)) {
        await repo.saveSummary(
          buildSessionSummary({
            sessionId: session.id,
            turns,
            agreedActions: agreedRef.current,
            topic: engineTopic,
            interventionSlug: insightsRef.current.exercise,
            maxSafetyState: maxSafetyRef.current,
            fallbackConcerns: profile?.primaryConcerns ?? [],
          }),
        );
      }
      await refresh();
      patch({ phase: 'ended', session: ended, conversation: 'ended' });
      return ended.id;
    } catch (err) {
      patch({ phase: 'ended', error: err instanceof Error ? err.message : 'save_failed' });
      return session.id;
    }
  }, [consent, patch, profile?.primaryConcerns, refresh, repo]);

  /* ─── Timer & cleanup ───────────────────────────────────────────────── */

  useEffect(() => {
    if (state.phase !== 'live' && state.phase !== 'recapping') return;
    const interval = window.setInterval(() => {
      if (startedAtRef.current) {
        patch({ elapsedSeconds: Math.round((Date.now() - startedAtRef.current) / 1000) });
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [state.phase, patch]);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      void providerRef.current?.disconnect().catch(() => undefined);
    };
  }, []);

  return {
    state,
    coachingAllowed: isCoachingAllowed(state.safetyState),
    connect,
    end,
    retry,
    requestRecap,
    toggleMic,
    pause,
    resume,
    interrupt,
    sendText,
    switchMode,
    setOutputDevice,
    reportNotInDanger,
    requestHuman,
  };
}

function mostCommon<T extends string>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
