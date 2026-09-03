import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { ErrorState, InlineNotice } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useData } from '@/data/DataContext';
import { useT } from '@/i18n';

export function DeleteAccountPage() {
  const t = useT();
  const navigate = useNavigate();
  const { repo } = useData();
  const { signOut } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (confirmation.trim() !== 'DELETE') return;
    setBusy(true);
    setError(null);
    try {
      await repo.deleteAccount();
      setDone(true);
      await signOut();
      window.setTimeout(() => navigate(ROUTES.home, { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg">
        <InlineNotice tone="sage">{t('settings.deleteAccountDone')}</InlineNotice>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link to={ROUTES.settings} className="text-sm font-semibold text-emerald-700">
        ← {t('settings.title')}
      </Link>
      <h1 className="mt-4 text-3xl font-medium text-ink-900">{t('settings.deleteAccountTitle')}</h1>
      <p className="mt-3 leading-relaxed text-ink-700">{t('settings.deleteAccountBody')}</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <Input label={t('settings.deleteAccountConfirmLabel')} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} />
        {error && <ErrorState message={error} />}
        <Button type="submit" variant="danger" loading={busy} disabled={confirmation.trim() !== 'DELETE'}>
          {t('settings.deleteAccountButton')}
        </Button>
      </form>
    </div>
  );
}
