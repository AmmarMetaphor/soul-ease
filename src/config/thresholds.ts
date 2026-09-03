/**
 * Screening thresholds — kept in one place so numbers are never scattered
 * through components. These bands are the commonly published interpretation
 * ranges for each instrument. They describe screening scores only and are
 * never presented as a diagnosis.
 */

export type SeverityBand =
  | 'minimal'
  | 'mild'
  | 'moderate'
  | 'moderately_severe'
  | 'severe';

export interface ScoreBand {
  band: SeverityBand;
  min: number;
  max: number;
}

export interface InstrumentThresholds {
  /** Total number of scored items. */
  itemCount: number;
  /** Highest score a single item can receive. */
  maxItemScore: number;
  bands: ScoreBand[];
  /**
   * Zero-based indices of items whose non-zero answer should be capable of
   * raising the Safety Mode architecture (e.g. the PHQ-9 self-harm item).
   */
  safetyItemIndices: number[];
  /**
   * The minimum item response on a safety item that raises the safety flag.
   * PHQ-9 item 9 uses 0–3; any non-zero response is considered noteworthy.
   */
  safetyItemMinResponse: number;
}

export const PHQ9_THRESHOLDS: InstrumentThresholds = {
  itemCount: 9,
  maxItemScore: 3,
  bands: [
    { band: 'minimal', min: 0, max: 4 },
    { band: 'mild', min: 5, max: 9 },
    { band: 'moderate', min: 10, max: 14 },
    { band: 'moderately_severe', min: 15, max: 19 },
    { band: 'severe', min: 20, max: 27 },
  ],
  safetyItemIndices: [8],
  safetyItemMinResponse: 1,
};

export const GAD7_THRESHOLDS: InstrumentThresholds = {
  itemCount: 7,
  maxItemScore: 3,
  bands: [
    { band: 'minimal', min: 0, max: 4 },
    { band: 'mild', min: 5, max: 9 },
    { band: 'moderate', min: 10, max: 14 },
    { band: 'severe', min: 15, max: 21 },
  ],
  safetyItemIndices: [],
  safetyItemMinResponse: 1,
};

/**
 * Score at or above which the dashboard gently suggests the member consider
 * talking to a human professional (not a diagnosis, not a referral).
 */
export const SUGGEST_HUMAN_SUPPORT_AT: Record<'phq9' | 'gad7', number> = {
  phq9: 15,
  gad7: 15,
};
