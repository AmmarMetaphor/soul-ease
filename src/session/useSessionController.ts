import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { MIN_BILLABLE_SESSION_SECONDS } from '@/config/app';
import { useData } from '@/data/DataContext';
import type { ConcernId, InteractionMode, WellbeingSession } from '@/data/types';
import { RepositoryError } from '@/data/repository';
import { evaluateEntitlement } from '@/entitlements/entitlement';
import { canPersistTranscript, canPersistSessionSummary } from '@/memory/permissions';
import { buildNoorInstructions } from '@/noor/persona';
import { createFallbackProvider, createRealtimeProvider } from '@/realtime/createProvider';
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
import { buildSessionSummary, deriveTopics } from './summaryBuilder';

export type SessionPhase = 'checking' | 'blocked' | 'starting' | 'live' | 'ending' | 'ended' | 'failed';

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
  elapsedSeconds: number;
  error: string | null;
  notice: 'demo' | 'fallback' | null;
  providerKind: RealtimeConversationProvider['kind'] | null;
  capabilities: RealtimeConversationProvider['capabilities'] | null;
  entitlementBlocked: boolean;
  agreedActions: string[];
}

/**
 * Orchestrates one live session: entitlement check → repo session row →
 * realtime provider → safety screening → transcript persistence (consent
 * permitting) → end-of-session summary.
 *
 * UI components only read state and call the returned actions.
 */
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
    elapsedSeconds: 0,
    error: null,
    notice: null,
    providerKind: null,
    capabilities: null,
    entitlementBlocked: false,
    agreedActions: [],
  });

  const patch = useCallback((update: Partial<SessionControllerState>) => {
    setState((prev) => ({ ...prev, ...update }));
  }, []);

  /* ─── Safety ────────────────────────────────────────────────────────── */

  const applySafetyTrigger = useCallback(
    async (trigger: SafetyTrigger) => {
      const transition = transitionSafetyState(safetyRef.current, trigger);
      if (!transition.changed) return;
      safetyRef.current = transition.to;
      maxSafetyRef.current = maxSafetyState(maxSafetyRef.current, transition.to);
      patch({ safetyState: transition.to, maxSafety: maxSafetyRef.current });
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

  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      switch (event.type) {
        case 'connection':
          patch({ connection: event.state });
          if (event.state === 'failed') patch({ error: event.detail ?? 'Connection failed.' });
          break;
        case 'state':
          patch({ conversation: event.state });
          break;
        case 'mic_permission':
          patch({ micPermission: event.state });
          break;
        case 'audio_level':
          patch({ level: event.level });
          break;
        case 'user_transcript':
          if (event.final) {
            patch({ liveUserText: '' });
          } else {
            patch({ liveUserText: event.text });
          }
          break;
        case 'assistant_text':
          noorTextRef.current[event.turnId] = event.text;
          patch({ liveNoorText: event.final ? '' : event.text });
          break;
        case 'assistant_speech_stopped':
          if (event.cancelled) {
            const partial = noorTextRef.current[event.turnId];
            if (partial) {
              const turn: TranscriptTurn = {
                id: event.turnId,
                role: 'noor',
                text: `${partial}—`,
                language: null,
                final: true,
                startedAt: Date.now(),
              };
              turnsRef.current = [...turnsRef.current, turn];
              patch({ turns: turnsRef.current, liveNoorText: '' });
              persistTurn(turn);
            }
          }
          delete noorTextRef.current[event.turnId];
          break;
        case 'turn_completed': {
          turnsRef.current = [...turnsRef.current, event.turn];
          patch({ turns: turnsRef.current, liveUserText: event.turn.role === 'user' ? '' : undefined });
          persistTurn(event.turn);
          if (event.turn.role === 'user') {
            if (detectsHumanSupportRequest(event.turn.text)) {
              void applySafetyTrigger({ type: 'user_requests_human' });
            } else {
              const level = screenTextForSafety(event.turn.text);
              if (level !== 'none') void applySafetyTrigger({ type: 'conversation_signal', level });
            }
          }
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
    [applySafetyTrigger, patch, persistTurn],
  );

  /* ─── Start ─────────────────────────────────────────────────────────── */

  const start = useCallback(
    async (mode: InteractionMode) => {
      if (!profile || !entitlement) return;
      const decision = evaluateEntitlement(entitlement);
      if (!decision.canStartSession) {
        patch({ phase: 'blocked', entitlementBlocked: true, mode });
        return;
      }
      patch({ phase: 'starting', mode, error: null });

      let session: WellbeingSession;
      try {
        session = await repo.startSession(mode);
      } catch (err) {
        if (err instanceof RepositoryError && err.message === 'ENTITLEMENT_EXHAUSTED') {
          patch({ phase: 'blocked', entitlementBlocked: true });
          await refresh();
          return;
        }
        patch({ phase: 'failed', error: err instanceof Error ? err.message : 'The session could not be started.' });
        return;
      }
      sessionRef.current = session;
      startedAtRef.current = Date.now();

      // Long-term memory only enters the session if the member allowed it.
      let memories: string[] = [];
      let previousMax: SafetyState | null = null;
      try {
        if (consent.longTermMemory) {
          const items = await repo.listMemories();
          memories = items.slice(0, 8).map((m) => m.content);
        }
        const previous = await repo.listSessions();
        const last = previous.find((s) => s.id !== session.id && s.status === 'ended');
        previousMax = last?.maxSafetyState ?? null;
      } catch {
        /* non-fatal */
      }
      const initialSafety = initialStateForNewSession(previousMax);
      safetyRef.current = initialSafety;
      maxSafetyRef.current = initialSafety;

      const connectOptions = {
        mode,
        preferredLanguage: profile.preferredLanguage,
        memoryContext: memories,
        displayName: profile.displayName,
        instructions: buildNoorInstructions({
          displayName: profile.displayName,
          preferredLanguage: profile.preferredLanguage,
          memoryContext: memories,
          openGently: initialSafety !== 'NORMAL',
        }),
        openGently: initialSafety !== 'NORMAL',
      };

      let provider = createRealtimeProvider({ getAccessToken });
      let notice: SessionControllerState['notice'] = provider.kind === 'demo' ? 'demo' : null;
      let unsubscribe = provider.subscribe(handleEvent);
      try {
        await provider.connect(connectOptions);
      } catch (err) {
        unsubscribe();
        const recoverable = err instanceof RealtimeError && (err.code === 'not_configured' || err.code === 'not_implemented');
        if (!recoverable) {
          patch({ phase: 'failed', error: err instanceof Error ? err.message : 'Could not connect.' });
          return;
        }
        provider = createFallbackProvider();
        notice = 'fallback';
        unsubscribe = provider.subscribe(handleEvent);
        await provider.connect(connectOptions);
      }
      providerRef.current = provider;
      unsubscribeRef.current = unsubscribe;
      provider.updateSafetyState?.(initialSafety);

      patch({
        phase: 'live',
        session,
        notice,
        providerKind: provider.kind,
        capabilities: provider.capabilities,
        safetyState: initialSafety,
        maxSafety: initialSafety,
      });

      if (mode === 'audio') {
        try {
          await provider.startListening();
        } catch (err) {
          // Mic problems are surfaced via events; the member can type instead.
          if (!(err instanceof RealtimeError)) patch({ error: 'Microphone could not be started.' });
        }
      }
    },
    [consent.longTermMemory, entitlement, getAccessToken, handleEvent, patch, profile, refresh, repo],
  );

  /* ─── Controls ──────────────────────────────────────────────────────── */

  const toggleMic = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) return;
    if (state.micPermission === 'granted' && state.conversation === 'listening') {
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

  const reportNotInDanger = useCallback(() => applySafetyTrigger({ type: 'user_reports_not_in_danger' }), [applySafetyTrigger]);
  const requestHuman = useCallback(() => applySafetyTrigger({ type: 'user_requests_human' }), [applySafetyTrigger]);

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
        const summary = buildSessionSummary({
          sessionId: session.id,
          turns,
          agreedActions: agreedRef.current,
          topic: engineTopic,
          interventionSlug: insightsRef.current.exercise,
          maxSafetyState: maxSafetyRef.current,
          fallbackConcerns: profile?.primaryConcerns ?? [],
        });
        await repo.saveSummary(summary);
      }
      await refresh();
      patch({ phase: 'ended', session: ended, conversation: 'ended' });
      return ended.id;
    } catch (err) {
      patch({ phase: 'ended', error: err instanceof Error ? err.message : 'The session could not be saved.' });
      return session.id;
    }
  }, [consent, patch, profile?.primaryConcerns, refresh, repo]);

  /* ─── Timer & cleanup ───────────────────────────────────────────────── */

  useEffect(() => {
    if (state.phase !== 'live') return;
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
    start,
    end,
    toggleMic,
    pause,
    resume,
    interrupt,
    sendText,
    switchMode,
    reportNotInDanger,
    requestHuman,
  };
}

function mostCommon<T extends string>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
