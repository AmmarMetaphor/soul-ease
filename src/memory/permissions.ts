/**
 * Memory & transcript permissions.
 *
 * Soul Ease separates three things a member can consent to independently:
 *  - core use of the service (required to proceed)
 *  - storing conversation transcripts
 *  - keeping long-term memory between sessions
 *
 * Raw audio is never stored by default and there is no consent flag for it in
 * Phase 1 — the architecture would require an explicit new consent type.
 */

export type ConsentType =
  | 'core_terms_and_ai_disclosure'
  | 'transcript_storage'
  | 'long_term_memory'
  | 'assessment_storage';

export interface ConsentState {
  core: boolean;
  transcriptStorage: boolean;
  longTermMemory: boolean;
  assessmentStorage: boolean;
}

export const DEFAULT_CONSENT_STATE: ConsentState = {
  core: false,
  transcriptStorage: false,
  longTermMemory: false,
  assessmentStorage: false,
};

export function canProceedToSessions(consent: ConsentState): boolean {
  return consent.core;
}

/** Whether individual conversation turns may be written to durable storage. */
export function canPersistTranscript(consent: ConsentState): boolean {
  return consent.core && consent.transcriptStorage;
}

/** Whether proposed memory items may be saved for future sessions. */
export function canPersistLongTermMemory(consent: ConsentState): boolean {
  return consent.core && consent.longTermMemory;
}

/** Whether screening scores may be stored against the account. */
export function canPersistAssessment(consent: ConsentState): boolean {
  return consent.core && consent.assessmentStorage;
}

/**
 * A session summary is always shown to the member at the end of a session,
 * but it is only stored if either transcripts or memory are permitted —
 * otherwise nothing about the conversation content survives the session.
 */
export function canPersistSessionSummary(consent: ConsentState): boolean {
  return consent.core && (consent.transcriptStorage || consent.longTermMemory);
}

export function consentStateFromRecords(
  records: Array<{ consentType: ConsentType; granted: boolean }>,
): ConsentState {
  const state: ConsentState = { ...DEFAULT_CONSENT_STATE };
  for (const record of records) {
    switch (record.consentType) {
      case 'core_terms_and_ai_disclosure':
        state.core = record.granted;
        break;
      case 'transcript_storage':
        state.transcriptStorage = record.granted;
        break;
      case 'long_term_memory':
        state.longTermMemory = record.granted;
        break;
      case 'assessment_storage':
        state.assessmentStorage = record.granted;
        break;
    }
  }
  return state;
}
