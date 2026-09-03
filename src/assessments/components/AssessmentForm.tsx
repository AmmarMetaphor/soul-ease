import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/States';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { resolveInstrumentContent } from '../instruments';
import type { AssessmentLocale, InstrumentId } from '../types';

interface AssessmentFormProps {
  instrument: InstrumentId;
  locale: AssessmentLocale;
  onComplete: (responses: number[]) => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

/**
 * One item at a time, four large answer buttons, auto-advance. Calmer on a
 * phone than a wall of radio rows, and easy to review with Back.
 */
export function AssessmentForm({ instrument, locale, onComplete, onCancel, cancelLabel }: AssessmentFormProps) {
  const t = useT();
  const { content, fellBackToEnglish } = resolveInstrumentContent(instrument, locale);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Array<number | null>>(() => content.items.map(() => null));

  const total = content.items.length;
  const isLast = index === total - 1;

  function choose(value: number) {
    const next = [...responses];
    next[index] = value;
    setResponses(next);
    if (isLast) {
      if (next.every((v) => v !== null)) onComplete(next as number[]);
    } else {
      window.setTimeout(() => setIndex((i) => Math.min(total - 1, i + 1)), 140);
    }
  }

  const answered = responses.filter((r) => r !== null).length;

  return (
    <div className="animate-fade-up" lang={content.locale}>
      <div className="flex items-center justify-between text-sm text-ink-500">
        <span className="font-medium text-ink-700">{content.title}</span>
        <span>{t('assessment.progress', { done: index + 1, total })}</span>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-ink-900/5" aria-hidden="true">
        <div
          className="h-full rounded-full bg-emerald-700 transition-[width] duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {fellBackToEnglish && (
        <InlineNotice tone="warn" className="mt-4">
          {t('assessment.urduUnavailable')}
        </InlineNotice>
      )}

      <p className="mt-6 text-sm text-ink-500">{content.stem}</p>
      <h2 className="mt-2 text-2xl font-medium leading-snug text-ink-900" key={index}>
        {content.items[index]}
      </h2>

      <div role="radiogroup" aria-label={content.items[index]} className="mt-6 grid gap-2.5">
        {content.responseOptions.map((label, value) => {
          const selected = responses[index] === value;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(value)}
              className={cn(
                'flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-start text-base font-medium ring-1 transition-all hover:bg-ivory-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
                selected ? 'ring-2 ring-emerald-700 shadow-soft' : 'ring-ink-900/10',
              )}
            >
              <span>{label}</span>
              <span className="text-sm text-ink-300">{value}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
            {t('common.back')}
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              {cancelLabel ?? t('common.cancel')}
            </Button>
          )}
        </div>
        {isLast && answered === total && (
          <Button onClick={() => onComplete(responses as number[])}>{t('assessment.finish')}</Button>
        )}
      </div>

      <p className="mt-8 text-xs text-ink-300">
        {t('assessment.sourceLabel')}: {content.source.attribution}
      </p>
    </div>
  );
}
