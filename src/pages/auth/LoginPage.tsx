import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { describeAuthError, useAuth } from '@/auth/AuthContext';
import { AuthError } from '@/auth/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { InlineNotice } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useT } from '@/i18n';

export function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, isDemo, resendVerificationEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? ROUTES.dashboard;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setUnconfirmed(false);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof AuthError && err.code === 'email_not_confirmed') setUnconfirmed(true);
      setError(describeAuthError(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  }

  async function demoQuickStart() {
    setBusy(true);
    setError(null);
    const demoEmail = 'demo@soulease.local';
    const demoPassword = 'demo-member-2026';
    try {
      try {
        await signIn(demoEmail, demoPassword);
      } catch {
        await signUp(demoEmail, demoPassword);
      }
      navigate(ROUTES.dashboard, { replace: true });
    } catch (err) {
      setError(describeAuthError(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-medium text-ink-900">{t('auth.loginTitle')}</h1>
      <p className="mt-2 text-ink-500">{t('auth.loginSubtitle')}</p>

      {isDemo && (
        <InlineNotice tone="dusk" className="mt-6">
          {t('auth.demoNote')}
        </InlineNotice>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        <Input
          type="email"
          label={t('auth.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          required
        />
        <Input
          type="password"
          label={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && (
          <div role="alert" className="rounded-xl bg-danger-100 px-4 py-3 text-sm text-danger-600">
            {error}
            {unconfirmed && (
              <button
                type="button"
                className="ms-2 font-semibold underline"
                onClick={() => void resendVerificationEmail(email)}
              >
                {t('auth.verifyResend')}
              </button>
            )}
          </div>
        )}
        <Button type="submit" size="lg" full loading={busy}>
          {t('common.signIn')}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <Link to={ROUTES.forgotPassword} className="text-ink-500 hover:text-ink-900">
            {t('auth.forgotPassword')}
          </Link>
          <Link to={ROUTES.signup} className="font-semibold text-emerald-700 hover:text-emerald-800">
            {t('auth.noAccount')} {t('common.signUp')}
          </Link>
        </div>
      </form>

      {isDemo && (
        <div className="mt-8 border-t border-ink-900/10 pt-6">
          <Button variant="soft" full onClick={() => void demoQuickStart()} loading={busy}>
            {t('auth.demoQuickStart')}
          </Button>
        </div>
      )}
    </div>
  );
}
