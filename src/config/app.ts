import { env } from './env';

/**
 * Product-level constants. Anything a product owner might reasonably tune
 * belongs here rather than inline in a component.
 */
export const APP_NAME = 'Soul Ease';
export const APP_TAGLINE = 'Your AI-Guided Mental Wellbeing Companion';
export const APP_SUPPORTING_LINE = 'A private space to talk, reflect and find your next step.';

export const GUIDE_NAME = 'Noor';
export const GUIDE_DESIGNATION = 'Soul Ease AI Wellbeing Guide';

/** Minimum age for Soul Ease V1. Under-age users cannot enter the session experience. */
export const MINIMUM_AGE = 18;

/** Free sessions before the upgrade placeholder appears. Configurable via env. */
export const FREE_SESSION_ALLOWANCE = env.freeSessionAllowance;

/**
 * Bump when the wording of the consent screen changes materially, so we can
 * tell which version a member accepted.
 */
export const CONSENT_VERSION = '2026-09-phase1';

/** Sessions shorter than this are not counted against the free allowance. */
export const MIN_BILLABLE_SESSION_SECONDS = 60;

/** Soft guidance for the demo voice engine — keep spoken turns short. */
export const MAX_SPOKEN_TURN_WORDS = 70;

export const ROUTES = {
  home: '/',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  privacy: '/privacy',
  safety: '/safety',
  onboarding: '/onboarding',
  assessment: '/app/assessment',
  dashboard: '/app',
  session: '/app/session',
  sessionSummary: (id: string) => `/app/session/${id}/summary`,
  sessions: '/app/sessions',
  sessionDetail: (id: string) => `/app/sessions/${id}`,
  journal: '/app/journal',
  goals: '/app/goals',
  toolkit: '/app/toolkit',
  humanSupport: '/app/human-support',
  settings: '/app/settings',
  memory: '/app/settings/memory',
  deleteAccount: '/app/settings/delete-account',
} as const;
