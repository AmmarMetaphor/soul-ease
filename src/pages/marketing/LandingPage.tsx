import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { NoorOrb } from '@/components/brand/NoorOrb';
import { LinkButton } from '@/components/ui/Button';
import { HeartIcon, LockIcon, SparkIcon, WaveIcon } from '@/components/ui/Icons';
import { ROUTES } from '@/config/app';
import { useT } from '@/i18n';

export function LandingPage() {
  const t = useT();
  const { status } = useAuth();
  const primaryTo = status === 'signed_in' ? ROUTES.dashboard : ROUTES.signup;

  const pillars = [
    { icon: WaveIcon, title: t('landing.pillar1Title'), body: t('landing.pillar1Body') },
    { icon: SparkIcon, title: t('landing.pillar2Title'), body: t('landing.pillar2Body') },
    { icon: HeartIcon, title: t('landing.pillar3Title'), body: t('landing.pillar3Body') },
    { icon: LockIcon, title: t('landing.pillar4Title'), body: t('landing.pillar4Body') },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      {/* Hero */}
      <section className="grid items-center gap-12 py-10 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
        <div className="animate-fade-up">
          <p className="eyebrow mb-4">{t('common.tagline')}</p>
          <h1 className="text-4xl font-light leading-[1.08] text-ink-900 sm:text-5xl lg:text-6xl">{t('landing.heroTitle')}</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-700">{t('landing.heroBody')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <LinkButton to={primaryTo} size="xl">
              {t('landing.cta')}
            </LinkButton>
            {status !== 'signed_in' && (
              <LinkButton to={ROUTES.login} variant="ghost" size="xl">
                {t('landing.ctaSecondary')}
              </LinkButton>
            )}
          </div>
          <p className="mt-6 text-sm text-ink-500">{t('common.supportingLine')}</p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <div className="relative">
            <NoorOrb state="ready" size="xl" />
            <div className="absolute -bottom-6 left-1/2 w-max -translate-x-1/2 rounded-full bg-white/80 px-4 py-2 text-xs font-medium text-ink-700 shadow-soft ring-1 ring-ink-900/5 backdrop-blur">
              Noor · {t('common.aiGuide')}
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="py-10 sm:py-14" aria-labelledby="pillars-title">
        <h2 id="pillars-title" className="text-2xl font-medium text-ink-900 sm:text-3xl">
          {t('landing.pillarsTitle')}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {pillars.map((p) => (
            <article key={p.title} className="card p-6">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-emerald-700">
                <p.icon size={22} />
              </span>
              <h3 className="text-lg font-semibold text-ink-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Honesty */}
      <section className="py-10 sm:py-14">
        <div className="relative overflow-hidden rounded-3xl bg-emerald-800 p-8 text-ivory-50 sm:p-12 grain">
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-2xl font-medium sm:text-3xl">{t('landing.honestyTitle')}</h2>
            <p className="mt-4 leading-relaxed text-ivory-50/85">{t('landing.honestyBody')}</p>
            <Link
              to={ROUTES.safety}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ivory-50 underline decoration-ivory-50/40 underline-offset-4 hover:decoration-ivory-50"
            >
              {t('landing.safetyLink')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
