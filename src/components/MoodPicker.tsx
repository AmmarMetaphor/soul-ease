import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

const MOODS = [1, 2, 3, 4, 5] as const;

const TONES: Record<number, string> = {
  1: 'bg-dusk-200 text-dusk-500',
  2: 'bg-dusk-100 text-dusk-500',
  3: 'bg-ivory-200 text-ink-700',
  4: 'bg-sage-100 text-emerald-800',
  5: 'bg-sage-200 text-emerald-800',
};

type MoodKey = 'dashboard.mood1' | 'dashboard.mood2' | 'dashboard.mood3' | 'dashboard.mood4' | 'dashboard.mood5';

export function moodLabelKey(mood: number): MoodKey {
  const clamped = Math.min(5, Math.max(1, Math.round(mood)));
  return `dashboard.mood${clamped as 1 | 2 | 3 | 4 | 5}`;
}

interface MoodPickerProps {
  value: number | null;
  onChange: (mood: number | null) => void;
  disabled?: boolean;
  compact?: boolean;
  allowClear?: boolean;
}

export function MoodPicker({ value, onChange, disabled, compact, allowClear }: MoodPickerProps) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t('journal.moodLabel')} className={cn('flex flex-wrap gap-2', compact ? 'gap-1.5' : 'gap-2')}>
      {MOODS.map((mood) => {
        const selected = value === mood;
        return (
          <button
            key={mood}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(selected && allowClear ? null : mood)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
              compact ? 'min-w-[3.25rem]' : 'min-w-[4.25rem] py-3',
              TONES[mood],
              selected ? 'ring-2 ring-emerald-700 ring-offset-2 ring-offset-white' : 'opacity-80 hover:opacity-100',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <MoodGlyph mood={mood} />
            <span>{t(moodLabelKey(mood))}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MoodGlyph({ mood, className }: { mood: number; className?: string }) {
  // Abstract "fill level" glyph rather than emoji faces — calmer, and it
  // renders identically on every platform.
  const fill = mood / 5;
  return (
    <svg viewBox="0 0 24 24" className={cn('h-6 w-6', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.18" />
      <clipPath id={`mood-clip-${mood}`}>
        <rect x="3" y={3 + 18 * (1 - fill)} width="18" height={18 * fill} />
      </clipPath>
      <circle cx="12" cy="12" r="9" fill="currentColor" clipPath={`url(#mood-clip-${mood})`} />
    </svg>
  );
}
