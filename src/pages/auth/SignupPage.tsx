import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { describeAuthError, useAuth } from '@/auth/AuthContext';
import { MIN_PASSWORD_LENGTH } from '@/auth/types';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input } from '@/components/ui/Field';
import { InlineNotice } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useT } from '@/i18n';

export function SignupPage() {
  const t = useT();
  const navigate = useNavigate();
  const { signUp, isDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    if (!adult) {
      setError(t('onboarding.ageBody'));
      return;
    }
    setBusy(true);
    try {
      const result = await signUp(email, password);
      if (result.needsEmailVerification) {
        navigate(ROUTES.verifyEmail, { state: { email }, replace: true });
      } else {
        navigate(ROUTES.onboarding, { replace: true });
      }
    } catch (err) {
      setError(describeAuthError(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-medium text-ink-900">{t('auth.signupTitle')}</h1>
      <p className="mt-2 text-ink-500">{t('auth.signupSubtitle')}</p>

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
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          hint={`${MIN_PASSWORD_LENGTH}+ characters`}
          required
        />
        <Input
          type="password"
          label={t('auth.confirmPassword')}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Checkbox label={t('auth.ageAttestation')} checked={adult} onChange={(e) => setAdult(e.target.checked)} />
        {error && (
          <p role="alert" className="rounded-xl bg-danger-100 px-4 py-3 text-sm text-danger-600">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" full loading={busy}>
          {t('common.signUp')}
        </Button>
        <p className="text-center text-sm text-ink-500">
          {t('auth.haveAccount')}{' '}
          <Link to={ROUTES.login} className="font-semibold text-emerald-700 hover:text-emerald-800">
            {t('common.signIn')}
          </Link>
        </p>
      </form>
    </div>
  );
}
