import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { describeAuthError, useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { InlineNotice } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useT } from '@/i18n';

export function ForgotPasswordPage() {
  const t = useT();
  const { requestPasswordReset, isDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(describeAuthError(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-medium text-ink-900">{t('auth.resetTitle')}</h1>
      <p className="mt-2 text-ink-500">{t('auth.resetSubtitle')}</p>
      {isDemo && (
        <InlineNotice tone="dusk" className="mt-6">
          {t('auth.demoNote')}
        </InlineNotice>
      )}
      {sent ? (
        <InlineNotice tone="sage" className="mt-8">
          {t('auth.resetSent')}
        </InlineNotice>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
          <Input
            type="email"
            label={t('auth.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {error && (
            <p role="alert" className="rounded-xl bg-danger-100 px-4 py-3 text-sm text-danger-600">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" full loading={busy}>
            {t('auth.sendResetLink')}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-ink-500">
        <Link to={ROUTES.login} className="font-semibold text-emerald-700 hover:text-emerald-800">
          {t('common.back')}
        </Link>
      </p>
    </div>
  );
}
