import { FREE_SESSION_ALLOWANCE } from '@/config/app';

export type PlanTier = 'free' | 'supporter';

export interface EntitlementSnapshot {
  plan: PlanTier;
  freeSessionAllowance: number;
  sessionsUsed: number;
}

export interface EntitlementDecision {
  /** Whether a new wellbeing session may be started. */
  canStartSession: boolean;
  remaining: number;
  /** True when the member has used every free session and has no paid plan. */
  allowanceExhausted: boolean;
  /**
   * Safety Mode and emergency resources are NEVER gated by entitlement.
   * This is always true and exists to make that rule explicit at call sites.
   */
  canAccessSafetyResources: true;
}

export function evaluateEntitlement(snapshot: EntitlementSnapshot): EntitlementDecision {
  if (snapshot.plan !== 'free') {
    return {
      canStartSession: true,
      remaining: Number.POSITIVE_INFINITY,
      allowanceExhausted: false,
      canAccessSafetyResources: true,
    };
  }
  const remaining = Math.max(0, snapshot.freeSessionAllowance - snapshot.sessionsUsed);
  return {
    canStartSession: remaining > 0,
    remaining,
    allowanceExhausted: remaining === 0,
    canAccessSafetyResources: true,
  };
}

export function defaultEntitlement(): EntitlementSnapshot {
  return { plan: 'free', freeSessionAllowance: FREE_SESSION_ALLOWANCE, sessionsUsed: 0 };
}

/**
 * Decide whether an ended session should consume one unit of the allowance.
 * Very short sessions (e.g. a member opened and immediately closed) are not
 * counted so nobody loses a free session to a mis-tap.
 */
export function shouldConsumeAllowance(durationSeconds: number, minimumSeconds: number): boolean {
  return durationSeconds >= minimumSeconds;
}
