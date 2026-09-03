import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { NoorOrb } from '@/components/brand/NoorOrb';
import { Button, LinkButton } from '@/components/ui/Button';
import { CloseIcon } from '@/components/ui/Icons';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState, ErrorState, InlineNotice } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useData } from '@/data/DataContext';
import type { ConcernId } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n';
import { formatDuration } from '@/lib/dates';
import { generateMemoryCandidates, type MemoryCandidate } from '@/memory/candidates';
import { canPersistLongTermMemory } from '@/memory/permissions';
import { getExercise } from '@/toolkit/exercises';

export function SessionSummaryPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { repo, consent, profile } = useData();
  const memoryAllowed = canPersistLongTermMemory(consent);

  const data = useAsync(
    async () => {
      const [session, summary, turns] = await Promise.all([repo.getSession(id), repo.getSummary(id), repo.listTurns(id)]);
      return { session, summary, turns };
    },
    [repo, id],
  );

  const [candidates, setCandidates] = useState<MemoryCandidate[] | null>(null);
  const [memorySaved, setMemorySaved] = useState(false);
  const [saving, setSaving] = useState<null | 'summary' | 'journal' | 'memory'>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    if (!data.data || candidates !== null) return;
    const { session, summary, turns } = data.data;
    if (!session) return;
    const topic = (session.topicTags.find((tag) => tag !== 'safety') as ConcernId | undefined) ?? null;
    setCandidates(
      generateMemoryCandidates({
        sessionId: session.id,
        topic,
        agreedActions: summary?.agreedActions ?? [],
        userTurns: turns.filter((tr) => tr.role === 'user').map((tr) => tr.content),
        recommendedExerciseSlug: summary?.recommendedExerciseSlug ?? null,
      }),
    );
  }, [data.data, candidates]);

  const exercise = useMemo(
    () => (data.data?.summary?.recommendedExerciseSlug ? getExercise(data.data.summary.recommendedExerciseSlug) : undefined),
    [data.data?.summary?.recommendedExerciseSlug],
  );

  async function saveMemories() {
    if (!candidates || !memoryAllowed) return;
    setSaving('memory');
    setSaveError(null);
    try {
      await repo.addMemories(candidates.map(({ category, content, sourceSessionId }) => ({ category, content, sourceSessionId })));
      setMemorySaved(true);
      setSavedNote(t('summary.saved'));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setSaving(null);
    }
  }

  async function addToJournal() {
    const summary = data.data?.summary;
    if (!summary) return;
    setSaving('journal');
    setSaveError(null);
    try {
      const body = [
        `${t('summary.talkedAbout')}: ${summary.whatWeTalkedAbout}`,
        `${t('summary.mostImportant')}: ${summary.mostImportant}`,
        summary.agreedActions.length ? `${t('summary.actions')}: ${summary.agreedActions.join('; ')}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
      await repo.createJournalEntry({ title: t('summary.title'), body, sessionId: id });
      if (memoryAllowed && candidates && candidates.length > 0 && !memorySaved) await saveMemories();
      navigate(ROUTES.journal);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setSaving(null);
    }
  }

  async function saveSummary() {
    // Summary itself is persisted on session end (when consent allows).
    // "Save" here confirms the proposed memories.
    if (memoryAllowed && candidates && candidates.length > 0 && !memorySaved) {
      await saveMemories();
    } else {
      setSavedNote(t('summary.saved'));
    }
  }

  if (data.loading) return <PageLoader />;
  if (data.error) return <ErrorState message={data.error} onRetry={() => void data.reload()} />;
  if (!data.data?.session) return <EmptyState title={t('errors.notFound')} action={<LinkButton to={ROUTES.dashboard}>{t('summary.returnHome')}</LinkButton>} />;

  const { session, summary } = data.data;

  return (
    <div className="mx-auto max-w-2xl animate-fade-up">
      <div className="flex flex-col items-center text-center">
        <NoorOrb state="ended" size="sm" />
        <p className="eyebrow mt-6">{t('summary.title')}</p>
        <h1 className="mt-2 text-3xl font-medium text-ink-900">{session.title ?? t('summary.title')}</h1>
        <p className="mt-2 max-w-md text-sm text-ink-500">{t('summary.subtitle')}</p>
        <p className="mt-3 text-xs text-ink-300">
          {t('summary.durationLabel')}: {formatDuration(session.durationSeconds)}
        </p>
      </div>

      {!summary ? (
        <InlineNotice tone="neutral" className="mt-8">
          {t('summary.savedNoStorage')}
        </InlineNotice>
      ) : (
        <div className="mt-8 space-y-4">
          <Section title={t('summary.talkedAbout')}>{summary.whatWeTalkedAbout}</Section>
          <Section title={t('summary.mostImportant')}>{summary.mostImportant}</Section>
          {summary.agreedActions.length > 0 && (
            <Section title={t('summary.actions')}>
              <ul className="list-disc space-y-1 ps-5">
                {summary.agreedActions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Section>
          )}
          {exercise && (
            <Section title={t('summary.exercise')}>
              <Link to={ROUTES.toolkit} className="font-semibold text-emerald-700 underline decoration-emerald-700/30 underline-offset-4">
                {exercise.title}
              </Link>
              <span className="text-ink-500"> · {exercise.subtitle} · {t('toolkit.minutes', { n: exercise.durationMinutes })}</span>
              <p className="mt-1 text-sm text-ink-500">{exercise.summary}</p>
            </Section>
          )}
          {summary.goalBeforeNext && <Section title={t('summary.goal')}>{summary.goalBeforeNext}</Section>}
        </div>
      )}

      {/* Memory proposals */}
      <section className="card-solid mt-6 p-5 sm:p-6">
        <h2 className="font-semibold text-ink-900">{t('summary.memory')}</h2>
        {!memoryAllowed ? (
          <p className="mt-2 text-sm text-ink-500">{t('summary.memoryDisabled')}</p>
        ) : !candidates || candidates.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">{t('summary.memoryNone')}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-500">{t('summary.memoryHint')}</p>
            <ul className="mt-3 space-y-2">
              {candidates.map((c) => (
                <li key={c.candidateId} className="flex items-start justify-between gap-3 rounded-xl bg-ivory-100 px-3 py-2.5 text-sm">
                  <span>
                    <span className="me-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                      {t(`settings.category_${c.category}`)}
                    </span>
                    {c.content}
                  </span>
                  {!memorySaved && (
                    <button
                      type="button"
                      aria-label={t('common.remove')}
                      onClick={() => setCandidates((prev) => prev?.filter((p) => p.candidateId !== c.candidateId) ?? null)}
                      className="shrink-0 rounded-full p-1 text-ink-300 hover:bg-white hover:text-ink-900"
                    >
                      <CloseIcon size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="mt-4 text-xs text-ink-300">{t('summary.disclaimer')}</p>

      {saveError && <ErrorState message={saveError} className="mt-4" />}
      {savedNote && (
        <InlineNotice tone="sage" className="mt-4">
          {savedNote}
        </InlineNotice>
      )}

      <div className="mt-8 grid gap-2 sm:grid-cols-2">
        <Button onClick={() => void saveSummary()} loading={saving === 'memory'} disabled={memorySaved && !!savedNote}>
          {t('summary.saveSummary')}
        </Button>
        <Button variant="secondary" onClick={() => void addToJournal()} loading={saving === 'journal'} disabled={!summary}>
          {t('summary.addToJournal')}
        </Button>
        <LinkButton to={ROUTES.dashboard} variant="ghost">
          {t('summary.returnHome')}
        </LinkButton>
        <LinkButton to={ROUTES.session} variant="soft">
          {t('summary.continueTalking')}
        </LinkButton>
      </div>
      <p className="mt-6 text-center text-xs text-ink-300">{profile?.displayName ? `— ${profile.displayName}` : ''}</p>
      <span className="sr-only">{locale}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-emerald-800">{title}</h2>
      <div dir="auto" className="mt-2 leading-relaxed text-ink-900">
        {children}
      </div>
    </section>
  );
}
