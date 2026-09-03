import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { NoorPortrait } from '@/components/brand/NoorPortrait';
import { Button, LinkButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { PageLoader } from '@/components/ui/Spinner';
import { InlineNotice } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useData } from '@/data/DataContext';
import type { InteractionMode } from '@/data/types';
import { useT } from '@/i18n';
import type { TranslateFn } from '@/i18n/types';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/dates';
import { canPersistTranscript } from '@/memory/permissions';
import { isSafetyInterfaceActive } from '@/safety/machine';
import { useSessionController, type SessionControllerState } from '@/session/useSessionController';
import { AudioSettingsSheet } from './components/AudioSettingsSheet';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { MicGate } from './components/MicGate';
import { MicNotice } from './components/MicNotice';
import { NoorPresence } from './components/NoorPresence';
import { SafetyModePanel } from './components/SafetyModePanel';
import { SessionControls } from './components/SessionControls';
import { TextComposer } from './components/TextComposer';
import { TranscriptPanel } from './components/TranscriptPanel';

/**
 * The live session — a real conversation with Noor.
 *
 * Flow: entitlement check → "Ready to talk?" gate → realtime connection →
 * live conversation (voice or text, switchable) → optional spoken recap →
 * Phase 1 session summary.
 */
export function SessionPage() {
  const t = useT();
  const navigate = useNavigate();
  const { profile, consent, loading } = useData();
  const controller = useSessionController(profile?.preferredMode ?? 'audio');
  const { state } = controller;
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    if (state.mode === 'text' && state.phase === 'live') setTranscriptOpen(true);
  }, [state.mode, state.phase]);

  const finish = useCallback(async () => {
    setConfirmEnd(false);
    const id = await controller.end();
    navigate(id ? ROUTES.sessionSummary(id) : ROUTES.dashboard, { replace: true });
  }, [controller, navigate]);

  if (loading || state.phase === 'checking') return <PageLoader label={t('session.connecting')} />;

  /* ─── Free sessions used ────────────────────────────────────────────── */
  if (state.phase === 'blocked') {
    return (
      <SessionFrame>
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 text-center">
          <NoorPortrait size="lg" />
          <h1 className="mt-8 text-3xl font-medium text-ink-900">{t('session.entitlementTitle')}</h1>
          <p className="mt-3 leading-relaxed text-ink-700">{t('session.entitlementBody')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton to={ROUTES.dashboard}>{t('summary.returnHome')}</LinkButton>
            <LinkButton to={ROUTES.safety} variant="secondary">
              {t('nav.safety')}
            </LinkButton>
          </div>
        </main>
      </SessionFrame>
    );
  }

  /* ─── Ready to talk? ────────────────────────────────────────────────── */
  if (state.phase === 'gate' || state.phase === 'connecting') {
    return (
      <SessionFrame>
        <main className="flex flex-1 items-center justify-center py-8">
          <MicGate
            mode={state.mode}
            connecting={state.phase === 'connecting'}
            error={state.error ? errorMessage(state.error, t) : null}
            onStart={(mode: InteractionMode) => void controller.connect(mode)}
          />
        </main>
        <DiagnosticsPanel
          connection={state.connection}
          conversation={state.conversation}
          voice={state.voice}
          model={state.model}
          providerKind={state.providerKind}
          micPermission={state.micPermission}
        />
      </SessionFrame>
    );
  }

  /* ─── Connection failed ─────────────────────────────────────────────── */
  if (state.phase === 'failed') {
    return (
      <SessionFrame>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5">
          <NoorPortrait size="md" className="mb-6 self-center" />
          <h1 className="text-center text-2xl font-medium text-ink-900">
            {needsSignIn(state.error) ? t('session.signInTitle') : t('session.failedTitle')}
          </h1>
          <p className="mt-2 text-center leading-relaxed text-ink-700">{errorMessage(state.error, t)}</p>
          <div className="mt-8 flex flex-col gap-2">
            {needsSignIn(state.error) ? (
              <>
                <LinkButton to={ROUTES.login}>{t('common.signIn')}</LinkButton>
                <LinkButton to={ROUTES.dashboard} variant="ghost">
                  {t('summary.returnHome')}
                </LinkButton>
              </>
            ) : (
              <>
                <Button onClick={() => void controller.retry()}>{t('session.tryAgain')}</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    void controller.retry().then(() => controller.connect('text'));
                  }}
                >
                  {t('session.continueByText')}
                </Button>
                <Button variant="ghost" onClick={() => void finish()}>
                  {t('session.endSafely')}
                </Button>
              </>
            )}
          </div>
        </main>
        <DiagnosticsPanel
          connection={state.connection}
          conversation={state.conversation}
          voice={state.voice}
          model={state.model}
          providerKind={state.providerKind}
          micPermission={state.micPermission}
        />
      </SessionFrame>
    );
  }

  /* ─── Live ──────────────────────────────────────────────────────────── */
  const safetyUi = isSafetyInterfaceActive(state.safetyState);
  const transcriptPersisted = canPersistTranscript(consent);
  const controlsDisabled = state.phase === 'ending';
  const reconnecting = state.connection === 'reconnecting';

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col transition-colors duration-700',
        safetyUi ? 'bg-ivory-50' : 'bg-[radial-gradient(ellipse_at_top,#f7f4ee_0%,#efeae0_55%,#e9efe6_100%)]',
      )}
    >
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Logo to={ROUTES.dashboard} compact />
        <div className="flex items-center gap-3 text-xs font-medium text-ink-500">
          {state.safetyState === 'ELEVATED_SUPPORT' && (
            <span className="rounded-full bg-dusk-100 px-2.5 py-1 text-dusk-500">{t('session.elevated')}</span>
          )}
          <span className="tabular-nums" aria-label={t('session.elapsed')}>
            {formatClock(state.elapsedSeconds)}
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-2 px-5">
        {reconnecting && (
          <InlineNotice tone="warn" className="text-center text-xs">
            {t('session.reconnecting')}
          </InlineNotice>
        )}
        {state.notice === 'demo' && <p className="text-center text-xs text-ink-500">{t('session.demoNotice')}</p>}
        {state.notice === 'fallback' && <p className="text-center text-xs text-warn-600">{t('session.fallbackNotice')}</p>}
        <MicNotice micPermission={state.micPermission} capabilities={state.capabilities} mode={state.mode} />
        {state.error && !reconnecting && (
          <InlineNotice tone="warn" className="text-xs">
            {errorMessage(state.error, t)}
          </InlineNotice>
        )}
      </div>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-6">
        {safetyUi ? (
          <div className="flex w-full flex-col items-center gap-8">
            <NoorPortrait size="md" />
            <SafetyModePanel
              safetyState={state.safetyState}
              onNotInDanger={() => void controller.reportNotInDanger()}
              onRequestHuman={() => void controller.requestHuman()}
              onEnd={() => void finish()}
            />
            <div className="w-full max-w-xl">
              <TextComposer onSend={controller.sendText} disabled={controlsDisabled} />
            </div>
            <div className="w-full max-w-xl">
              <TranscriptPanel
                turns={state.turns.slice(-4)}
                liveUserText={state.liveUserText}
                liveNoorText={state.liveNoorText}
                persisted={transcriptPersisted}
              />
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'grid w-full max-w-5xl flex-1 items-center gap-8',
              transcriptOpen && 'lg:grid-cols-[1fr_minmax(20rem,26rem)]',
            )}
          >
            <NoorPresence
              conversation={state.phase === 'recapping' ? 'speaking' : state.conversation}
              level={state.level}
              levelSource={state.levelSource}
              statusLabel={statusText(state, safetyUi, t)}
              hint={statusHint(state, t)}
              onInterrupt={controller.interrupt}
              interruptLabel={t('session.tapToInterrupt')}
            />

            {!transcriptOpen && (state.liveNoorText || state.liveUserText) && (
              <p dir="auto" className="mx-auto max-w-xl text-center text-base leading-relaxed text-ink-700 animate-fade-up lg:col-start-1">
                {state.liveNoorText || state.liveUserText}
              </p>
            )}

            {transcriptOpen && (
              <aside className="card flex max-h-[52vh] flex-col overflow-hidden p-4 lg:max-h-[70vh]">
                <div className="flex-1 overflow-y-auto pe-1">
                  <TranscriptPanel
                    turns={state.turns}
                    liveUserText={state.liveUserText}
                    liveNoorText={state.liveNoorText}
                    persisted={transcriptPersisted}
                  />
                </div>
                <div className="mt-3">
                  <TextComposer onSend={controller.sendText} disabled={controlsDisabled} autoFocus={state.mode === 'text'} />
                </div>
              </aside>
            )}
          </div>
        )}
      </main>

      {!safetyUi && (
        <footer
          className="px-5 pb-8 pt-2 sm:pb-10"
          style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
        >
          <SessionControls
            conversation={state.conversation}
            micPermission={state.micPermission}
            mode={state.mode}
            transcriptOpen={transcriptOpen}
            disabled={controlsDisabled}
            onToggleMic={() => void controller.toggleMic()}
            onPause={controller.pause}
            onResume={controller.resume}
            onEnd={() => setConfirmEnd(true)}
            onToggleMode={() => controller.switchMode(state.mode === 'audio' ? 'text' : 'audio')}
            onToggleTranscript={() => setTranscriptOpen((v) => !v)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </footer>
      )}

      {/* Ending is deliberate: a recap by default, an immediate exit if wanted. */}
      <Dialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title={t('session.endConfirmTitle')}
        description={t('session.endRecapBody')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
              {t('session.keepTalking')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmEnd(false);
                controller.requestRecap();
              }}
            >
              {t('session.recapFirst')}
            </Button>
            <Button onClick={() => void finish()} loading={state.phase === 'ending'}>
              {t('session.endNow')}
            </Button>
          </>
        }
      />

      {state.phase === 'recapping' && (
        <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-5">
          <div className="flex items-center gap-3 rounded-full bg-white/90 px-4 py-2 text-sm shadow-lift ring-1 ring-ink-900/10 backdrop-blur">
            <span className="text-ink-700">{t('session.recapInProgress')}</span>
            <Button size="sm" onClick={() => void finish()}>
              {t('session.seeSummary')}
            </Button>
          </div>
        </div>
      )}

      <AudioSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        capabilities={state.capabilities}
        providerKind={state.providerKind}
        onSelectOutputDevice={controller.setOutputDevice}
      />

      <DiagnosticsPanel
        connection={state.connection}
        conversation={state.conversation}
        voice={state.voice}
        model={state.model}
        providerKind={state.providerKind}
        micPermission={state.micPermission}
      />
    </div>
  );
}

function SessionFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top,#f7f4ee_0%,#efeae0_55%,#e9efe6_100%)]">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Logo to={ROUTES.dashboard} />
        <Link to={ROUTES.dashboard} className="text-sm font-semibold text-ink-500 hover:text-ink-900">
          ✕
        </Link>
      </header>
      {children}
    </div>
  );
}

/** Member-facing state text. Never exposes WebRTC or VAD terminology. */
function statusText(state: SessionControllerState, safety: boolean, t: TranslateFn): string {
  if (state.phase === 'ending') return t('session.ending');
  if (state.phase === 'recapping') return t('session.speaking');
  if (safety) return t('session.safety');
  if (state.connection === 'reconnecting') return t('session.reconnectingShort');
  switch (state.conversation) {
    case 'connecting':
      return t('session.connecting');
    case 'listening':
      return t('session.listening');
    case 'thinking':
      return t('session.thinking');
    case 'speaking':
      return t('session.speaking');
    case 'interrupted':
      return t('session.interrupted');
    case 'paused':
      return t('session.paused');
    case 'ending':
    case 'ended':
      return t('session.ending');
    default:
      return t('session.ready');
  }
}

function statusHint(state: SessionControllerState, t: TranslateFn): string | undefined {
  if (state.conversation === 'listening' && state.level < 0.02) return t('session.listeningHint');
  if (state.conversation === 'paused') return t('session.pausedHint');
  if (state.micPermission !== 'granted' && state.mode === 'audio') return t('session.tapToTalk');
  return undefined;
}

/**
 * Translate controller error codes into an accurate member-facing message.
 *
 * Each failure gets its own wording: a misconfigured voice backend must never
 * tell a signed-in member that they are not signed in, and an internal server
 * message is never shown to a member.
 */
function errorMessage(error: string | null, t: TranslateFn): string {
  switch (error) {
    case null:
      return '';
    case 'not_signed_in':
      return t('session.errNotSignedIn');
    case 'session_expired':
      return t('session.errSessionExpired');
    case 'not_configured':
    case 'credential_failed':
    case 'not_implemented':
      return t('session.errVoiceUnavailable');
    case 'connection_failed':
    case 'connection_lost':
      return t('session.errNetwork');
    case 'microphone_denied':
      return t('session.micDeniedBody');
    case 'microphone_unavailable':
      return t('session.micUnavailableBody');
    case 'unsupported_browser':
      return t('session.unsupportedBody');
    case 'session_start_failed':
      return t('errors.sessionStartFailed');
    case 'connect_failed':
      return t('session.connectFailed');
    case 'save_failed':
      return t('errors.saveFailed');
    default:
      // Never surface an internal message; say something true and generic.
      return t('session.connectFailed');
  }
}

/** Signing in again only helps when that is genuinely the problem. */
function needsSignIn(error: string | null): boolean {
  return error === 'not_signed_in' || error === 'session_expired';
}
