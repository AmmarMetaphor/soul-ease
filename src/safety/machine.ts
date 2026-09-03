import { thresholdsFor } from '@/assessments/scoring';
import {
  SAFETY_STATE_RANK,
  type SafetyState,
  type SafetyTransition,
  type SafetyTrigger,
  type SafetyTriggerSource,
} from './types';

/**
 * Response on a flagged screening item at or above which we move straight to
 * SAFETY_MODE rather than ELEVATED_SUPPORT. On the 0–3 PHQ scale, 2 means
 * "more than half the days".
 */
export const ASSESSMENT_SAFETY_MODE_RESPONSE = 2;

function sourceFor(trigger: SafetyTrigger): SafetyTriggerSource {
  switch (trigger.type) {
    case 'assessment_item':
      return 'assessment_item';
    case 'conversation_signal':
      return 'conversation';
    case 'user_requests_human':
    case 'user_reports_not_in_danger':
      return 'user_request';
    case 'stabilised':
    case 'handoff_acknowledged':
      return 'system';
  }
}

function escalate(from: SafetyState, to: SafetyState): SafetyState {
  return SAFETY_STATE_RANK[to] > SAFETY_STATE_RANK[from] ? to : from;
}

/**
 * Pure transition function. The rules encode the product's safety posture:
 *  - Escalation is always immediate.
 *  - De-escalation is gradual: SAFETY_MODE never drops straight to NORMAL.
 *  - HUMAN_HANDOFF is sticky until acknowledged.
 *  - A concern signal never lowers a higher state.
 */
export function transitionSafetyState(
  current: SafetyState,
  trigger: SafetyTrigger,
): SafetyTransition {
  const source = sourceFor(trigger);
  let next: SafetyState = current;

  switch (trigger.type) {
    case 'assessment_item': {
      const thresholds = thresholdsFor(trigger.instrument);
      const isSafetyItem = thresholds.safetyItemIndices.includes(trigger.itemIndex);
      if (isSafetyItem && trigger.response >= thresholds.safetyItemMinResponse) {
        const target: SafetyState =
          trigger.response >= ASSESSMENT_SAFETY_MODE_RESPONSE ? 'SAFETY_MODE' : 'ELEVATED_SUPPORT';
        next = escalate(current, target);
      }
      break;
    }
    case 'conversation_signal': {
      const target: SafetyState =
        trigger.level === 'immediate_risk' ? 'SAFETY_MODE' : 'ELEVATED_SUPPORT';
      next = escalate(current, target);
      break;
    }
    case 'user_requests_human':
      next = 'HUMAN_HANDOFF';
      break;
    case 'user_reports_not_in_danger':
      if (current === 'SAFETY_MODE') next = 'ELEVATED_SUPPORT';
      break;
    case 'stabilised':
      if (current === 'ELEVATED_SUPPORT') next = 'NORMAL';
      break;
    case 'handoff_acknowledged':
      if (current === 'HUMAN_HANDOFF') next = 'ELEVATED_SUPPORT';
      break;
  }

  return { from: current, to: next, changed: next !== current, source };
}

/** Normal coaching techniques (CBT, NLP, motivational work) are paused here. */
export function isCoachingAllowed(state: SafetyState): boolean {
  return state === 'NORMAL' || state === 'ELEVATED_SUPPORT';
}

/** Whether the simplified, calmer Safety Mode interface should be shown. */
export function isSafetyInterfaceActive(state: SafetyState): boolean {
  return state === 'SAFETY_MODE' || state === 'HUMAN_HANDOFF';
}

export function maxSafetyState(a: SafetyState, b: SafetyState): SafetyState {
  return SAFETY_STATE_RANK[a] >= SAFETY_STATE_RANK[b] ? a : b;
}

/**
 * Where a new session should start given how the last one ended. A session
 * that reached Safety Mode leaves the next one in ELEVATED_SUPPORT so Noor
 * opens more gently.
 */
export function initialStateForNewSession(previousMax: SafetyState | null): SafetyState {
  if (previousMax === 'SAFETY_MODE' || previousMax === 'HUMAN_HANDOFF') return 'ELEVATED_SUPPORT';
  return 'NORMAL';
}
