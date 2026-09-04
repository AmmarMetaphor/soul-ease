import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { useT } from '@/i18n';
import type { ConsentState } from '@/memory/permissions';

interface ConsentStepProps {
  initial: ConsentState;
  busy: boolean;
  onBack: () => void;
  onAccept: (choices: ConsentState) => void;
}

export function ConsentStep({ initial, busy, onBack, onAccept }: ConsentStepProps) {
  const t = useT();
  const [core, setCore] = useState(initial.core);
  const [transcript, setTranscript] = useState(initial.transcriptStorage);
  const [memory, setMemory] = useState(initial.longTermMemory || !initial.core);
  const [assessment, setAssessment] = useState(initial.assessmentStorage || !initial.core);

  const points = [
    ['onboarding.consentPoint1Title', 'onboarding.consentPoint1Body'],
    ['onboarding.consentPoint2Title', 'onboarding.consentPoint2Body'],
    ['onboarding.consentPoint3Title', 'onboarding.consentPoint3Body'],
    ['onboarding.consentPoint4Title', 'onboarding.consentPoint4Body'],
  ] as const;

  return (
    <div className="mx-auto max-w-2xl py-8 animate-fade-up">
      <h1 className="text-3xl font-medium text-ink-900">{t('onboarding.consentTitle')}</h1>
      <p className="mt-3 text-ink-700">{t('onboarding.consentIntro')}</p>

      <ol className="mt-8 space-y-3">
        {points.map(([title, body], i) => (
          <li key={title} className="card-solid flex gap-4 p-5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sm font-semibold text-emerald-800">
              {i + 1}
            </span>
            <div>
              <h2 className="font-semibold text-ink-900">{t(title)}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-700">{t(body)}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="card-solid mt-8 divide-y divide-ink-900/5 p-2">
        <Checkbox
          checked={core}
          onChange={(e) => setCore(e.target.checked)}
          label={
            <span className="flex flex-wrap items-center gap-2">
              {t('onboarding.consentCore')}
              <Badge tone="sage">{t('onboarding.consentRequired')}</Badge>
            </span>
          }
        />
        <Checkbox checked={transcript} onChange={(e) => setTranscript(e.target.checked)} label={t('onboarding.consentTranscript')} />
        <Checkbox checked={memory} onChange={(e) => setMemory(e.target.checked)} label={t('onboarding.consentMemory')} />
        <Checkbox checked={assessment} onChange={(e) => setAssessment(e.target.checked)} label={t('onboarding.consentAssessment')} />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          {t('common.back')}
        </Button>
        <Button
          size="lg"
          disabled={!core}
          loading={busy}
          onClick={() => onAccept({ core, transcriptStorage: transcript, longTermMemory: memory, assessmentStorage: assessment, journalAiAccess: false })}
        >
          {t('onboarding.consentAccept')}
        </Button>
      </div>
    </div>
  );
}
