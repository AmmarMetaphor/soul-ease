import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { describeAuthError, useAuth } from '@/auth/AuthContext';
import { Button, LinkButton } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useT } from '@/i18n';

/**
 * Two roles: (a) "check your inbox" after sign-up, (b) landing page for the
 * confirmation link, at which point the member is signed in and can continue.
 */
export function VerifyEmailPage() {
  const t = useT();
  const location = useLocation();
  const { status, session, resendVerificationEmail } = useAuth();
  const email = (location.state as { email?: string } | null)?.email ?? session?.user.email ?? '';
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = status === 'signed_in' && !!session?.user.emailConfirmedAt;

  async function resend() {
    setError(null);
    try {
      await resendVerificationEmail(email);
      setResent(true);
    } catch (err) {
      setError(describeAuthError(err, t('errors.generic')));
    }
  }

  if (confirmed) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-3xl font-medium text-ink-900">{t('auth.verifiedTitle')}</h1>
        <p className="mt-2 text-ink-500">{t('auth.verifiedBody')}</p>
        <LinkButton to={ROUTES.onboarding} size="lg" className="mt-8">
          {t('common.continue')}
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-medium text-ink-900">{t('auth.verifyTitle')}</h1>
      <p className="mt-2 leading-relaxed text-ink-500">{t('auth.verifyBody', { email: email || '—' })}</p>
      {resent && (
        <InlineNotice tone="sage" className="mt-6">
          {t('auth.verifyResent')}
        </InlineNotice>
      )}
      {error && (
        <p role="alert" className="mt-6 rounded-xl bg-danger-100 px-4 py-3 text-sm text-danger-600">
          {error}
        </p>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button variant="secondary" onClick={() => void resend()} disabled={!email}>
          {t('auth.verifyResend')}
        </Button>
        <Link to={ROUTES.login} className="inline-flex items-center text-sm font-semibold text-emerald-700 hover:text-emerald-800">
          {t('common.signIn')}
        </Link>
      </div>
    </div>
  );
}
