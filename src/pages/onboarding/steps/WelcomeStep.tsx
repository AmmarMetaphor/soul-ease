import { NoorOrb } from '@/components/brand/NoorOrb';
import { Button } from '@/components/ui/Button';
import { useT } from '@/i18n';

export function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center py-8 text-center animate-fade-up">
      <NoorOrb state="ready" size="lg" />
      <p className="eyebrow mt-12">{t('common.tagline')}</p>
      <h1 className="mt-3 text-4xl font-medium text-ink-900">{t('onboarding.welcomeTitle')}</h1>
      <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-700">{t('onboarding.welcomeBody')}</p>
      <Button size="xl" className="mt-10" onClick={onContinue}>
        {t('onboarding.welcomeCta')}
      </Button>
    </div>
  );
}
