import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, LinkCard } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { LockIcon, SparkIcon, TrashIcon } from '@/components/ui/Icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, InlineNotice } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useData } from '@/data/DataContext';
import type { InteractionMode, UiLocale } from '@/data/types';
import { useI18n } from '@/i18n';

export function SettingsPage() {
  const { t, setLocale } = useI18n();
  const navigate = useNavigate();
  const { signOut, isDemo, session } = useAuth();
  const { profile, updateProfile } = useData();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.displayName ?? '');
  }, [profile?.displayName]);

  async function save(update: Parameters<typeof updateProfile>[0]) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile(update);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t('settings.title')} />

      <Card>
        <CardHeader title={t('settings.profile')} />
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ displayName: name.trim() || null });
          }}
        >
          <Input label={t('settings.displayName')} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('settings.preferredLanguage')}
              value={profile?.preferredLanguage ?? 'en'}
              onChange={(e) => {
                const next = e.target.value as UiLocale;
                setLocale(next);
                void save({ preferredLanguage: next });
              }}
            >
              <option value="en">{t('common.english')}</option>
              <option value="ur">{t('common.urdu')}</option>
            </Select>
            <Select label={t('settings.preferredMode')} value={profile?.preferredMode ?? 'audio'} onChange={(e) => void save({ preferredMode: e.target.value as InteractionMode })}>
              <option value="audio">{t('onboarding.audioTitle')}</option>
              <option value="text">{t('onboarding.textTitle')}</option>
            </Select>
          </div>
          {error && <ErrorState message={error} />}
          {saved && <InlineNotice tone="sage">{t('settings.consentUpdated')}</InlineNotice>}
          <div className="flex items-center justify-between">
            <Button type="submit" loading={saving} variant="secondary">
              {t('common.save')}
            </Button>
            <span className="text-xs text-ink-500">{session?.user.email}</span>
          </div>
        </form>
      </Card>

      <LinkCard to={ROUTES.memory} title={t('settings.privacyTitle')} description={t('settings.privacyBody')} icon={<SparkIcon size={20} />} />
      <LinkCard to={ROUTES.privacy} title={t('privacy.title')} description={t('privacy.intro').slice(0, 90) + '…'} icon={<LockIcon size={20} />} />
      <LinkCard to={ROUTES.deleteAccount} title={t('settings.deleteAccount')} description={t('settings.deleteAccountBody').split('.')[0] + '.'} icon={<TrashIcon size={20} />} />

      <Card>
        <CardHeader title={t('settings.about')} />
        <p className="text-sm text-ink-700">{t('settings.aboutBody')}</p>
        <p className="mt-2 text-xs text-ink-500">
          {t('settings.version')} 0.1.0 · Phase 1 {isDemo && `· ${t('common.demoBadge')}`}
        </p>
        <div className="mt-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => void signOut().then(() => navigate(ROUTES.home))}>
            {t('common.signOut')}
          </Button>
          <Link to={ROUTES.safety} className="text-sm font-semibold text-emerald-700">
            {t('nav.safety')}
          </Link>
        </div>
      </Card>
    </div>
  );
}
