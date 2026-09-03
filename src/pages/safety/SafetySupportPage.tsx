import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { ROUTES } from '@/config/app';
import { useT } from '@/i18n';
import { SUPPORT_RESOURCES, RESOURCES_VERIFIED_FOR_PRODUCTION } from '@/safety/resources';

/**
 * Public safety page. Never gated by auth, onboarding or entitlement.
 */
export function SafetySupportPage() {
  const t = useT();
  const { status } = useAuth();

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      <h1 className="text-4xl font-medium text-ink-900">{t('safetyPage.title')}</h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-700">{t('safetyPage.intro')}</p>

      {!RESOURCES_VERIFIED_FOR_PRODUCTION && (
        <div role="alert" className="mt-8 rounded-2xl border border-warn-600/30 bg-warn-100 p-4 text-sm font-medium leading-relaxed text-warn-600">
          {t('safetyPage.devWarning')}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink-900">{t('safetyPage.stepsTitle')}</h2>
        <ol className="mt-4 space-y-3">
          {[t('safetyPage.step1'), t('safetyPage.step2'), t('safetyPage.step3')].map((step, i) => (
            <li key={i} className="flex gap-4 rounded-2xl bg-white/70 p-4 ring-1 ring-ink-900/5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sm font-semibold text-emerald-800">
                {i + 1}
              </span>
              <p className="leading-relaxed text-ink-700">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink-900">{t('safetyPage.resourcesTitle')}</h2>
        <ul className="mt-4 space-y-3">
          {SUPPORT_RESOURCES.map((r) => (
            <li key={r.id} className="card-solid p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-ink-900">{r.name}</h3>
                {r.verified ? (
                  <Badge tone="sage">{t('safetyPage.verified', { date: r.verifiedOn ?? '' })}</Badge>
                ) : (
                  <Badge tone="warn">{t('safetyPage.unverified')}</Badge>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{r.description}</p>
              {r.phone && (
                <a href={`tel:${r.phone}`} className="mt-3 inline-block text-lg font-semibold text-emerald-700">
                  {r.phone}
                </a>
              )}
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer" className="mt-2 block text-sm font-semibold text-emerald-700 underline">
                  {r.url}
                </a>
              )}
              {r.availability && <p className="mt-1 text-xs text-ink-500">{r.availability}</p>}
              {!r.verified && r.verificationNote && (
                <p className="mt-3 text-xs italic text-warn-600">{r.verificationNote}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        {status === 'signed_in' && (
          <LinkButton to={ROUTES.humanSupport} variant="primary">
            {t('safetyPage.humanSupport')}
          </LinkButton>
        )}
        <Link
          to={status === 'signed_in' ? ROUTES.dashboard : ROUTES.home}
          className="inline-flex h-11 items-center px-2 text-sm font-semibold text-ink-700 hover:text-ink-900"
        >
          {t('safetyPage.returnHome')}
        </Link>
      </div>
    </article>
  );
}
