import { useCallback, useState } from 'react';
import { useData } from '@/data/DataContext';
import type { UiLocale } from '@/data/types';
import { canPersistAssessment } from '@/memory/permissions';
import { transitionSafetyState } from '@/safety/machine';
import { INSTRUMENT_ORDER } from './instruments';
import { scoreAssessment } from './scoring';
import type { AssessmentScore, InstrumentId } from './types';

export interface CompletedAssessment {
  score: AssessmentScore;
  stored: boolean;
}

/**
 * Runs the configured instruments in sequence, scores them, persists when
 * consent allows, and raises the safety architecture on flagged items.
 */
export function useAssessmentFlow(locale: UiLocale) {
  const { repo, consent } = useData();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<CompletedAssessment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current: InstrumentId | null = INSTRUMENT_ORDER[index] ?? null;
  const finished = current === null;
  const persist = canPersistAssessment(consent);

  const submit = useCallback(
    async (responses: number[]) => {
      if (!current) return;
      setError(null);
      const score = scoreAssessment(current, responses);
      let stored = false;
      setSaving(true);
      try {
        if (persist) {
          await repo.createAssessmentRun({
            instrument: current,
            locale,
            responses,
            totalScore: score.total,
            band: score.band,
            flaggedSafetyItem: score.flaggedSafetyItem,
          });
          stored = true;
        }
        if (score.flaggedSafetyItem && score.safetyItemResponse !== null) {
          const thresholdsIndex = current === 'phq9' ? 8 : 0;
          const transition = transitionSafetyState('NORMAL', {
            type: 'assessment_item',
            instrument: current,
            itemIndex: thresholdsIndex,
            response: score.safetyItemResponse,
          });
          if (transition.changed) {
            // Safety events never include the member's answers.
            await repo.logSafetyEvent({
              sessionId: null,
              fromState: transition.from,
              toState: transition.to,
              triggerSource: 'assessment_item',
              resourcesShown: true,
              humanSupportOffered: transition.to !== 'NORMAL',
            });
          }
        }
        setResults((prev) => [...prev, { score, stored }]);
        setIndex((i) => i + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save this check-in.');
      } finally {
        setSaving(false);
      }
    },
    [current, locale, persist, repo],
  );

  const reset = useCallback(() => {
    setIndex(0);
    setResults([]);
    setError(null);
  }, []);

  return { current, finished, results, submit, saving, error, reset, persist };
}
