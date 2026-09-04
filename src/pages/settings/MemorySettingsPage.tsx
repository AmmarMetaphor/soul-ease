import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { CloseIcon } from '@/components/ui/Icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState, ErrorState, InlineNotice } from '@/components/ui/States';
import { Toggle } from '@/components/ui/Toggle';
import { ROUTES } from '@/config/app';
import { useData } from '@/data/DataContext';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/dates';
import type { ConsentType } from '@/memory/permissions';
import { readableTool } from '@/session/memoryContext';

/**
 * "What Soul Ease Remembers" — everything Noor may carry between sessions, in
 * one place the member controls.
 *
 * Four kinds of durable state, listed separately because they behave
 * differently and a member deserves to see which is which:
 *   - memory items      — facts they approved
 *   - follow-ups        — things they asked to be asked about
 *   - coping preferences— what has and has not helped
 *   - consent toggles   — including journal access, which is off by default
 *
 * Deleting anything here removes the row the session context package is built
 * from, so it stops reaching Noor on the very next session. There is no second
 * cache to go stale.
 */
export function MemorySettingsPage() {
  const { t, locale } = useI18n();
  const { repo, consent, setConsent } = useData();
  const memories = useAsync(() => repo.listMemories(), [repo]);
  const followUps = useAsync(() => repo.listFollowUps(), [repo]);
  const copingPreferences = useAsync(() => repo.listCopingPreferences(), [repo]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'memories' | 'journal' | 'sessions'>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function toggle(type: ConsentType, value: boolean) {
    setBusy(type);
    setError(null);
    try {
      await setConsent(type, value);
      setNotice(t('settings.consentUpdated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function deleteMemory(id: string) {
    setError(null);
    try {
      await repo.deleteMemory(id);
      memories.setData((prev) => (prev ?? []).filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    }
  }

  async function removeFollowUp(id: string) {
    setError(null);
    try {
      await repo.deleteFollowUp(id);
      followUps.setData((prev) => (prev ?? []).filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    }
  }

  async function removeCopingPreference(id: string) {
    setError(null);
    try {
      await repo.deleteCopingPreference(id);
      copingPreferences.setData((prev) => (prev ?? []).filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    }
  }

  async function runBulk() {
    if (!confirm) return;
    setBusy(confirm);
    setError(null);
    try {
      if (confirm === 'memories') {
        await repo.deleteAllMemories();
        memories.setData([]);
      } else if (confirm === 'journal') {
        const entries = await repo.listJournalEntries();
        for (const e of entries) await repo.deleteJournalEntry(e.id);
      } else {
        const sessions = await repo.listSessions();
        for (const s of sessions) await repo.deleteSession(s.id);
      }
      setNotice(t('common.done'));
      setConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to={ROUTES.settings} className="text-sm font-semibold text-emerald-700">
        ← {t('settings.title')}
      </Link>
      <PageHeader title={t('settings.memoryTitle')} subtitle={t('settings.memoryBody')} />

      {error && <ErrorState message={error} />}
      {notice && <InlineNotice tone="sage">{notice}</InlineNotice>}

      <Card>
        <CardHeader title={t('settings.privacyTitle')} />
        <div className="divide-y divide-ink-900/5">
          <Toggle label={t('settings.consentTranscript')} description={t('onboarding.consentTranscript')} checked={consent.transcriptStorage} onChange={(v) => void toggle('transcript_storage', v)} busy={busy === 'transcript_storage'} />
          <Toggle label={t('settings.consentMemory')} description={t('onboarding.consentMemory')} checked={consent.longTermMemory} onChange={(v) => void toggle('long_term_memory', v)} busy={busy === 'long_term_memory'} />
          <Toggle label={t('settings.consentAssessment')} description={t('onboarding.consentAssessment')} checked={consent.assessmentStorage} onChange={(v) => void toggle('assessment_storage', v)} busy={busy === 'assessment_storage'} />
          {/*
            Off by default, and separate from every other consent. A journal is
            where people write what they are not ready to say out loud; writing
            it down is not the same as telling Noor.
          */}
          <Toggle
            label={t('settings.consentJournalAccess')}
            description={t('settings.consentJournalAccessBody')}
            checked={consent.journalAiAccess}
            onChange={(v) => void toggle('journal_ai_access', v)}
            busy={busy === 'journal_ai_access'}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t('settings.memoryTitle')}
          action={
            memories.data && memories.data.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirm('memories')}>
                {t('settings.memoryDeleteAll')}
              </Button>
            ) : null
          }
        />
        {memories.loading && <PageLoader />}
        {memories.error && <ErrorState message={memories.error} onRetry={() => void memories.reload()} />}
        {memories.data && memories.data.length === 0 && <EmptyState title={t('settings.memoryEmpty')} />}
        {memories.data && memories.data.length > 0 && (
          <ul className="space-y-2">
            {memories.data.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 rounded-xl bg-ivory-100 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="dusk">{t(`settings.category_${m.category}`)}</Badge>
                    <span className="text-xs text-ink-500">{formatDate(m.createdAt, locale)}</span>
                  </div>
                  <p dir="auto" className="mt-1.5 text-sm text-ink-900">
                    {m.content}
                  </p>
                </div>
                <button type="button" aria-label={t('common.remove')} onClick={() => void deleteMemory(m.id)} className="shrink-0 rounded-full p-1.5 text-ink-300 hover:bg-white hover:text-danger-600">
                  <CloseIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title={t('settings.followUpsTitle')} subtitle={t('settings.followUpsBody')} />
        {followUps.loading && <PageLoader />}
        {followUps.error && <ErrorState message={followUps.error} onRetry={() => void followUps.reload()} />}
        {followUps.data && followUps.data.length === 0 && <EmptyState title={t('settings.followUpsEmpty')} />}
        {followUps.data && followUps.data.length > 0 && (
          <ul className="space-y-2">
            {followUps.data.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3 rounded-xl bg-ivory-100 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={f.status === 'open' ? 'sage' : 'dusk'}>{t(`settings.followUp_${f.status}`)}</Badge>
                    <span className="text-xs text-ink-500">{formatDate(f.createdAt, locale)}</span>
                  </div>
                  <p dir="auto" className="mt-1.5 text-sm text-ink-900">
                    {f.prompt}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t('common.remove')}
                  onClick={() => void removeFollowUp(f.id)}
                  className="shrink-0 rounded-full p-1.5 text-ink-300 hover:bg-white hover:text-danger-600"
                >
                  <CloseIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title={t('settings.copingTitle')} subtitle={t('settings.copingBody')} />
        {copingPreferences.loading && <PageLoader />}
        {copingPreferences.error && (
          <ErrorState message={copingPreferences.error} onRetry={() => void copingPreferences.reload()} />
        )}
        {copingPreferences.data && copingPreferences.data.length === 0 && (
          <EmptyState title={t('settings.copingEmpty')} />
        )}
        {copingPreferences.data && copingPreferences.data.length > 0 && (
          <ul className="space-y-2">
            {copingPreferences.data.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 rounded-xl bg-ivory-100 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={p.outcome === 'tried_unhelpful' ? 'warn' : p.outcome === 'tried_helpful' ? 'sage' : 'dusk'}>
                      {t(`settings.coping_${p.outcome}`)}
                    </Badge>
                    <span className="text-xs text-ink-500">{formatDate(p.updatedAt, locale)}</span>
                  </div>
                  <p dir="auto" className="mt-1.5 text-sm capitalize text-ink-900">
                    {readableTool(p.toolSlug)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t('common.remove')}
                  onClick={() => void removeCopingPreference(p.id)}
                  className="shrink-0 rounded-full p-1.5 text-ink-300 hover:bg-white hover:text-danger-600"
                >
                  <CloseIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title={t('settings.dataTitle')} />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => setConfirm('journal')}>
            {t('settings.deleteJournal')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setConfirm('sessions')}>
            {t('settings.deleteSessions')}
          </Button>
          <Link to={ROUTES.deleteAccount} className="inline-flex h-9 items-center rounded-xl px-3.5 text-sm font-semibold text-danger-600 hover:bg-danger-100">
            {t('settings.deleteAccount')}
          </Link>
        </div>
      </Card>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'memories' ? t('settings.memoryDeleteAll') : confirm === 'journal' ? t('settings.deleteJournal') : t('settings.deleteSessions')}
        description={confirm === 'memories' ? t('settings.memoryDeleteAllConfirm') : confirm === 'journal' ? t('journal.deleteConfirm') : t('history.deleteConfirm')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void runBulk()} loading={busy === confirm}>
              {t('common.delete')}
            </Button>
          </>
        }
      />
    </div>
  );
}
