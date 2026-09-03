import { gad7En } from './locales/gad7.en';
import { gad7Ur } from './locales/gad7.ur';
import { phq9En } from './locales/phq9.en';
import { phq9Ur } from './locales/phq9.ur';
import type { AssessmentLocale, InstrumentId, InstrumentLocaleContent } from './types';

const REGISTRY: Record<InstrumentId, Record<AssessmentLocale, InstrumentLocaleContent>> = {
  phq9: { en: phq9En, ur: phq9Ur },
  gad7: { en: gad7En, ur: gad7Ur },
};

export const INSTRUMENT_ORDER: InstrumentId[] = ['phq9', 'gad7'];

export function getInstrumentContent(
  instrument: InstrumentId,
  locale: AssessmentLocale,
): InstrumentLocaleContent {
  return REGISTRY[instrument][locale];
}

/**
 * Resolve the content to display for a member's preferred locale. If the
 * validated translation is not available we fall back to English and tell the
 * caller so the UI can explain why.
 */
export function resolveInstrumentContent(
  instrument: InstrumentId,
  preferredLocale: AssessmentLocale,
): { content: Extract<InstrumentLocaleContent, { status: 'available' }>; fellBackToEnglish: boolean } {
  const preferred = REGISTRY[instrument][preferredLocale];
  if (preferred.status === 'available') {
    return { content: preferred, fellBackToEnglish: false };
  }
  const english = REGISTRY[instrument].en;
  if (english.status !== 'available') {
    throw new Error(`No available content for ${instrument}`);
  }
  return { content: english, fellBackToEnglish: preferredLocale !== 'en' };
}
