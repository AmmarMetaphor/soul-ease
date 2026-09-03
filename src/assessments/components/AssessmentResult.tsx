import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { InlineNotice } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { SUGGEST_HUMAN_SUPPORT_AT } from '@/config/thresholds';
import { useT } from '@/i18n';
import { resolveInstrumentContent } from '../instruments';
import type { AssessmentLocale, AssessmentScore } from '../types';

interface AssessmentResultProps {
  score: AssessmentScore;
  locale: AssessmentLocale;
  stored: boolean;
  compact?: boolean;
}

export function bandKey(band: AssessmentScore['band']) {
  return `assessment.band_${band}` as const;
}

export function AssessmentResult({ score, locale, stored, compact }: AssessmentResultProps) {
  const t = useT();
  const { content } = resolveInstrumentContent(score.instrument, locale);
  const suggestHuman = score.total >= SUGGEST_HUMAN_SUPPORT_AT[score.instrument];

  return (
    <div className="card-solid p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-500">{content.title}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-4xl font-medium text-ink-900">{score.total}</span>
            <span className="text-sm text-ink-300">/ {score.maxTotal}</span>
          </p>
        </div>
        <Badge tone={score.band === 'minimal' || score.band === 'mild' ? 'sage' : 'dusk'}>{t(bandKey(score.band))}</Badge>
      </div>

      <p className="mt-4 rounded-xl bg-sage-100 px-4 py-2.5 text-sm font-semibold text-emerald-800">{t('assessment.disclaimer')}</p>

      {!compact && <p className="mt-4 text-sm leading-relaxed text-ink-700">{t('assessment.explain')}</p>}

      {score.flaggedSafetyItem && (
        <InlineNotice tone="warn" className="mt-4">
          {t('assessment.safetyItemNote')}{' '}
          <Link to={ROUTES.safety} className="font-semibold underline">
            {t('assessment.viewSafety')}
          </Link>
        </InlineNotice>
      )}

      {suggestHuman && !score.flaggedSafetyItem && (
        <InlineNotice tone="dusk" className="mt-4">
          {t('assessment.suggestHuman')}{' '}
          <Link to={ROUTES.humanSupport} className="font-semibold underline">
            {t('nav.humanSupport')}
          </Link>
        </InlineNotice>
      )}

      {!stored && <p className="mt-4 text-xs text-ink-500">{t('onboarding.screeningNotStored')}</p>}
    </div>
  );
}
