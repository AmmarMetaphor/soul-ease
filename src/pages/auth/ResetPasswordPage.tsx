import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { describeAuthError, useAuth } from '@/auth/AuthContext';
import { MIN_PASSWORD_LENGTH } from '@/auth/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { InlineNotice } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useT } from '@/i18n';

/**
 * Landing page for the password-recovery email link. Supabase places a
 * recovery session in the URL; the client picks it up automatically
 * (detectSessionInUrl), after which updateUser({ password }) is permitted.
 */
export function ResetPasswordPage() {
  const t = useT();
  const navigate = useNavigate();
  const { updatePassword, status } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
      window.setTimeout(() => navigate(ROUTES.dashboard, { replace: true }), 1200);
    } catch (err) {
      setError(describeAuthError(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-medium text-ink-900">{t('auth.newPasswordTitle')}</h1>
      {status === 'signed_out' && (
        <InlineNotice tone="warn" className="mt-6">
          The recovery link may have expired. Request a new one from the sign-in page.
        </InlineNotice>
      )}
      {done ? (
        <InlineNotice tone="sage" className="mt-8">
          {t('auth.passwordUpdated')}
        </InlineNotice>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
          <Input
            type="password"
            label={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
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
          {error && (
            <p role="alert" className="rounded-xl bg-danger-100 px-4 py-3 text-sm text-danger-600">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" full loading={busy} disabled={status === 'signed_out'}>
            {t('auth.updatePassword')}
          </Button>
        </form>
      )}
    </div>
  );
}
