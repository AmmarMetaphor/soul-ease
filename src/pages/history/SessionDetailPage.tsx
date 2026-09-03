import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Field';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useData } from '@/data/DataContext';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n';
import { formatDateTime, formatDuration } from '@/lib/dates';
import { getExercise } from '@/toolkit/exercises';
import { safeTag } from './SessionHistoryPage';

export function SessionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { repo } = useData();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const data = useAsync(
    async () => {
      const [session, summary, turns] = await Promise.all([repo.getSession(id), repo.getSummary(id), repo.listTurns(id)]);
      return { session, summary, turns };
    },
    [repo, id],
  );

  async function saveTitle() {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await repo.renameSession(id, title.trim() || null);
      data.setData((prev) => (prev ? { ...prev, session: updated } : prev));
      setRenaming(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setActionError(null);
    try {
      await repo.deleteSession(id);
      navigate(ROUTES.sessions, { replace: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('errors.generic'));
      setBusy(false);
    }
  }

  if (data.loading) return <PageLoader />;
  if (data.error) return <ErrorState message={data.error} onRetry={() => void data.reload()} />;
  if (!data.data?.session) return <EmptyState title={t('errors.notFound')} action={<LinkButton to={ROUTES.sessions}>{t('common.back')}</LinkButton>} />;

  const { session, summary, turns } = data.data;
  const exercise = summary?.recommendedExerciseSlug ? getExercise(summary.recommendedExerciseSlug) : undefined;

  return (
    <div className="mx-auto max-w-2xl animate-fade-up">
      <Link to={ROUTES.sessions} className="text-sm font-semibold text-emerald-700">
        ← {t('history.title')}
      </Link>

      <header className="mt-4">
        {renaming ? (
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void saveTitle();
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('history.renamePlaceholder')} maxLength={120} wrapperClassName="flex-1" autoFocus />
            <div className="flex gap-2">
              <Button type="submit" loading={busy}>
                {t('common.save')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRenaming(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-3xl font-medium text-ink-900">{session.title ?? t('history.untitled')}</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTitle(session.title ?? '');
                setRenaming(true);
              }}
            >
              {t('history.rename')}
            </Button>
          </div>
        )}
        <p className="mt-1 text-sm text-ink-500">
          {formatDateTime(session.startedAt, locale)} · {formatDuration(session.durationSeconds)}
        </p>
        {session.topicTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {session.topicTags.map((tag) => (
              <Badge key={tag} tone={tag === 'safety' ? 'dusk' : 'sage'}>
                {safeTag(tag, t)}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {actionError && <ErrorState message={actionError} className="mt-4" />}

      {summary ? (
        <div className="mt-8 space-y-4">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-emerald-800">{t('summary.talkedAbout')}</h2>
            <p dir="auto" className="mt-2 leading-relaxed">
              {summary.whatWeTalkedAbout}
            </p>
          </section>
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-emerald-800">{t('summary.mostImportant')}</h2>
            <p dir="auto" className="mt-2 leading-relaxed">
              {summary.mostImportant}
            </p>
          </section>
          {summary.agreedActions.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-emerald-800">{t('history.agreedActions')}</h2>
              <ul className="mt-2 list-disc space-y-1 ps-5">
                {summary.agreedActions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          )}
          {exercise && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-emerald-800">{t('summary.exercise')}</h2>
              <p className="mt-2">
                <Link to={ROUTES.toolkit} className="font-semibold text-emerald-700 underline underline-offset-4">
                  {exercise.title}
                </Link>
              </p>
            </section>
          )}
        </div>
      ) : (
        <p className="mt-8 rounded-2xl bg-ink-900/[0.04] p-4 text-sm text-ink-700">{t('summary.noSummary')}</p>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">{t('history.transcript')}</h2>
          {turns.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowTranscript((v) => !v)}>
              {showTranscript ? t('session.hideTranscript') : t('history.showTranscript')}
            </Button>
          )}
        </div>
        {turns.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">{t('history.noTranscript')}</p>
        ) : showTranscript ? (
          <ol className="mt-3 space-y-2">
            {turns.map((turn) => (
              <li key={turn.id} dir="auto" className={turn.role === 'noor' ? 'text-ink-700' : 'text-ink-900'}>
                <span className="me-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  {turn.role === 'noor' ? t('session.noor') : t('session.you')}
                </span>
                {turn.content}
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <div className="mt-10 flex justify-end">
        <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
          {t('common.delete')}
        </Button>
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('common.delete')}
        description={t('history.deleteConfirm')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void remove()} loading={busy}>
              {t('common.delete')}
            </Button>
          </>
        }
      />
    </div>
  );
}
