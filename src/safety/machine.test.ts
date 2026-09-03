import { describe, expect, it } from 'vitest';
import { detectsHumanSupportRequest, screenTextForSafety } from './detector';
import {
  initialStateForNewSession,
  isCoachingAllowed,
  isSafetyInterfaceActive,
  maxSafetyState,
  transitionSafetyState,
} from './machine';

describe('transitionSafetyState — escalation', () => {
  it('moves NORMAL → ELEVATED_SUPPORT on a concern signal', () => {
    const t = transitionSafetyState('NORMAL', { type: 'conversation_signal', level: 'concern' });
    expect(t.to).toBe('ELEVATED_SUPPORT');
    expect(t.changed).toBe(true);
    expect(t.source).toBe('conversation');
  });

  it('moves straight to SAFETY_MODE on immediate risk from any lower state', () => {
    expect(transitionSafetyState('NORMAL', { type: 'conversation_signal', level: 'immediate_risk' }).to).toBe('SAFETY_MODE');
    expect(transitionSafetyState('ELEVATED_SUPPORT', { type: 'conversation_signal', level: 'immediate_risk' }).to).toBe('SAFETY_MODE');
  });

  it('a concern signal never lowers a higher state', () => {
    const t = transitionSafetyState('SAFETY_MODE', { type: 'conversation_signal', level: 'concern' });
    expect(t.to).toBe('SAFETY_MODE');
    expect(t.changed).toBe(false);
  });

  it('a request for a human always leads to HUMAN_HANDOFF', () => {
    expect(transitionSafetyState('NORMAL', { type: 'user_requests_human' }).to).toBe('HUMAN_HANDOFF');
    expect(transitionSafetyState('SAFETY_MODE', { type: 'user_requests_human' }).to).toBe('HUMAN_HANDOFF');
  });
});

describe('transitionSafetyState — assessment items', () => {
  it('a response of 1 on PHQ-9 item 9 raises ELEVATED_SUPPORT', () => {
    const t = transitionSafetyState('NORMAL', { type: 'assessment_item', instrument: 'phq9', itemIndex: 8, response: 1 });
    expect(t.to).toBe('ELEVATED_SUPPORT');
    expect(t.source).toBe('assessment_item');
  });

  it('a response of 2 or 3 on PHQ-9 item 9 raises SAFETY_MODE', () => {
    expect(transitionSafetyState('NORMAL', { type: 'assessment_item', instrument: 'phq9', itemIndex: 8, response: 2 }).to).toBe('SAFETY_MODE');
    expect(transitionSafetyState('NORMAL', { type: 'assessment_item', instrument: 'phq9', itemIndex: 8, response: 3 }).to).toBe('SAFETY_MODE');
  });

  it('ignores non-safety items and zero responses', () => {
    expect(transitionSafetyState('NORMAL', { type: 'assessment_item', instrument: 'phq9', itemIndex: 0, response: 3 }).changed).toBe(false);
    expect(transitionSafetyState('NORMAL', { type: 'assessment_item', instrument: 'phq9', itemIndex: 8, response: 0 }).changed).toBe(false);
    expect(transitionSafetyState('NORMAL', { type: 'assessment_item', instrument: 'gad7', itemIndex: 0, response: 3 }).changed).toBe(false);
  });
});

describe('transitionSafetyState — de-escalation is gradual', () => {
  it('SAFETY_MODE never drops straight to NORMAL', () => {
    const t = transitionSafetyState('SAFETY_MODE', { type: 'user_reports_not_in_danger' });
    expect(t.to).toBe('ELEVATED_SUPPORT');
    expect(transitionSafetyState('SAFETY_MODE', { type: 'stabilised' }).to).toBe('SAFETY_MODE');
  });

  it('ELEVATED_SUPPORT relaxes to NORMAL only when stabilised', () => {
    expect(transitionSafetyState('ELEVATED_SUPPORT', { type: 'stabilised' }).to).toBe('NORMAL');
    expect(transitionSafetyState('ELEVATED_SUPPORT', { type: 'user_reports_not_in_danger' }).changed).toBe(false);
  });

  it('HUMAN_HANDOFF is sticky until acknowledged', () => {
    expect(transitionSafetyState('HUMAN_HANDOFF', { type: 'user_reports_not_in_danger' }).to).toBe('HUMAN_HANDOFF');
    expect(transitionSafetyState('HUMAN_HANDOFF', { type: 'stabilised' }).to).toBe('HUMAN_HANDOFF');
    expect(transitionSafetyState('HUMAN_HANDOFF', { type: 'handoff_acknowledged' }).to).toBe('ELEVATED_SUPPORT');
  });
});

describe('derived rules', () => {
  it('coaching is paused in SAFETY_MODE and HUMAN_HANDOFF', () => {
    expect(isCoachingAllowed('NORMAL')).toBe(true);
    expect(isCoachingAllowed('ELEVATED_SUPPORT')).toBe(true);
    expect(isCoachingAllowed('SAFETY_MODE')).toBe(false);
    expect(isCoachingAllowed('HUMAN_HANDOFF')).toBe(false);
  });

  it('the simplified interface shows only in the two highest states', () => {
    expect(isSafetyInterfaceActive('ELEVATED_SUPPORT')).toBe(false);
    expect(isSafetyInterfaceActive('SAFETY_MODE')).toBe(true);
  });

  it('tracks the maximum state reached', () => {
    expect(maxSafetyState('NORMAL', 'SAFETY_MODE')).toBe('SAFETY_MODE');
    expect(maxSafetyState('HUMAN_HANDOFF', 'ELEVATED_SUPPORT')).toBe('HUMAN_HANDOFF');
  });

  it('a new session opens gently after a difficult previous one', () => {
    expect(initialStateForNewSession(null)).toBe('NORMAL');
    expect(initialStateForNewSession('NORMAL')).toBe('NORMAL');
    expect(initialStateForNewSession('SAFETY_MODE')).toBe('ELEVATED_SUPPORT');
    expect(initialStateForNewSession('HUMAN_HANDOFF')).toBe('ELEVATED_SUPPORT');
  });
});

describe('screenTextForSafety (Phase 1 heuristic)', () => {
  it('detects immediate-risk language in English, Roman Urdu and Urdu script', () => {
    expect(screenTextForSafety('I want to end my life')).toBe('immediate_risk');
    expect(screenTextForSafety("i don't want to live anymore")).toBe('immediate_risk');
    expect(screenTextForSafety('mujhe lagta hai zindagi khatam kar doon')).toBe('immediate_risk');
    expect(screenTextForSafety('میں خودکشی کے بارے میں سوچ رہا ہوں')).toBe('immediate_risk');
  });

  it('detects concern-level distress', () => {
    expect(screenTextForSafety('everything feels hopeless lately')).toBe('concern');
    expect(screenTextForSafety('ab bardasht nahi hota')).toBe('concern');
  });

  it('leaves ordinary conversation alone', () => {
    expect(screenTextForSafety('work has been stressful and I cannot sleep')).toBe('none');
    expect(screenTextForSafety('mera dimagh bohat overthink kar raha hai')).toBe('none');
    expect(screenTextForSafety('')).toBe('none');
  });

  it('recognises an explicit request for a human', () => {
    expect(detectsHumanSupportRequest('can I talk to a real person please')).toBe(true);
    expect(detectsHumanSupportRequest('kisi insaan se baat karni hai')).toBe(true);
    expect(detectsHumanSupportRequest('tell me about grounding')).toBe(false);
  });
});
