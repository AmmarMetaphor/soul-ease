import type { SeverityBand } from '@/config/thresholds';

export type InstrumentId = 'phq9' | 'gad7';
export type AssessmentLocale = 'en' | 'ur';

/**
 * A localised version of a screening instrument.
 *
 * Validated translations are a legal and clinical matter, so a locale entry
 * may legitimately be `awaiting_validated_translation` with no items. The UI
 * must handle that state instead of falling back to machine translation.
 */
export type InstrumentLocaleContent =
  | {
      instrument: InstrumentId;
      locale: AssessmentLocale;
      status: 'available';
      title: string;
      /** The time-frame stem shown above the items, e.g. "Over the last 2 weeks…". */
      stem: string;
      items: string[];
      /** Exactly four response labels, indexed 0–3. */
      responseOptions: [string, string, string, string];
      /** Attribution and use terms for the wording used. */
      source: {
        attribution: string;
        useTerms: string;
        /** Set by the product owner once the use terms have been checked. */
        useTermsVerified: boolean;
      };
    }
  | {
      instrument: InstrumentId;
      locale: AssessmentLocale;
      status: 'awaiting_validated_translation';
      /** Where the validated wording is expected to come from. */
      note: string;
    };

export interface AssessmentScore {
  instrument: InstrumentId;
  total: number;
  maxTotal: number;
  band: SeverityBand;
  /** True when a safety-related item received a noteworthy response. */
  flaggedSafetyItem: boolean;
  /**
   * The highest response given on any safety item, or null if none flagged.
   * Used by the safety state machine to decide how strongly to respond.
   */
  safetyItemResponse: number | null;
  complete: boolean;
}
