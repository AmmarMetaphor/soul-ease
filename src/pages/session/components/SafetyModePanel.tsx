import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { ROUTES } from '@/config/app';
import { useT } from '@/i18n';
import { RESOURCES_VERIFIED_FOR_PRODUCTION, SUPPORT_RESOURCES } from '@/safety/resources';
import type { SafetyState } from '@/safety/types';

interface SafetyModePanelProps {
  safetyState: SafetyState;
  onNotInDanger: () => void;
  onRequestHuman: () => void;
  onEnd: () => void;
}

/**
 * The simplified, calmer interface shown during SAFETY_MODE / HUMAN_HANDOFF.
 * No dramatic colour, no flashing. Clear steps, real options, honest limits.
 */
export function SafetyModePanel({ safetyState, onNotInDanger, onRequestHuman, onEnd }: SafetyModePanelProps) {
  const t = useT();
  const handoff = safetyState === 'HUMAN_HANDOFF';

  return (
    <section className="mx-auto w-full max-w-xl animate-fade-up" aria-labelledby="safety-title">
      <div className="card-solid p-6 sm:p-8">
        <p className="eyebrow">{t('session.safety')}</p>
        <h2 id="safety-title" className="mt-2 text-2xl font-medium text-ink-900">
          {t('safetyMode.title')}
        </h2>
        <p className="mt-3 leading-relaxed text-ink-700">{t('safetyMode.body')}</p>

        {!handoff && (
          <div className="mt-6 rounded-2xl bg-sage-100 p-4">
            <p className="font-semibold text-emerald-800">{t('safetyMode.questionSafe')}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={onNotInDanger}>
                {t('safetyMode.safeYes')}
              </Button>
              <Button variant="soft" onClick={onRequestHuman}>
                {t('safetyMode.safeNo')}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <h3 className="font-semibold text-ink-900">{t('safetyMode.trustedPerson')}</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-700">{t('safetyMode.trustedPersonBody')}</p>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold text-ink-900">{t('safetyMode.resources')}</h3>
          {!RESOURCES_VERIFIED_FOR_PRODUCTION && (
            <p className="mt-2 rounded-xl bg-warn-100 px-3 py-2 text-xs font-medium text-warn-600">{t('safetyMode.unverifiedWarning')}</p>
          )}
          <ul className="mt-3 space-y-2">
            {SUPPORT_RESOURCES.map((r) => (
              <li key={r.id} className="rounded-xl bg-ivory-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-900">{r.name}</span>
                  {!r.verified && <Badge tone="warn">{t('safetyPage.unverified')}</Badge>}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-700">{r.description}</p>
                {r.phone && (
                  <a href={`tel:${r.phone}`} className="mt-1 inline-block font-semibold text-emerald-700">
                    {r.phone}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-sm text-ink-500">{t('safetyMode.aiCannot')}</p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <LinkButton to={ROUTES.humanSupport} variant="primary">
            {t('safetyMode.talkToHuman')}
          </LinkButton>
          <Link to={ROUTES.safety} className="inline-flex h-11 items-center px-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            {t('nav.safety')}
          </Link>
          <Button variant="ghost" onClick={onEnd} className="sm:ms-auto">
            {t('safetyMode.endGently')}
          </Button>
        </div>
      </div>
    </section>
  );
}
