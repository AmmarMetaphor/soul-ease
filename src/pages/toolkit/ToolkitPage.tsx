import { useState } from 'react';
import { concernLabelKey } from '@/components/ConcernCards';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CheckIcon, HeartIcon } from '@/components/ui/Icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState, ErrorState, InlineNotice } from '@/components/ui/States';
import { useData } from '@/data/DataContext';
import { useAsync } from '@/hooks/useAsync';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { EXERCISES, type Exercise } from '@/toolkit/exercises';

export function ToolkitPage() {
  const t = useT();
  const { repo } = useData();
  const saved = useAsync(() => repo.listSavedTools(), [repo]);
  const [filter, setFilter] = useState<'all' | 'saved'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedSlugs = new Set(saved.data?.map((s) => s.toolSlug) ?? []);
  const visible = filter === 'saved' ? EXERCISES.filter((e) => savedSlugs.has(e.slug)) : EXERCISES;

  async function toggleSave(exercise: Exercise) {
    setError(null);
    try {
      if (savedSlugs.has(exercise.slug)) {
        await repo.unsaveTool(exercise.slug);
        saved.setData((prev) => (prev ?? []).filter((s) => s.toolSlug !== exercise.slug));
      } else {
        const created = await repo.saveTool(exercise.slug);
        saved.setData((prev) => [...(prev ?? []), created]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveFailed'));
    }
  }

  return (
    <div>
      <PageHeader
        title={t('toolkit.title')}
        subtitle={t('toolkit.subtitle')}
        action={
          <div role="radiogroup" className="inline-flex rounded-full bg-ink-900/5 p-0.5 text-sm">
            {(['all', 'saved'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f)}
                className={cn('rounded-full px-4 py-1.5 font-medium transition-colors', filter === f ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-500')}
              >
                {f === 'all' ? t('toolkit.all') : t('toolkit.savedOnly')}
              </button>
            ))}
          </div>
        }
      />
      <InlineNotice tone="sage" className="mb-6">
        {t('toolkit.disclaimer')}
      </InlineNotice>
      {error && <ErrorState message={error} className="mb-6" />}
      {saved.loading && <PageLoader />}
      {saved.error && <ErrorState message={saved.error} onRetry={() => void saved.reload()} />}

      {visible.length === 0 && <EmptyState title={t('toolkit.empty')} className="card" />}

      <ul className="grid gap-4 md:grid-cols-2">
        {visible.map((exercise) => {
          const isOpen = open === exercise.slug;
          const isSaved = savedSlugs.has(exercise.slug);
          return (
            <li key={exercise.slug} className="card flex flex-col p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{t('toolkit.minutes', { n: exercise.durationMinutes })}</p>
                  <h2 className="mt-1 text-xl font-semibold text-ink-900">{exercise.title}</h2>
                  <p className="text-sm text-ink-500">{exercise.subtitle}</p>
                </div>
                <button
                  type="button"
                  aria-pressed={isSaved}
                  aria-label={isSaved ? t('toolkit.unsaveTool') : t('toolkit.saveTool')}
                  onClick={() => void toggleSave(exercise)}
                  className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 transition-colors', isSaved ? 'bg-emerald-700 text-ivory-50 ring-emerald-700' : 'bg-white text-ink-500 ring-ink-900/10 hover:text-emerald-700')}
                >
                  {isSaved ? <CheckIcon size={18} /> : <HeartIcon size={18} />}
                </button>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-700">{exercise.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {exercise.helpfulFor.map((c) => (
                  <Badge key={c} tone="neutral">
                    {t(concernLabelKey(c))}
                  </Badge>
                ))}
              </div>
              {isOpen && (
                <div className="mt-5 animate-fade-up">
                  <h3 className="text-sm font-semibold text-ink-900">{t('toolkit.steps')}</h3>
                  <ol className="mt-2 space-y-2">
                    {exercise.steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-700">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-100 text-xs font-semibold text-emerald-800">{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-4 text-xs text-ink-500">
                    <span className="font-semibold">{t('toolkit.basis')}:</span> {exercise.basis}
                  </p>
                </div>
              )}
              <div className="mt-5">
                <Button variant={isOpen ? 'ghost' : 'soft'} size="sm" onClick={() => setOpen(isOpen ? null : exercise.slug)}>
                  {isOpen ? t('common.close') : t('toolkit.steps')}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
