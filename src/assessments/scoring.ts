import { GAD7_THRESHOLDS, PHQ9_THRESHOLDS, type InstrumentThresholds } from '@/config/thresholds';
import type { AssessmentScore, InstrumentId } from './types';

export function thresholdsFor(instrument: InstrumentId): InstrumentThresholds {
  return instrument === 'phq9' ? PHQ9_THRESHOLDS : GAD7_THRESHOLDS;
}

export class AssessmentScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssessmentScoringError';
  }
}

/**
 * Score a set of item responses.
 *
 * `responses` may contain `null` for unanswered items; the result is then
 * marked incomplete and the total reflects only the answered items. Any value
 * outside 0..maxItemScore is rejected — bad input must never silently score.
 */
export function scoreAssessment(
  instrument: InstrumentId,
  responses: ReadonlyArray<number | null>,
): AssessmentScore {
  const thresholds = thresholdsFor(instrument);

  if (responses.length !== thresholds.itemCount) {
    throw new AssessmentScoringError(
      `${instrument} expects ${thresholds.itemCount} responses, received ${responses.length}`,
    );
  }

  let total = 0;
  let complete = true;
  for (const [index, value] of responses.entries()) {
    if (value === null || value === undefined) {
      complete = false;
      continue;
    }
    if (!Number.isInteger(value) || value < 0 || value > thresholds.maxItemScore) {
      throw new AssessmentScoringError(
        `${instrument} item ${index + 1} has an invalid response: ${String(value)}`,
      );
    }
    total += value;
  }

  let safetyItemResponse: number | null = null;
  for (const index of thresholds.safetyItemIndices) {
    const value = responses[index];
    if (value !== null && value !== undefined && value >= thresholds.safetyItemMinResponse) {
      safetyItemResponse = Math.max(safetyItemResponse ?? 0, value);
    }
  }

  return {
    instrument,
    total,
    maxTotal: thresholds.itemCount * thresholds.maxItemScore,
    band: bandForScore(instrument, total),
    flaggedSafetyItem: safetyItemResponse !== null,
    safetyItemResponse,
    complete,
  };
}

export function bandForScore(instrument: InstrumentId, total: number) {
  const { bands } = thresholdsFor(instrument);
  const match = bands.find((b) => total >= b.min && total <= b.max);
  if (!match) {
    // Scores are clamped into the highest band rather than throwing so a
    // corrupted historic record still renders somewhere sensible.
    return bands[bands.length - 1].band;
  }
  return match.band;
}
