import { useState } from 'react';
import { MoodGlyph, MoodPicker } from '@/components/MoodPicker';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea } from '@/components/ui/Field';
import { JournalIcon, PlusIcon } from '@/components/ui/Icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useData } from '@/data/DataContext';
import type { JournalEntry } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n';
import { formatDateTime } from '@/lib/dates';

type Draft = { id: string | null; title: string; body: string; mood: number | null; sessionId: string | null };

const EMPTY_DRAFT: Draft = { id: null, title: '', body: '', mood: null, sessionId: null };

export function JournalPage() {
  const { t, locale } = useI18n();
  const { repo } = useData();
  const entries = useAsync(() => repo.listJournalEntries(), [repo]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<JournalEntry | null>(null);

  function openNew() {
    setDraft({ ...EMPTY_DRAFT });
    setError(null);
  }
  function openEdit(entry: JournalEntry) {
    setDraft({ id: entry.id, title: entry.title ?? '', body: entry.body, mood: entry.mood, sessionId: entry.sessionId });
    setError(null);
  }

  async function save() {
    if (!draft || !draft.body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const input = { title: draft.title.trim() || null, body: draft.body.trim(), mood: draft.mood, sessionId: draft.sessionId };
      const saved = draft.id ? await repo.updateJournalEntry(draft.id, input) : await repo.createJournalEntry(input);
      entries.setData((prev) => {
        const rest = (prev ?? []).filter((e) => e.id !== saved.id);
        return [saved, ...rest];
      });
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await repo.deleteJournalEntry(deleting.id);
      entries.setData((prev) => (prev ?? []).filter((e) => e.id !== deleting.id));
      setDeleting(null);
      if (draft?.id === deleting.id) setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('journal.title')}
        subtitle={t('journal.subtitle')}
        action={
          <Button onClick={openNew} leading={<PlusIcon size={18} />}>
            {t('journal.newEntry')}
          </Button>
        }
      />

      {draft && (
        <section className="card-solid mb-8 p-5 sm:p-7 animate-fade-up" aria-label={t('journal.newEntry')}>
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={t('journal.titlePlaceholder')} maxLength={200} className="border-0 bg-transparent px-0 text-xl font-medium shadow-none focus:ring-0" />
          <Textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder={t('journal.bodyPlaceholder')}
            rows={10}
            dir="auto"
            className="mt-2 min-h-[14rem] border-0 bg-ivory-50 text-[16px] leading-[1.8] focus:ring-0"
            autoFocus
          />
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-ink-700">{t('journal.moodLabel')}</p>
            <MoodPicker value={draft.mood} onChange={(m) => setDraft({ ...draft, mood: m })} compact allowClear />
          </div>
          {draft.sessionId && <p className="mt-3 text-xs text-ink-500">{t('journal.linkedSession')}</p>}
          {error && <ErrorState message={error} className="mt-4" />}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button onClick={() => void save()} loading={busy} disabled={!draft.body.trim()}>
                {t('common.save')}
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                {t('common.cancel')}
              </Button>
            </div>
            {draft.id && (
              <Button variant="danger" size="sm" onClick={() => setDeleting(entries.data?.find((e) => e.id === draft.id) ?? null)}>
                {t('common.delete')}
              </Button>
            )}
          </div>
        </section>
      )}

      {entries.loading && <PageLoader />}
      {entries.error && <ErrorState message={entries.error} onRetry={() => void entries.reload()} />}
      {entries.data && entries.data.length === 0 && !draft && (
        <EmptyState icon={<JournalIcon size={22} />} title={t('journal.empty')} action={<Button onClick={openNew}>{t('journal.newEntry')}</Button>} className="card" />
      )}
      {entries.data && entries.data.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {entries.data.map((entry) => (
            <li key={entry.id}>
              <button type="button" onClick={() => openEdit(entry)} className="card block h-full w-full p-5 text-start transition-all hover:-translate-y-0.5 hover:shadow-lift motion-reduce:hover:translate-y-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-ink-900">{entry.title ?? formatDateTime(entry.createdAt, locale)}</p>
                  {entry.mood && <MoodGlyph mood={entry.mood} className="h-5 w-5 shrink-0 text-emerald-700" />}
                </div>
                <p dir="auto" className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-ink-700">
                  {entry.body}
                </p>
                <p className="mt-3 text-xs text-ink-500">
                  {t('journal.lastEdited')} {formatDateTime(entry.updatedAt, locale)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('common.delete')}
        description={t('journal.deleteConfirm')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
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
