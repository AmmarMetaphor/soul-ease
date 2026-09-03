import type { InstrumentLocaleContent } from '../types';

/**
 * GAD-7 — English wording.
 *
 * Source: Generalized Anxiety Disorder 7-item scale (GAD-7), developed by
 * Drs. Robert L. Spitzer, Kurt Kroenke, Janet B.W. Williams and colleagues,
 * with an educational grant from Pfizer Inc. Pfizer states that no permission
 * is required to reproduce, translate, display or distribute the screeners.
 *
 * The product owner should re-confirm these terms (and set
 * `useTermsVerified: true`) before a production release.
 */
export const gad7En: InstrumentLocaleContent = {
  instrument: 'gad7',
  locale: 'en',
  status: 'available',
  title: 'Worry check (GAD-7)',
  stem: 'Over the last 2 weeks, how often have you been bothered by the following problems?',
  items: [
    'Feeling nervous, anxious, or on edge',
    'Not being able to stop or control worrying',
    'Worrying too much about different things',
    'Trouble relaxing',
    'Being so restless that it is hard to sit still',
    'Becoming easily annoyed or irritable',
    'Feeling afraid, as if something awful might happen',
  ],
  responseOptions: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'],
  source: {
    attribution:
      'GAD-7 © Pfizer Inc. Developed by Drs. Robert L. Spitzer, Kurt Kroenke, Janet B.W. Williams and colleagues.',
    useTerms:
      'Pfizer states no permission is required to reproduce, translate, display or distribute the PHQ/GAD screeners.',
    useTermsVerified: false,
  },
};
