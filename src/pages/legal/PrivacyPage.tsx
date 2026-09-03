import { useT } from '@/i18n';

export function PrivacyPage() {
  const t = useT();
  const sections = [
    ['privacy.s1Title', 'privacy.s1Body'],
    ['privacy.s2Title', 'privacy.s2Body'],
    ['privacy.s3Title', 'privacy.s3Body'],
    ['privacy.s4Title', 'privacy.s4Body'],
    ['privacy.s5Title', 'privacy.s5Body'],
    ['privacy.s6Title', 'privacy.s6Body'],
    ['privacy.s7Title', 'privacy.s7Body'],
  ] as const;

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      <p className="eyebrow mb-3">{t('privacy.updated', { date: 'September 2026' })}</p>
      <h1 className="text-4xl font-medium text-ink-900">{t('privacy.title')}</h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-700">{t('privacy.intro')}</p>
      <div className="mt-10 space-y-8">
        {sections.map(([title, body]) => (
          <section key={title}>
            <h2 className="text-xl font-semibold text-ink-900">{t(title)}</h2>
            <p className="mt-2 leading-relaxed text-ink-700">{t(body)}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
