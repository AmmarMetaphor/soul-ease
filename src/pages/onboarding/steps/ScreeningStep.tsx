import { useState } from 'react';
import { AssessmentForm } from '@/assessments/components/AssessmentForm';
import { AssessmentResult } from '@/assessments/components/AssessmentResult';
import { useAssessmentFlow } from '@/assessments/useAssessmentFlow';
import { Button } from '@/components/ui/Button';
import { ErrorState, InlineNotice } from '@/components/ui/States';
import { useI18n } from '@/i18n';

interface ScreeningStepProps {
  onBack: () => void;
  onContinue: () => void;
}

export function ScreeningStep({ onBack, onContinue }: ScreeningStepProps) {
  const { t, locale } = useI18n();
  const flow = useAssessmentFlow(locale);
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <div className="mx-auto max-w-2xl py-8 animate-fade-up">
        <h1 className="text-3xl font-medium text-ink-900">{t('onboarding.screeningTitle')}</h1>
        <p className="mt-3 leading-relaxed text-ink-700">{t('onboarding.screeningBody')}</p>
        <InlineNotice tone="sage" className="mt-6">
          {t('assessment.disclaimer')}
        </InlineNotice>
        {!flow.persist && (
          <InlineNotice tone="neutral" className="mt-3">
            {t('onboarding.screeningNotStored')}
          </InlineNotice>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={onBack}>
            {t('common.back')}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onContinue}>
              {t('onboarding.screeningSkip')}
            </Button>
            <Button size="lg" onClick={() => setStarted(true)}>
              {t('onboarding.screeningStart')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (flow.finished) {
    return (
      <div className="mx-auto max-w-2xl py-8 animate-fade-up">
        <h1 className="text-3xl font-medium text-ink-900">{t('assessment.resultTitle')}</h1>
        <div className="mt-6 space-y-4">
          {flow.results.map((r) => (
            <AssessmentResult key={r.score.instrument} score={r.score} locale={locale} stored={r.stored} />
          ))}
        </div>
        <div className="mt-8 flex justify-end">
          <Button size="lg" onClick={onContinue}>
            {t('common.continue')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      {flow.error && <ErrorState message={flow.error} className="mb-6" />}
      {flow.current && (
        <AssessmentForm
          key={flow.current}
          instrument={flow.current}
          locale={locale}
          onComplete={(responses) => void flow.submit(responses)}
          onCancel={onContinue}
          cancelLabel={t('onboarding.screeningSkip')}
        />
      )}
    </div>
  );
}
