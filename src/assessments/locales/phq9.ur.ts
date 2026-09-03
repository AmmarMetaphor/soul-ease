import type { InstrumentLocaleContent } from '../types';

/**
 * PHQ-9 — Urdu.
 *
 * INTENTIONALLY EMPTY. A validated Urdu translation of the PHQ-9 exists in the
 * published literature, but it must be sourced and inserted verbatim by the
 * product team. Soul Ease must never machine-translate or paraphrase a
 * validated clinical questionnaire.
 *
 * To activate: replace this object with a `status: 'available'` entry that
 * mirrors phq9.en.ts, citing the validated source in `source.attribution`.
 */
export const phq9Ur: InstrumentLocaleContent = {
  instrument: 'phq9',
  locale: 'ur',
  status: 'awaiting_validated_translation',
  note: 'Validated Urdu PHQ-9 wording has not been supplied to the repository yet. Insert the published validated translation verbatim; do not generate one.',
};
