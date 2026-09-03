import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, InlineNotice } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useData } from '@/data/DataContext';
import type { HumanSupportRequest, HumanSupportRequestType } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/dates';
import { PLACEHOLDER_PRACTITIONERS } from '@/support/practitioners.placeholder';

const REQUEST_TYPES: HumanSupportRequestType[] = ['talk_to_professional', 'referral', 'booking', 'urgent'];

export function HumanSupportPage() {
  const { t, locale } = useI18n();
  const { repo } = useData();
  const requests = useAsync(() => repo.listHumanSupportRequests(), [repo]);
  const [type, setType] = useState<HumanSupportRequestType>('talk_to_professional');
  const [contact, setContact] = useState<HumanSupportRequest['preferredContact']>('in_app');
  const [language, setLanguage] = useState<HumanSupportRequest['preferredLanguage']>(locale === 'ur' ? 'ur' : 'mixed');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await repo.createHumanSupportRequest({ requestType: type, preferredContact: contact, preferredLanguage: language, note: note.trim() || null });
      requests.setData((prev) => [created, ...(prev ?? [])]);
      setSubmitted(true);
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('humanSupport.title')} subtitle={t('humanSupport.intro')} />

      <InlineNotice tone="warn" className="mb-8">
        {t('humanSupport.emergency')}{' '}
        <Link to={ROUTES.safety} className="font-semibold underline">
          {t('nav.safety')}
        </Link>
      </InlineNotice>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-ink-900">{t('humanSupport.directoryTitle')}</h2>
        <p className="mt-1 text-sm text-ink-500">{t('humanSupport.directoryPlaceholder')}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {PLACEHOLDER_PRACTITIONERS.map((p) => (
            <li key={p.id} className="card p-4 opacity-80">
              <div className="flex items-start justify-between gap-2">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sage-200 to-dusk-200" aria-hidden="true" />
                <Badge tone="warn">{t('humanSupport.placeholderBadge')}</Badge>
              </div>
              <p className="mt-3 font-semibold text-ink-900">{p.displayName}</p>
              <p className="text-xs text-ink-500">{p.role}</p>
              <p className="mt-2 text-xs text-ink-500">{p.languages.join(' · ')}</p>
              <p className="text-xs text-ink-500">{p.location}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-solid p-5 sm:p-7">
        <h2 className="text-xl font-semibold text-ink-900">{t('humanSupport.requestTitle')}</h2>
        <p className="mt-1 text-sm text-ink-500">{t('humanSupport.requestBody')}</p>
        {submitted ? (
          <InlineNotice tone="sage" className="mt-6">
            {t('humanSupport.submitted')}
          </InlineNotice>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink-700">{t('humanSupport.requestType')}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {REQUEST_TYPES.map((rt) => (
                  <label key={rt} className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm ring-1 transition-colors ${type === rt ? 'bg-sage-100 ring-emerald-700' : 'bg-white ring-ink-900/10 hover:bg-ivory-50'}`}>
                    <input type="radio" name="requestType" value={rt} checked={type === rt} onChange={() => setType(rt)} className="accent-emerald-700" />
                    {t(`humanSupport.type_${rt}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label={t('humanSupport.contactPreference')} value={contact} onChange={(e) => setContact(e.target.value as HumanSupportRequest['preferredContact'])}>
                <option value="in_app">{t('humanSupport.contact_in_app')}</option>
                <option value="email">{t('humanSupport.contact_email')}</option>
                <option value="phone">{t('humanSupport.contact_phone')}</option>
              </Select>
              <Select label={t('humanSupport.languagePreference')} value={language} onChange={(e) => setLanguage(e.target.value as HumanSupportRequest['preferredLanguage'])}>
                <option value="mixed">{t('humanSupport.lang_mixed')}</option>
                <option value="en">{t('humanSupport.lang_en')}</option>
                <option value="ur">{t('humanSupport.lang_ur')}</option>
              </Select>
            </div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('humanSupport.notePlaceholder')} maxLength={1000} rows={3} dir="auto" />
            {error && <ErrorState message={error} />}
            <Button type="submit" loading={busy}>
              {t('humanSupport.submit')}
            </Button>
          </form>
        )}
      </section>

      {requests.data && requests.data.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-ink-900">{t('humanSupport.previousRequests')}</h2>
          <ul className="mt-3 divide-y divide-ink-900/5 card-solid">
            {requests.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink-900">{t(`humanSupport.type_${r.requestType}`)}</p>
                  <p className="text-xs text-ink-500">{formatDate(r.createdAt, locale)}</p>
                </div>
                <Badge tone="neutral">{t(`humanSupport.status_${r.status}`)}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
