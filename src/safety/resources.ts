/**
 * Verified support resources.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  DEVELOPER WARNING                                                       │
 * │                                                                          │
 * │  Soul Ease must NOT be deployed to production while any resource below   │
 * │  has `verified: false`. Do not invent phone numbers, crisis lines,       │
 * │  clinics or practitioners. Enter details only after they have been       │
 * │  checked against an authoritative source, with the date of checking.     │
 * │                                                                          │
 * │  `RESOURCES_VERIFIED_FOR_PRODUCTION` drives an in-app warning banner.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export interface SupportResource {
  id: string;
  /** Short, plain name — no marketing. */
  name: string;
  description: string;
  region: 'PK' | 'GLOBAL';
  /** E.164 or local dialling string. Leave undefined until verified. */
  phone?: string;
  url?: string;
  availability?: string;
  languages?: string[];
  verified: boolean;
  /** ISO date the details were last checked against the source. */
  verifiedOn?: string;
  verificationNote?: string;
}

export const SUPPORT_RESOURCES: SupportResource[] = [
  {
    id: 'pk-emergency-services',
    name: 'Local emergency services',
    description:
      'If you or someone near you is in immediate physical danger, contact your local emergency services or go to the nearest hospital emergency department.',
    region: 'PK',
    verified: false,
    verificationNote:
      'PLACEHOLDER — the verified national emergency number(s) for Pakistan must be entered and checked before production.',
  },
  {
    id: 'pk-crisis-line',
    name: 'Mental health crisis helpline (Pakistan)',
    description:
      'A verified Pakistani mental-health helpline will be listed here once its number, hours and languages have been confirmed.',
    region: 'PK',
    verified: false,
    verificationNote:
      'PLACEHOLDER — no helpline details have been entered. Do not publish until verified.',
  },
  {
    id: 'trusted-person',
    name: 'Someone you trust',
    description:
      'A family member, friend, neighbour or colleague who can be with you right now. You do not need to explain everything — “I am not okay and I do not want to be alone” is enough.',
    region: 'GLOBAL',
    verified: true,
    verifiedOn: '2026-09-03',
    verificationNote: 'General guidance; contains no contact details to verify.',
  },
];

/** True only when every listed resource has been verified. */
export const RESOURCES_VERIFIED_FOR_PRODUCTION = SUPPORT_RESOURCES.every((r) => r.verified);

export const UNVERIFIED_RESOURCE_COUNT = SUPPORT_RESOURCES.filter((r) => !r.verified).length;
