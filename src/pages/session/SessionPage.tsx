import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NoorOrb, type OrbMood } from '@/components/brand/NoorOrb';
import { Logo } from '@/components/brand/Logo';
import { Button, LinkButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { PageLoader } from '@/components/ui/Spinner';
import { ErrorState, InlineNotice } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useData } from '@/data/DataContext';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/dates';
import { canPersistTranscript } from '@/memory/permissions';
import { isSafetyInterfaceActive } from '@/safety/machine';
import { useSessionController } from '@/session/useSessionController';
import { AudioSettingsSheet } from './components/AudioSettingsSheet';
import { MicNotice } from './components/MicNotice';
import { SafetyModePanel } from './components/SafetyModePanel';
import { SessionControls } from './components/SessionControls';
import { TextComposer } from './components/TextComposer';
import { TranscriptPanel } from './components/TranscriptPanel';

/**
 * The live session — audio-first, one large orb, minimal chrome.
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
  const startedRef = useRef(false);

  useEffect(() => {
    if (loading || !profile || startedRef.current) return;
    startedRef.current = true;
    void controller.start(profile.preferredMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile]);

  useEffect(() => {
    if (state.mode === 'text') setTranscriptOpen(true);
  }, [state.mode]);

  const endSession = useCallback(async () => {
    setConfirmEnd(false);
    const id = await controller.end();
    if (id) navigate(ROUTES.sessionSummary(id), { replace: true });
    else navigate(ROUTES.dashboard, { replace: true });
  }, [controller, navigate]);

  if (loading || state.phase === 'checking') return <PageLoader label={t('session.connecting')} />;

  if (state.phase === 'blocked') {
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Logo to={ROUTES.dashboard} />
        </header>
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 text-center">
          <NoorOrb state="paused" size="md" />
          <h1 className="mt-8 text-3xl font-medium text-ink-900">{t('session.entitlementTitle')}</h1>
          <p className="mt-3 leading-relaxed text-ink-700">{t('session.entitlementBody')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton to={ROUTES.dashboard}>{t('summary.returnHome')}</LinkButton>
            <LinkButton to={ROUTES.safety} variant="secondary">
              {t('nav.safety')}
            </LinkButton>
          </div>
        </main>
      </div>
    );
  }

  if (state.phase === 'failed') {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5">
        <ErrorState message={state.error ?? t('errors.sessionStartFailed')} onRetry={() => void controller.start(state.mode)} />
        <Link to={ROUTES.dashboard} className="mt-6 text-sm font-semibold text-emerald-700">
          {t('summary.returnHome')}
        </Link>
      </div>
    );
  }

  const safetyUi = isSafetyInterfaceActive(state.safetyState);
  const orbState: OrbMood = safetyUi ? 'safety' : state.conversation;
  const statusLabel = statusText(state.conversation, state.phase, safetyUi, t);
  const transcriptPersisted = canPersistTranscript(consent);
  const disabled = state.phase !== 'live';

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col transition-colors duration-700',
        safetyUi ? 'bg-ivory-50' : 'bg-[radial-gradient(ellipse_at_top,#f7f4ee_0%,#efeae0_55%,#e9efe6_100%)]',
      )}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Logo to={ROUTES.dashboard} compact />
        <div className="flex items-center gap-3 text-xs font-medium text-ink-500">
          {state.safetyState === 'ELEVATED_SUPPORT' && (
            <span className="rounded-full bg-dusk-100 px-2.5 py-1 text-dusk-500">{t('session.safetyBanner').split('.')[0]}</span>
          )}
          <span className="tabular-nums" aria-label={t('session.elapsed')}>
            {formatClock(state.elapsedSeconds)}
          </span>
        </div>
      </header>

      {/* Notices */}
      <div className="mx-auto w-full max-w-2xl space-y-2 px-5">
        {state.notice === 'demo' && <p className="text-center text-xs text-ink-500">{t('session.demoNotice')}</p>}
        {state.notice === 'fallback' && <p className="text-center text-xs text-warn-600">{t('session.fallbackNotice')}</p>}
        <MicNotice micPermission={state.micPermission} capabilities={state.capabilities} mode={state.mode} />
        {state.error && state.phase === 'live' && (
          <InlineNotice tone="warn" className="text-xs">
            {state.error}
          </InlineNotice>
        )}
      </div>

      {/* Stage */}
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-6">
        {safetyUi ? (
          <div className="flex w-full flex-col items-center gap-8">
            <NoorOrb state="safety" size="md" level={0} />
            <SafetyModePanel
              safetyState={state.safetyState}
              onNotInDanger={() => void controller.reportNotInDanger()}
              onRequestHuman={() => void controller.requestHuman()}
              onEnd={() => void endSession()}
            />
            {/* Talking remains available in Safety Mode — the composer is always on. */}
            <div className="w-full max-w-xl">
              <TextComposer onSend={controller.sendText} disabled={disabled} />
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
          <div className={cn('grid w-full max-w-5xl flex-1 items-center gap-8', transcriptOpen && 'lg:grid-cols-[1fr_minmax(20rem,26rem)]')}>
            <div className="flex flex-col items-center">
              <NoorOrb
                state={orbState}
                level={state.level}
                size="xl"
                onClick={state.conversation === 'speaking' ? controller.interrupt : undefined}
                label={state.conversation === 'speaking' ? t('session.tapToInterrupt') : undefined}
              />
              <p className="mt-12 text-sm font-medium text-ink-500" aria-live="polite">
                {statusLabel}
              </p>
              {state.conversation === 'speaking' && (
                <p className="mt-1 text-xs text-ink-300">{t('session.tapToInterrupt')}</p>
              )}
              {state.conversation === 'ready' && state.mode === 'audio' && state.micPermission !== 'granted' && (
                <p className="mt-1 text-xs text-ink-300">{t('session.tapToTalk')}</p>
              )}

              {/* Live caption when transcript is hidden */}
              {!transcriptOpen && (state.liveNoorText || state.liveUserText) && (
                <p dir="auto" className="mt-6 max-w-xl text-center text-base leading-relaxed text-ink-700 animate-fade-up">
                  {state.liveNoorText || state.liveUserText}
                </p>
              )}
            </div>

            {transcriptOpen && (
              <aside className="card flex max-h-[60vh] flex-col overflow-hidden p-4 lg:max-h-[70vh]">
                <div className="flex-1 overflow-y-auto pe-1">
                  <TranscriptPanel
                    turns={state.turns}
                    liveUserText={state.liveUserText}
                    liveNoorText={state.liveNoorText}
                    persisted={transcriptPersisted}
                  />
                </div>
                <div className="mt-3">
                  <TextComposer onSend={controller.sendText} disabled={disabled} autoFocus={state.mode === 'text'} />
                </div>
              </aside>
            )}
          </div>
        )}
      </main>

      {/* Controls */}
      {!safetyUi && (
        <footer className="px-5 pb-8 pt-2 sm:pb-10" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          <SessionControls
            conversation={state.conversation}
            micPermission={state.micPermission}
            mode={state.mode}
            transcriptOpen={transcriptOpen}
            disabled={disabled}
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

      <Dialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title={t('session.endConfirmTitle')}
        description={t('session.endConfirmBody')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
              {t('session.keepTalking')}
            </Button>
            <Button onClick={() => void endSession()} loading={state.phase === 'ending'}>
              {t('session.endConfirm')}
            </Button>
          </>
        }
      />

      <AudioSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} capabilities={state.capabilities} providerKind={state.providerKind} />
    </div>
  );
}

function statusText(
  conversation: string,
  phase: string,
  safety: boolean,
  t: ReturnType<typeof useT>,
): string {
  if (phase === 'ending') return t('session.ending');
  if (safety) return t('session.safety');
  switch (conversation) {
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
