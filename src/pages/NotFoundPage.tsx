import { LinkButton } from '@/components/ui/Button';
import { ROUTES } from '@/config/app';
import { useT } from '@/i18n';

export function NotFoundPage() {
  const t = useT();
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-5 text-center">
      <p className="eyebrow mb-3">404</p>
      <h1 className="text-3xl font-medium text-ink-900">{t('errors.notFound')}</h1>
      <p className="mt-2 text-ink-500">{t('errors.notFoundBody')}</p>
      <LinkButton to={ROUTES.home} className="mt-8">
        {t('errors.goHome')}
      </LinkButton>
    </div>
  );
}
