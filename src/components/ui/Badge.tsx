import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'sage' | 'dusk' | 'neutral' | 'warn' | 'danger';

const TONES: Record<Tone, string> = {
  sage: 'bg-sage-100 text-emerald-800',
  dusk: 'bg-dusk-100 text-dusk-500',
  neutral: 'bg-ink-900/5 text-ink-700',
  warn: 'bg-warn-100 text-warn-600',
  danger: 'bg-danger-100 text-danger-600',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
