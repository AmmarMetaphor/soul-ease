import { useState } from 'react';
import { NoorOrb } from '@/components/brand/NoorOrb';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useT } from '@/i18n';

interface MeetNoorStepProps {
  initialName: string | null;
  busy: boolean;
  onStart: (name: string | null) => void;
  onDashboard: (name: string | null) => void;
}

export function MeetNoorStep({ initialName, busy, onStart, onDashboard }: MeetNoorStepProps) {
  const t = useT();
  const [name, setName] = useState(initialName ?? '');
  const cleaned = name.trim() ? name.trim().slice(0, 80) : null;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-8 text-center animate-fade-up">
      <NoorOrb state="speaking" size="lg" />
      <p className="eyebrow mt-12">{t('onboarding.meetDesignation')}</p>
      <h1 className="mt-3 text-4xl font-medium text-ink-900">{t('onboarding.meetTitle')}</h1>
      <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-700">{t('onboarding.meetBody')}</p>

      <Input
        label={t('onboarding.meetNameLabel')}
        placeholder={t('onboarding.meetNamePlaceholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        autoComplete="given-name"
        wrapperClassName="mt-10 w-full max-w-sm text-start"
      />

      <Button size="xl" className="mt-8" loading={busy} onClick={() => onStart(cleaned)}>
        {t('onboarding.meetCta')}
      </Button>
      <button type="button" className="mt-4 text-sm font-medium text-ink-500 hover:text-ink-900" onClick={() => onDashboard(cleaned)} disabled={busy}>
        {t('onboarding.meetLater')}
      </button>
    </div>
  );
}
