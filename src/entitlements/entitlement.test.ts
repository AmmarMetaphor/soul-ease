import { describe, expect, it } from 'vitest';
import { evaluateEntitlement, shouldConsumeAllowance } from './entitlement';

describe('evaluateEntitlement', () => {
  it('allows sessions while free allowance remains', () => {
    const decision = evaluateEntitlement({ plan: 'free', freeSessionAllowance: 3, sessionsUsed: 0 });
    expect(decision.canStartSession).toBe(true);
    expect(decision.remaining).toBe(3);
    expect(decision.allowanceExhausted).toBe(false);
  });

  it('allows the third session and blocks the fourth', () => {
    expect(evaluateEntitlement({ plan: 'free', freeSessionAllowance: 3, sessionsUsed: 2 }).canStartSession).toBe(true);
    const exhausted = evaluateEntitlement({ plan: 'free', freeSessionAllowance: 3, sessionsUsed: 3 });
    expect(exhausted.canStartSession).toBe(false);
    expect(exhausted.remaining).toBe(0);
    expect(exhausted.allowanceExhausted).toBe(true);
  });

  it('never reports negative remaining sessions', () => {
    expect(evaluateEntitlement({ plan: 'free', freeSessionAllowance: 3, sessionsUsed: 10 }).remaining).toBe(0);
  });

  it('respects a configurable allowance', () => {
    expect(evaluateEntitlement({ plan: 'free', freeSessionAllowance: 5, sessionsUsed: 4 }).canStartSession).toBe(true);
    expect(evaluateEntitlement({ plan: 'free', freeSessionAllowance: 1, sessionsUsed: 1 }).canStartSession).toBe(false);
  });

  it('paid plans are never blocked', () => {
    const decision = evaluateEntitlement({ plan: 'supporter', freeSessionAllowance: 3, sessionsUsed: 99 });
    expect(decision.canStartSession).toBe(true);
    expect(decision.allowanceExhausted).toBe(false);
  });

  it('safety resources are always accessible, even when exhausted', () => {
    const exhausted = evaluateEntitlement({ plan: 'free', freeSessionAllowance: 3, sessionsUsed: 3 });
    expect(exhausted.canAccessSafetyResources).toBe(true);
  });
});

describe('shouldConsumeAllowance', () => {
  it('does not count very short sessions', () => {
    expect(shouldConsumeAllowance(10, 60)).toBe(false);
    expect(shouldConsumeAllowance(59, 60)).toBe(false);
  });
  it('counts sessions at or above the minimum', () => {
    expect(shouldConsumeAllowance(60, 60)).toBe(true);
    expect(shouldConsumeAllowance(900, 60)).toBe(true);
  });
});
