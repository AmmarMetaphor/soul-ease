import { NoorIdentity } from '@/components/brand/NoorPortrait';
import { Button } from '@/components/ui/Button';
import { KeyboardIcon, LockIcon, MicIcon } from '@/components/ui/Icons';
import { InlineNotice } from '@/components/ui/States';
import type { InteractionMode } from '@/data/types';
import { useT } from '@/i18n';

interface MicGateProps {
  mode: InteractionMode;
  connecting: boolean;
  error: string | null;
  onStart: (mode: InteractionMode) => void;
}

/**
 * "Ready to talk?" — the screen before anything is captured.
 *
 * No microphone is opened and no realtime credential is minted until the
 * member presses Start Conversation. The alternative (typing) is offered
 * with equal clarity so voice is never forced.
 */
export function MicGate({ mode, connecting, error, onStart }: MicGateProps) {
  const t = useT();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-5 text-center animate-fade-up">
      <NoorIdentity size="xl" className="flex-col gap-4 text-center [&>span:last-child]:text-center" />

      <h1 className="mt-8 text-3xl font-medium text-ink-900">{t('gate.title')}</h1>
      <p className="mt-3 leading-relaxed text-ink-700">{t('gate.body')}</p>

      <ul className="mt-6 w-full space-y-2 text-start">
        <li className="flex items-start gap-3 rounded-xl bg-white/70 p-3 text-sm text-ink-700 ring-1 ring-ink-900/5">
          <MicIcon size={18} className="mt-0.5 shrink-0 text-emerald-700" />
          {t('gate.micPoint')}
        </li>
        <li className="flex items-start gap-3 rounded-xl bg-white/70 p-3 text-sm text-ink-700 ring-1 ring-ink-900/5">
          <LockIcon size={18} className="mt-0.5 shrink-0 text-emerald-700" />
          {t('gate.privacyPoint')}
        </li>
      </ul>

      {error && (
        <InlineNotice tone="warn" className="mt-5 text-start">
          {error}
        </InlineNotice>
      )}

      <Button size="xl" className="mt-8 w-full" loading={connecting} onClick={() => onStart('audio')} leading={<MicIcon size={20} />}>
        {t('gate.start')}
      </Button>
      <Button
        variant="ghost"
        className="mt-2 w-full"
        disabled={connecting}
        onClick={() => onStart('text')}
        leading={<KeyboardIcon size={18} />}
      >
        {t('gate.startText')}
      </Button>
      <p className="mt-5 text-xs text-ink-500">{t('gate.footnote')}</p>
      <span className="sr-only">{mode}</span>
    </div>
  );
}
