/**
 * Safety Mode is a first-class application state, not a line in a prompt.
 *
 * NORMAL            — ordinary wellbeing conversation.
 * ELEVATED_SUPPORT  — something warrants extra care; coaching continues but
 *                     Noor slows down, checks in, and resources are one tap away.
 * SAFETY_MODE       — an immediate serious safety concern; normal coaching
 *                     stops, the interface simplifies, resources are shown.
 * HUMAN_HANDOFF     — the member has asked for, or been offered and accepted,
 *                     human support; Noor steps back.
 */
export type SafetyState = 'NORMAL' | 'ELEVATED_SUPPORT' | 'SAFETY_MODE' | 'HUMAN_HANDOFF';

export const SAFETY_STATE_RANK: Record<SafetyState, number> = {
  NORMAL: 0,
  ELEVATED_SUPPORT: 1,
  SAFETY_MODE: 2,
  HUMAN_HANDOFF: 3,
};

export type SafetyTrigger =
  /** A screening item flagged as safety-relevant received a noteworthy response. */
  | { type: 'assessment_item'; instrument: 'phq9' | 'gad7'; itemIndex: number; response: number }
  /** A conversation turn was screened and produced a signal. */
  | { type: 'conversation_signal'; level: 'concern' | 'immediate_risk' }
  /** The member explicitly asked to speak with a human. */
  | { type: 'user_requests_human' }
  /** The member has indicated they are not in immediate danger right now. */
  | { type: 'user_reports_not_in_danger' }
  /** Several calm turns have passed; elevated support can relax. */
  | { type: 'stabilised' }
  /** Human handoff has been acknowledged/arranged. */
  | { type: 'handoff_acknowledged' };

export type SafetyTriggerSource = 'assessment_item' | 'conversation' | 'user_request' | 'system';

export interface SafetyTransition {
  from: SafetyState;
  to: SafetyState;
  changed: boolean;
  source: SafetyTriggerSource;
}
