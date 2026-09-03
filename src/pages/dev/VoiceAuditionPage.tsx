import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { NoorPortrait } from '@/components/brand/NoorPortrait';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, InlineNotice } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { env } from '@/config/env';
import { buildAuditionInstructions } from '@/noor/realtimeInstructions';
import { OpenAIRealtimeProvider } from '@/realtime/OpenAIRealtimeProvider';
import { AUDITION_LINES, AUDITION_VOICES, NOOR_VOICE, type RealtimeVoice } from '@/realtime/noorVoice';
import type { ConversationState, RealtimeEvent } from '@/realtime/types';
import { cn } from '@/lib/cn';

/**
 * Developer voice audition — never shown to members.
 *
 * A realtime session fixes its voice before the first audio frame, so each
 * voice is auditioned on its own short-lived session. The same three lines
 * (English, Urdu, mixed) are spoken by every candidate, so the comparison is
 * about the voice and nothing else.
 *
 * Reachable only when env.devToolsEnabled is true.
 */
export function VoiceAuditionPage() {
  const { getAccessToken } = useAuth();
  const providerRef = useRef<OpenAIRealtimeProvider | null>(null);
  const [voice, setVoice] = useState<RealtimeVoice>(AUDITION_VOICES[0]);
  const [connectedVoice, setConnectedVoice] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationState>('idle');
  const [spoken, setSpoken] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teardown = useCallback(async () => {
    const provider = providerRef.current;
    providerRef.current = null;
    setConnectedVoice(null);
    setConversation('idle');
    if (provider) await provider.disconnect().catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => {
      void providerRef.current?.disconnect().catch(() => undefined);
    };
  }, []);

  const connectVoice = useCallback(
    async (next: RealtimeVoice) => {
      setBusy(true);
      setError(null);
      setSpoken('');
      await teardown();
      const provider = new OpenAIRealtimeProvider({ getAccessToken, voiceOverride: next });
      provider.subscribe((event: RealtimeEvent) => {
        if (event.type === 'state') setConversation(event.state);
        if (event.type === 'assistant_text') setSpoken(event.text);
        if (event.type === 'error') setError(event.message);
      });
      try {
        await provider.connect({
          // Text mode: the audition never needs the microphone.
          mode: 'text',
          preferredLanguage: 'en',
          memoryContext: [],
          instructions: buildAuditionInstructions(),
          openGently: false,
          greetFirst: false,
        });
        providerRef.current = provider;
        setConnectedVoice(provider.currentVoice || next);
      } catch (err) {
        await provider.disconnect().catch(() => undefined);
        setError(err instanceof Error ? err.message : 'Could not connect.');
      } finally {
        setBusy(false);
      }
    },
    [getAccessToken, teardown],
  );

  if (!env.devToolsEnabled) return <Navigate to={ROUTES.dashboard} replace />;

  const speak = (text: string) => {
    setSpoken('');
    providerRef.current?.requestSpokenTurn(`Say exactly this, once, and nothing else: "${text}"`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Development only"
        title="Noor voice audition"
        subtitle="Each voice is auditioned on its own realtime session — a session's voice cannot change once audio has started. Members never see this page and never see a voice selector."
      />

      <InlineNotice tone="warn" className="mb-6">
        Configured default: <strong>{NOOR_VOICE}</strong>. The server has the final say via <code>NOOR_VOICE</code>;
        this page only overrides the voice for the session it creates.
      </InlineNotice>

      <Card className="mb-6">
        <CardHeader title="Candidate voice" />
        <div role="radiogroup" aria-label="Candidate voice" className="flex flex-wrap gap-2">
          {AUDITION_VOICES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="radio"
              aria-checked={voice === candidate}
              onClick={() => setVoice(candidate)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors',
                voice === candidate ? 'bg-emerald-700 text-ivory-50 ring-emerald-700' : 'bg-white text-ink-700 ring-ink-900/10',
              )}
            >
              {candidate}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => void connectVoice(voice)} loading={busy}>
            {connectedVoice ? `Reconnect as ${voice}` : `Connect as ${voice}`}
          </Button>
          {connectedVoice && (
            <Button variant="ghost" onClick={() => void teardown()}>
              Disconnect
            </Button>
          )}
          <span className="ms-auto text-xs text-ink-500">
            {connectedVoice ? `connected · ${connectedVoice} · ${conversation}` : 'not connected'}
          </span>
        </div>
      </Card>

      {error && <ErrorState message={error} className="mb-6" />}

      <Card>
        <CardHeader title="Identical test lines" />
        <ul className="space-y-3">
          {AUDITION_LINES.map((line) => (
            <li key={line.id} className="rounded-xl bg-ivory-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">{line.label}</p>
              <p dir="auto" className="mt-1 text-sm leading-relaxed text-ink-900">
                {line.text}
              </p>
              <Button
                size="sm"
                variant="soft"
                className="mt-3"
                disabled={!connectedVoice || conversation === 'speaking'}
                onClick={() => speak(line.text)}
              >
                {conversation === 'speaking' ? 'Speaking…' : 'Play'}
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {spoken && (
        <Card className="mt-6">
          <CardHeader title="What was spoken (transcript)" />
          <p dir="auto" className="text-sm leading-relaxed text-ink-700">
            {spoken}
          </p>
        </Card>
      )}

      <div className="mt-8 flex items-center gap-4">
        <NoorPortrait size="sm" />
        <Link to={ROUTES.dashboard} className="text-sm font-semibold text-emerald-700">
          ← Back to Soul Ease
        </Link>
      </div>
    </div>
  );
}
