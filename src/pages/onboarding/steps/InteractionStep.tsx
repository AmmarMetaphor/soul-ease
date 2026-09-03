import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { KeyboardIcon, WaveIcon } from '@/components/ui/Icons';
import type { InteractionMode } from '@/data/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

interface InteractionStepProps {
  initial: InteractionMode;
  busy: boolean;
  onBack: () => void;
  onContinue: (mode: InteractionMode) => void;
}

export function InteractionModeCards({ value, onChange }: { value: InteractionMode; onChange: (m: InteractionMode) => void }) {
  const t = useT();
  const options: Array<{ mode: InteractionMode; title: string; body: string; icon: typeof WaveIcon; badge?: string }> = [
    { mode: 'audio', title: t('onboarding.audioTitle'), body: t('onboarding.audioBody'), icon: WaveIcon, badge: t('onboarding.audioBadge') },
    { mode: 'text', title: t('onboarding.textTitle'), body: t('onboarding.textBody'), icon: KeyboardIcon },
  ];
  return (
    <div role="radiogroup" className="grid gap-4 sm:grid-cols-2">
      {options.map((opt) => {
        const selected = value === opt.mode;
        return (
          <button
            key={opt.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.mode)}
            className={cn(
              'relative flex flex-col items-start rounded-3xl p-6 text-start ring-1 transition-all hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
              opt.mode === 'audio' ? 'bg-emerald-800 text-ivory-50 grain overflow-hidden' : 'bg-white text-ink-900',
              selected ? 'ring-2 ring-emerald-700 shadow-lift' : 'ring-ink-900/5 shadow-soft',
            )}
          >
            <span className="relative z-10 flex w-full items-start justify-between">
              <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', opt.mode === 'audio' ? 'bg-white/15' : 'bg-sage-100 text-emerald-700')}>
                <opt.icon size={24} />
              </span>
              {opt.badge && <Badge tone="sage">{opt.badge}</Badge>}
            </span>
            <span className="relative z-10 mt-6 block text-xl font-semibold">{opt.title}</span>
            <span className={cn('relative z-10 mt-2 block text-sm leading-relaxed', opt.mode === 'audio' ? 'text-ivory-50/80' : 'text-ink-500')}>
              {opt.body}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function InteractionStep({ initial, busy, onBack, onContinue }: InteractionStepProps) {
  const t = useT();
  const [mode, setMode] = useState<InteractionMode>(initial);
  return (
    <div className="mx-auto max-w-2xl py-8 animate-fade-up">
      <h1 className="text-3xl font-medium text-ink-900">{t('onboarding.interactionTitle')}</h1>
      <p className="mt-3 text-ink-700">{t('onboarding.interactionBody')}</p>
      <div className="mt-8">
        <InteractionModeCards value={mode} onChange={setMode} />
      </div>
      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          {t('common.back')}
        </Button>
        <Button size="lg" loading={busy} onClick={() => onContinue(mode)}>
          {t('common.continue')}
        </Button>
      </div>
    </div>
  );
}
