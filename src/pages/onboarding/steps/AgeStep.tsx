import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { ROUTES } from '@/config/app';
import { useT } from '@/i18n';
import { checkAgeEligibility } from '@/onboarding/ageEligibility';

interface AgeStepProps {
  busy: boolean;
  onEligible: () => void;
  onExit: () => void;
}

export function AgeStep({ busy, onEligible, onExit }: AgeStepProps) {
  const t = useT();
  const [dob, setDob] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = checkAgeEligibility(dob);
    if (result.eligible) {
      onEligible();
      return;
    }
    if (result.reason === 'invalid_date') setError(t('onboarding.ageInvalid'));
    else if (result.reason === 'future_date') setError(t('onboarding.ageFuture'));
    else setBlocked(true);
  }

  if (blocked) {
    return (
      <div className="mx-auto max-w-lg py-10 animate-fade-up">
        <h1 className="text-3xl font-medium text-ink-900">{t('onboarding.ageUnderTitle')}</h1>
        <p className="mt-4 leading-relaxed text-ink-700">{t('onboarding.ageUnderBody')}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to={ROUTES.safety}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-sage-100 px-6 font-semibold text-emerald-800"
          >
            {t('nav.safety')}
          </Link>
          <Button variant="ghost" size="lg" onClick={onExit}>
            {t('common.signOut')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg py-10 animate-fade-up" noValidate>
      <h1 className="text-3xl font-medium text-ink-900">{t('onboarding.ageTitle')}</h1>
      <p className="mt-3 text-ink-700">{t('onboarding.ageBody')}</p>
      <Input
        type="date"
        label={t('onboarding.ageLabel')}
        hint={t('onboarding.ageHelp')}
        value={dob}
        onChange={(e) => {
          setDob(e.target.value);
          setError(null);
        }}
        error={error}
        max={new Date().toISOString().slice(0, 10)}
        required
        wrapperClassName="mt-8"
      />
      <Button type="submit" size="lg" className="mt-8" loading={busy} disabled={!dob}>
        {t('common.continue')}
      </Button>
    </form>
  );
}
