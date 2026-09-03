import type { InstrumentLocaleContent } from '../types';

/**
 * PHQ-9 — English wording.
 *
 * Source: Patient Health Questionnaire (PHQ-9), developed by Drs. Robert L.
 * Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an
 * educational grant from Pfizer Inc. Pfizer states that no permission is
 * required to reproduce, translate, display or distribute the PHQ screeners.
 *
 * The product owner should re-confirm these terms (and set
 * `useTermsVerified: true`) before a production release.
 */
export const phq9En: InstrumentLocaleContent = {
  instrument: 'phq9',
  locale: 'en',
  status: 'available',
  title: 'Mood check (PHQ-9)',
  stem: 'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
  items: [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed, or hopeless',
    'Trouble falling or staying asleep, or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading the newspaper or watching television',
    'Moving or speaking so slowly that other people could have noticed. Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
    'Thoughts that you would be better off dead, or of hurting yourself',
  ],
  responseOptions: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'],
  source: {
    attribution:
      'PHQ-9 © Pfizer Inc. Developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues.',
    useTerms:
      'Pfizer states no permission is required to reproduce, translate, display or distribute the PHQ screeners.',
    useTermsVerified: false,
  },
};
