import { describe, expect, it } from 'vitest';
import { PHQ9_THRESHOLDS } from '@/config/thresholds';
import { resolveInstrumentContent, getInstrumentContent } from './instruments';
import { AssessmentScoringError, bandForScore, scoreAssessment } from './scoring';

describe('scoreAssessment — PHQ-9', () => {
  it('sums item responses and assigns the correct band', () => {
    const score = scoreAssessment('phq9', [0, 0, 1, 1, 0, 0, 1, 0, 0]);
    expect(score.total).toBe(3);
    expect(score.maxTotal).toBe(27);
    expect(score.band).toBe('minimal');
    expect(score.complete).toBe(true);
    expect(score.flaggedSafetyItem).toBe(false);
  });

  it.each([
    [0, 'minimal'],
    [4, 'minimal'],
    [5, 'mild'],
    [9, 'mild'],
    [10, 'moderate'],
    [14, 'moderate'],
    [15, 'moderately_severe'],
    [19, 'moderately_severe'],
    [20, 'severe'],
    [27, 'severe'],
  ] as const)('maps a total of %i to the %s band', (total, band) => {
    expect(bandForScore('phq9', total)).toBe(band);
  });

  it('flags any non-zero response on the self-harm item (item 9)', () => {
    const score = scoreAssessment('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(score.flaggedSafetyItem).toBe(true);
    expect(score.safetyItemResponse).toBe(1);
    expect(PHQ9_THRESHOLDS.safetyItemIndices).toEqual([8]);
  });

  it('does not flag when item 9 is zero even if the total is severe', () => {
    const score = scoreAssessment('phq9', [3, 3, 3, 3, 3, 3, 3, 3, 0]);
    expect(score.total).toBe(24);
    expect(score.band).toBe('severe');
    expect(score.flaggedSafetyItem).toBe(false);
  });

  it('marks incomplete responses without throwing', () => {
    const score = scoreAssessment('phq9', [1, null, 1, null, null, null, null, null, null]);
    expect(score.complete).toBe(false);
    expect(score.total).toBe(2);
  });

  it('rejects the wrong number of items', () => {
    expect(() => scoreAssessment('phq9', [0, 0, 0])).toThrow(AssessmentScoringError);
  });

  it('rejects out-of-range or non-integer values', () => {
    expect(() => scoreAssessment('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 4])).toThrow(AssessmentScoringError);
    expect(() => scoreAssessment('phq9', [0, 0, 0, 0, 0, 0, 0, 0, -1])).toThrow(AssessmentScoringError);
    expect(() => scoreAssessment('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 1.5])).toThrow(AssessmentScoringError);
  });
});

describe('scoreAssessment — GAD-7', () => {
  it.each([
    [0, 'minimal'],
    [5, 'mild'],
    [10, 'moderate'],
    [15, 'severe'],
    [21, 'severe'],
  ] as const)('maps a total of %i to the %s band', (total, band) => {
    expect(bandForScore('gad7', total)).toBe(band);
  });

  it('has no safety items and never flags', () => {
    const score = scoreAssessment('gad7', [3, 3, 3, 3, 3, 3, 3]);
    expect(score.total).toBe(21);
    expect(score.flaggedSafetyItem).toBe(false);
    expect(score.safetyItemResponse).toBeNull();
  });
});

describe('instrument localisation registry', () => {
  it('has English content for both instruments with the right item counts', () => {
    const phq = getInstrumentContent('phq9', 'en');
    const gad = getInstrumentContent('gad7', 'en');
    expect(phq.status).toBe('available');
    expect(gad.status).toBe('available');
    if (phq.status === 'available') expect(phq.items).toHaveLength(9);
    if (gad.status === 'available') expect(gad.items).toHaveLength(7);
  });

  it('does NOT ship a generated Urdu translation — it awaits the validated wording', () => {
    expect(getInstrumentContent('phq9', 'ur').status).toBe('awaiting_validated_translation');
    expect(getInstrumentContent('gad7', 'ur').status).toBe('awaiting_validated_translation');
  });

  it('falls back to English for Urdu and tells the caller it did so', () => {
    const resolved = resolveInstrumentContent('phq9', 'ur');
    expect(resolved.fellBackToEnglish).toBe(true);
    expect(resolved.content.locale).toBe('en');
    expect(resolveInstrumentContent('phq9', 'en').fellBackToEnglish).toBe(false);
  });
});
