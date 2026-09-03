import { useState } from 'react';
import { ConcernCards } from '@/components/ConcernCards';
import { Button } from '@/components/ui/Button';
import type { ConcernId } from '@/data/types';
import { useT } from '@/i18n';

interface ConcernsStepProps {
  initial: ConcernId[];
  busy: boolean;
  onBack: () => void;
  onContinue: (concerns: ConcernId[]) => void;
}

export function ConcernsStep({ initial, busy, onBack, onContinue }: ConcernsStepProps) {
  const t = useT();
  const [concerns, setConcerns] = useState<ConcernId[]>(initial);
  return (
    <div className="mx-auto max-w-2xl py-8 animate-fade-up">
      <h1 className="text-3xl font-medium text-ink-900">{t('onboarding.concernsTitle')}</h1>
      <p className="mt-3 text-ink-700">{t('onboarding.concernsBody')}</p>
      <div className="mt-8">
        <ConcernCards value={concerns} onChange={setConcerns} />
      </div>
      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          {t('common.back')}
        </Button>
        <Button size="lg" loading={busy} onClick={() => onContinue(concerns)}>
          {t('common.continue')}
        </Button>
      </div>
    </div>
  );
}
