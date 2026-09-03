import { describe, expect, it } from 'vitest';
import { detectLanguage } from './languageDetection';
import { detectTopic } from '@/session/topicTags';
import { createDemoState, respond } from './noorDemoScript';

describe('detectLanguage', () => {
  it('recognises Urdu script', () => {
    expect(detectLanguage('میں بہت پریشان ہوں')).toBe('ur');
  });
  it('recognises Roman Urdu', () => {
    expect(detectLanguage('mujhe samajh nahi aa raha main kya karoon')).toBe('ur-roman');
  });
  it('recognises natural code-switching as mixed', () => {
    expect(detectLanguage('Honestly mera dimagh bohat overthink kar raha hai aur mujhe samajh nahi aa raha ke main kya karoon')).toBe('mixed');
  });
  it('recognises English', () => {
    expect(detectLanguage('I have been feeling anxious before every meeting this week')).toBe('en');
  });
});

describe('demo Noor engine', () => {
  it('detects topics across languages', () => {
    expect(detectTopic('I keep overthinking everything')).toBe('overthinking');
    expect(detectTopic('meri ammi ka intaqal ho gaya')).toBe('grief');
    expect(detectTopic('office ka pressure bohat zyada hai')).toBe('stress');
  });

  it('mirrors the member\'s register and follows the framework without coaching in Safety Mode', () => {
    let state = createDemoState('en');
    const first = respond(state, 'mera dimagh bohat overthink kar raha hai', 'NORMAL');
    expect(first.state.topic).toBe('overthinking');
    expect(first.state.phase).toBe('clarifying');
    expect(first.text).toMatch(/soch|thought/i);
    state = first.state;

    const safety = respond(state, 'anything', 'SAFETY_MODE');
    expect(safety.text).toMatch(/safe|mehfooz|محفوظ/i);
    // Safety replies never advance the coaching framework.
    expect(safety.state.phase).toBe(state.phase);
  });

  it('answers honestly when asked whether it is human', () => {
    const reply = respond(createDemoState('en'), 'are you a real person?', 'NORMAL');
    expect(reply.text).toMatch(/AI/);
    expect(reply.text).not.toMatch(/licensed|therapist,/i);
  });
});
