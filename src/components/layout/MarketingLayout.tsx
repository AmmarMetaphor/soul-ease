import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Logo } from '@/components/brand/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LinkButton } from '@/components/ui/Button';
import { ROUTES } from '@/config/app';
import { useT } from '@/i18n';

export function MarketingLayout() {
  const t = useT();
  const { status } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Primary">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          {status === 'signed_in' ? (
            <LinkButton to={ROUTES.dashboard} variant="primary" size="sm">
              {t('nav.home')}
            </LinkButton>
          ) : (
            <>
              <LinkButton to={ROUTES.login} variant="ghost" size="sm" className="whitespace-nowrap">
                {t('common.signIn')}
              </LinkButton>
              <span className="hidden sm:inline-flex">
                <LinkButton to={ROUTES.signup} variant="primary" size="sm" className="whitespace-nowrap">
                  {t('landing.cta')}
                </LinkButton>
              </span>
            </>
          )}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-6xl px-5 pb-16 pt-10 text-sm text-ink-500 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-4 border-t border-ink-900/10 pt-6 sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} Soul Ease · {t('common.aiGuide')}
          </p>
          <div className="flex items-center gap-5">
            <LanguageSwitcher className="sm:hidden" />
            <Link to={ROUTES.privacy} className="hover:text-ink-900">
              {t('landing.footerPrivacy')}
            </Link>
            <Link to={ROUTES.safety} className="hover:text-ink-900">
              {t('landing.footerSafety')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
