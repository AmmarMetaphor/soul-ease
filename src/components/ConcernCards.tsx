import { CONCERN_IDS, type ConcernId } from '@/data/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

const ACCENTS: Record<ConcernId, string> = {
  anxiety: 'from-dusk-100 to-white',
  low_mood: 'from-ivory-200 to-white',
  stress: 'from-sage-100 to-white',
  overthinking: 'from-dusk-100 to-white',
  grief: 'from-ivory-200 to-white',
  relationships: 'from-sage-100 to-white',
  someone_to_talk_to: 'from-sage-100 to-white',
  something_else: 'from-ivory-200 to-white',
};

export function concernLabelKey(id: ConcernId) {
  return `onboarding.concern_${id}` as const;
}

interface ConcernCardsProps {
  value: ConcernId[];
  onChange: (next: ConcernId[]) => void;
}

export function ConcernCards({ value, onChange }: ConcernCardsProps) {
  const t = useT();
  const toggle = (id: ConcernId) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  return (
    <div role="group" aria-label={t('onboarding.concernsTitle')} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {CONCERN_IDS.map((id) => {
        const selected = value.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(id)}
            className={cn(
              'relative flex min-h-[5.5rem] items-end rounded-2xl bg-gradient-to-br p-4 text-start text-sm font-semibold text-ink-900 ring-1 transition-all duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
              ACCENTS[id],
              selected ? 'ring-2 ring-emerald-700 shadow-lift' : 'ring-ink-900/5 shadow-soft',
            )}
          >
            {t(concernLabelKey(id))}
            <span
              className={cn(
                'absolute end-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border transition-colors',
                selected ? 'border-emerald-700 bg-emerald-700 text-ivory-50' : 'border-ink-900/15 bg-white/60',
              )}
              aria-hidden="true"
            >
              {selected && (
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                  <path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
