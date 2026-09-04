import { useEffect, useState } from 'react';
import { env } from '@/config/env';
import { diagnostics, type DiagnosticEntry, type RealtimeStatus } from '@/realtime/diagnostics';
import { cn } from '@/lib/cn';

interface DiagnosticsPanelProps {
  connection: string;
  conversation: string;
  voice: string | null;
  model: string | null;
  providerKind: string | null;
  micPermission: string;
}

const CHANNEL_TONE: Record<DiagnosticEntry['channel'], string> = {
  connection: 'text-emerald-300',
  peer: 'text-sage-300',
  data: 'text-dusk-300',
  turn: 'text-ivory-100',
  audio: 'text-sage-200',
  error: 'text-warn-100',
};

/**
 * Realtime diagnostics — development only.
 *
 * Rendered only when env.devToolsEnabled is true, so it can never appear for
 * ordinary production users. Shows connection and turn events; never a key,
 * an ephemeral secret, or conversation content.
 */
export function DiagnosticsPanel(props: DiagnosticsPanelProps) {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const [status, setStatus] = useState<RealtimeStatus>(diagnostics.statusSnapshot());
  const [open, setOpen] = useState(false);

  useEffect(() => diagnostics.subscribe(setEntries), []);
  useEffect(() => diagnostics.subscribeStatus(setStatus), []);

  if (!env.devToolsEnabled) return null;

  return (
    <div className="fixed bottom-3 left-3 z-50 max-w-[min(26rem,calc(100vw-1.5rem))] font-mono text-[10px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-ink-900/90 px-3 py-1.5 font-semibold text-ivory-100 shadow-soft backdrop-blur"
      >
        dev · realtime {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="mt-2 rounded-xl bg-ink-900/95 p-3 text-ivory-100 shadow-lift backdrop-blur">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-b border-ivory-100/15 pb-2">
            <Row label="provider" value={props.providerKind ?? '—'} />
            <Row label="model" value={props.model ?? '—'} />
            <Row label="voice" value={props.voice ?? '—'} />
            <Row label="connection" value={props.connection} />
            <Row label="conversation" value={props.conversation} />
            <Row label="mic" value={props.micPermission} />
          </dl>

          {/*
            Is a realtime model actually answering, or is something local
            doing it? Read top to bottom. `demoMode` true, or
            `responseCreatedByRealtimeModel` stuck at 0 while turns climb,
            means the replies are not the model's.
          */}
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-b border-ivory-100/15 pb-2">
            <Row label="engine" value={status.engine} tone={status.engine === 'scripted_demo' ? 'bad' : undefined} />
            <Row label="demoMode" value={yn(status.demoMode)} tone={status.demoMode ? 'bad' : 'good'} />
            <Row
              label="realtimeConnected"
              value={yn(status.realtimeConnected)}
              tone={status.realtimeConnected ? 'good' : 'bad'}
            />
            <Row label="currentUserTurnReceived" value={yn(status.currentUserTurnReceived)} />
            <Row label="userTranscriptAvailable" value={yn(status.userTranscriptAvailable)} />
            {/* Length only — a transcript's content is never shown here. */}
            <Row label="lastUserTranscriptChars" value={String(status.lastUserTranscriptChars)} />
            <Row label="conversationItemCreated" value={yn(status.conversationItemCreated)} />
            <Row
              label="responseCreatedByRealtimeModel"
              value={String(status.responseCreatedByRealtimeModel)}
              tone={status.conversationTurnCount > 0 && status.responseCreatedByRealtimeModel === 0 ? 'bad' : undefined}
            />
            <Row label="conversationTurnCount" value={String(status.conversationTurnCount)} />
            <Row label="userTurnCount" value={String(status.userTurnCount)} />
            <Row label="historyReseededTurns" value={String(status.historyReseededTurns)} />
            <Row label="instructionChars" value={String(status.instructionChars)} />
          </dl>

          <div className="mt-2 max-h-56 overflow-y-auto">
            {entries.length === 0 && <p className="text-ivory-100/50">no events yet</p>}
            {[...entries].reverse().map((entry, i) => (
              <p key={`${entry.at}-${i}`} className="flex gap-2 leading-relaxed">
                <span className="shrink-0 text-ivory-100/40">
                  {new Date(entry.at).toLocaleTimeString([], { hour12: false })}
                </span>
                <span className={cn('shrink-0', CHANNEL_TONE[entry.channel])}>{entry.channel}</span>
                <span className="min-w-0 break-words">
                  {entry.label}
                  {entry.detail ? ` · ${entry.detail}` : ''}
                </span>
              </p>
            ))}
          </div>
          <button type="button" onClick={() => diagnostics.clear()} className="mt-2 text-ivory-100/60 underline">
            clear
          </button>
        </div>
      )}
    </div>
  );
}

function yn(value: boolean): string {
  return value ? 'yes' : 'no';
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <>
      <dt className="truncate text-ivory-100/50">{label}</dt>
      <dd className={cn('truncate', tone === 'bad' && 'text-warn-100', tone === 'good' && 'text-emerald-300')}>
        {value}
      </dd>
    </>
  );
}
