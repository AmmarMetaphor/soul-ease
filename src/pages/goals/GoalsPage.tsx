import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { CheckIcon, GoalIcon, PlusIcon, TrashIcon } from '@/components/ui/Icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useData } from '@/data/DataContext';
import type { Goal, GoalStatus } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';

export function GoalsPage() {
  const { t, locale } = useI18n();
  const { repo } = useData();
  const goals = useAsync(() => repo.listGoals(), [repo]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const goal = await repo.createGoal({ title: title.trim(), description: description.trim() || null, targetDate: targetDate || null });
      goals.setData((prev) => [goal, ...(prev ?? [])]);
      setTitle('');
      setDescription('');
      setTargetDate('');
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(goal: Goal, status: GoalStatus) {
    setError(null);
    try {
      const updated = await repo.updateGoalStatus(goal.id, status);
      goals.setData((prev) => (prev ?? []).map((g) => (g.id === goal.id ? updated : g)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveFailed'));
    }
  }

  async function remove(goal: Goal) {
    if (!window.confirm(t('goals.deleteConfirm'))) return;
    try {
      await repo.deleteGoal(goal.id);
      goals.setData((prev) => (prev ?? []).filter((g) => g.id !== goal.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    }
  }

  const active = goals.data?.filter((g) => g.status === 'active') ?? [];
  const completed = goals.data?.filter((g) => g.status === 'completed') ?? [];
  const letGo = goals.data?.filter((g) => g.status === 'let_go') ?? [];

  return (
    <div>
      <PageHeader
        title={t('goals.title')}
        subtitle={t('goals.subtitle')}
        action={
          <Button onClick={() => setAdding(true)} leading={<PlusIcon size={18} />}>
            {t('goals.newGoal')}
          </Button>
        }
      />

      {adding && (
        <form onSubmit={create} className="card-solid mb-8 space-y-4 p-5 sm:p-6 animate-fade-up">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('goals.titlePlaceholder')} maxLength={200} autoFocus required />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('goals.descriptionPlaceholder')} rows={2} className="min-h-[4rem]" />
          <Input type="date" label={t('goals.targetDate')} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} wrapperClassName="max-w-xs" />
          <p className="text-xs text-ink-500">{t('goals.examples')}</p>
          <div className="flex gap-2">
            <Button type="submit" loading={busy} disabled={!title.trim()}>
              {t('common.save')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      )}

      {error && <ErrorState message={error} className="mb-6" />}
      {goals.loading && <PageLoader />}
      {goals.error && <ErrorState message={goals.error} onRetry={() => void goals.reload()} />}

      {goals.data && goals.data.length === 0 && !adding && (
        <EmptyState icon={<GoalIcon size={22} />} title={t('goals.empty')} body={t('goals.examples')} action={<Button onClick={() => setAdding(true)}>{t('goals.newGoal')}</Button>} className="card" />
      )}

      {active.length > 0 && (
        <GoalGroup title={t('goals.active')}>
          {active.map((g) => (
            <GoalRow key={g.id} goal={g} locale={locale}>
              <Button size="sm" variant="soft" leading={<CheckIcon size={16} />} onClick={() => void setStatus(g, 'completed')}>
                {t('goals.markDone')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void setStatus(g, 'let_go')}>
                {t('goals.markLetGo')}
              </Button>
              <button type="button" aria-label={t('common.delete')} onClick={() => void remove(g)} className="rounded-full p-2 text-ink-300 hover:bg-ink-900/5 hover:text-danger-600">
                <TrashIcon size={16} />
              </button>
            </GoalRow>
          ))}
        </GoalGroup>
      )}
      {completed.length > 0 && (
        <GoalGroup title={t('goals.completed')}>
          {completed.map((g) => (
            <GoalRow key={g.id} goal={g} locale={locale} muted>
              <Badge tone="sage">{t('goals.completed')}</Badge>
              <Button size="sm" variant="ghost" onClick={() => void setStatus(g, 'active')}>
                {t('goals.reactivate')}
              </Button>
            </GoalRow>
          ))}
        </GoalGroup>
      )}
      {letGo.length > 0 && (
        <GoalGroup title={t('goals.letGo')}>
          {letGo.map((g) => (
            <GoalRow key={g.id} goal={g} locale={locale} muted>
              <Button size="sm" variant="ghost" onClick={() => void setStatus(g, 'active')}>
                {t('goals.reactivate')}
              </Button>
              <button type="button" aria-label={t('common.delete')} onClick={() => void remove(g)} className="rounded-full p-2 text-ink-300 hover:bg-ink-900/5 hover:text-danger-600">
                <TrashIcon size={16} />
              </button>
            </GoalRow>
          ))}
        </GoalGroup>
      )}
    </div>
  );
}

function GoalGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function GoalRow({ goal, locale, muted, children }: { goal: Goal; locale: 'en' | 'ur'; muted?: boolean; children: React.ReactNode }) {
  return (
    <li className={cn('card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between', muted && 'opacity-75')}>
      <div className="min-w-0">
        <p dir="auto" className={cn('font-medium text-ink-900', muted && 'line-through decoration-ink-300')}>
          {goal.title}
        </p>
        {goal.description && (
          <p dir="auto" className="mt-0.5 text-sm text-ink-500">
            {goal.description}
          </p>
        )}
        {goal.targetDate && <p className="mt-1 text-xs text-ink-500">{formatDate(goal.targetDate, locale)}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </li>
  );
}
