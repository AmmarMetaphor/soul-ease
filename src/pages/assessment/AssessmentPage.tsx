import { useState } from 'react';
import { AssessmentForm } from '@/assessments/components/AssessmentForm';
import { AssessmentResult, bandKey } from '@/assessments/components/AssessmentResult';
import { useAssessmentFlow } from '@/assessments/useAssessmentFlow';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState, ErrorState, InlineNotice } from '@/components/ui/States';
import { useData } from '@/data/DataContext';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/dates';

export function AssessmentPage() {
  const { t, locale } = useI18n();
  const { repo } = useData();
  const flow = useAssessmentFlow(locale);
  const [taking, setTaking] = useState(false);
  const history = useAsync(() => repo.listAssessmentRuns(), [repo, flow.finished]);

  if (taking && !flow.finished) {
    return (
      <div className="mx-auto max-w-2xl">
        {flow.error && <ErrorState message={flow.error} className="mb-6" />}
        {flow.current && (
          <AssessmentForm
            key={flow.current}
            instrument={flow.current}
            locale={locale}
            onComplete={(responses) => void flow.submit(responses)}
            onCancel={() => {
              flow.reset();
              setTaking(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('common.notADiagnosis')}
        title={t('assessment.title')}
        subtitle={t('assessment.intro')}
        action={
          !taking && (
            <Button
              onClick={() => {
                flow.reset();
                setTaking(true);
              }}
            >
              {history.data && history.data.length > 0 ? t('assessment.retake') : t('dashboard.takeAssessment')}
            </Button>
          )
        }
      />

      {taking && flow.finished && (
        <section className="mb-10 space-y-4 animate-fade-up">
          {flow.results.map((r) => (
            <AssessmentResult key={r.score.instrument} score={r.score} locale={locale} stored={r.stored} />
          ))}
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                flow.reset();
                setTaking(false);
              }}
            >
              {t('common.done')}
            </Button>
          </div>
        </section>
      )}

      <InlineNotice tone="sage" className="mb-6">
        {t('assessment.explain')}
      </InlineNotice>

      <section>
        <h2 className="text-lg font-semibold text-ink-900">{t('dashboard.assessmentProgress')}</h2>
        {history.loading && <PageLoader />}
        {history.error && <ErrorState message={history.error} onRetry={() => void history.reload()} className="mt-4" />}
        {history.data && history.data.length === 0 && (
          <EmptyState title={t('dashboard.noAssessment')} className="card mt-4" />
        )}
        {history.data && history.data.length > 0 && (
          <ul className="mt-4 divide-y divide-ink-900/5 card-solid">
            {history.data.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-medium text-ink-900">{run.instrument.toUpperCase()}</p>
                  <p className="text-xs text-ink-500">{formatDate(run.completedAt, locale)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-2xl">{run.totalScore}</span>
                  <Badge tone={run.band === 'minimal' || run.band === 'mild' ? 'sage' : 'dusk'}>{t(bandKey(run.band))}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
