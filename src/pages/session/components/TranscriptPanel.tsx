import { useEffect, useRef } from 'react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import type { TranscriptTurn } from '@/realtime/types';

interface TranscriptPanelProps {
  turns: TranscriptTurn[];
  liveUserText: string;
  liveNoorText: string;
  persisted: boolean;
  className?: string;
}

function dirFor(text: string): 'rtl' | 'ltr' {
  return /[؀-ۿ]/.test(text) ? 'rtl' : 'ltr';
}

export function TranscriptPanel({ turns, liveUserText, liveNoorText, persisted, className }: TranscriptPanelProps) {
  const t = useT();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [turns.length, liveUserText, liveNoorText]);

  const empty = turns.length === 0 && !liveUserText && !liveNoorText;

  return (
    <div className={cn('flex flex-col', className)} aria-live="polite" aria-label={t('session.transcript')}>
      {!persisted && <p className="mb-3 text-xs text-ink-500">{t('session.transcriptNotSaved')}</p>}
      {empty && <p className="py-10 text-center text-sm text-ink-300">{t('session.transcriptEmpty')}</p>}
      <ol className="space-y-3">
        {turns.map((turn) => (
          <TranscriptBubble key={turn.id} role={turn.role} text={turn.text} />
        ))}
        {liveNoorText && <TranscriptBubble role="noor" text={liveNoorText} live />}
        {liveUserText && <TranscriptBubble role="user" text={liveUserText} live />}
      </ol>
      <div ref={bottomRef} />
    </div>
  );
}

function TranscriptBubble({ role, text, live }: { role: 'user' | 'noor'; text: string; live?: boolean }) {
  const t = useT();
  const isNoor = role === 'noor';
  return (
    <li className={cn('flex', isNoor ? 'justify-start' : 'justify-end')}>
      <div
        dir={dirFor(text)}
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
          isNoor ? 'bg-white text-ink-900 ring-1 ring-ink-900/5' : 'bg-emerald-700 text-ivory-50',
          live && 'opacity-80',
        )}
      >
        <span className={cn('mb-0.5 block text-[10px] font-semibold uppercase tracking-wider', isNoor ? 'text-emerald-700' : 'text-ivory-50/70')}>
          {isNoor ? t('session.noor') : t('session.you')}
        </span>
        {text}
      </div>
    </li>
  );
}
