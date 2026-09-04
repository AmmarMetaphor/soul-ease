import { describe, expect, it } from 'vitest';
import { buildAuditionInstructions, buildNoorRealtimeInstructions, safetyStateInstruction, type NoorSessionContext } from './realtimeInstructions';

function context(overrides: Partial<NoorSessionContext> = {}): NoorSessionContext {
  return {
    displayName: null,
    preferredLanguage: 'en',
    memoryLines: [],
    goals: [],
    recentActions: [],
    lastSessionGist: null,
    openGently: false,
    firstSession: true,
    ...overrides,
  };
}

describe('Noor realtime instructions', () => {
  it('establishes identity and refuses every clinical claim', () => {
    const text = buildNoorRealtimeInstructions(context());
    expect(text).toContain('Soul Ease AI Wellbeing Guide');
    expect(text).toContain('You are an AI');
    expect(text).toMatch(/NOT a therapist/);
    expect(text).toMatch(/no licence, registration or clinical qualification/);
    // The prohibited list must name the specific claims we must never make.
    expect(text).toContain('# Never say');
    expect(text).toMatch(/accredited/);
    expect(text).toMatch(/medication name, dose or change/);
  });

  it('covers every required behaviour section', () => {
    const text = buildNoorRealtimeInstructions(context());
    for (const heading of [
      '# Identity',
      '# Scope',
      '# Answering what they actually said — the first rule',
      '# How you speak',
      '# Shape of the conversation',
      '# Turn-taking',
      '# Language',
      '# Voice delivery',
      '# Approaches you may draw on',
      '# Memory',
      '# Safety',
      '# Human support',
      '# Never say',
      '# Opening',
    ]) {
      expect(text).toContain(heading);
    }
  });

  it('asks for short spoken turns and warns against stock empathy phrases', () => {
    const text = buildNoorRealtimeInstructions(context());
    expect(text).toMatch(/one to three natural sentences/i);
    expect(text).toMatch(/I understand/);
    expect(text).toMatch(/your feelings are valid/i);
    expect(text).toMatch(/Never deliver lists of strategies aloud/i);
  });

  it('tells Noor to mirror language and not to switch on a single loan word', () => {
    const text = buildNoorRealtimeInstructions(context());
    expect(text).toMatch(/Do NOT switch language just because one English word appears/);
    expect(text).toMatch(/Roman Urdu/);
    expect(text).toMatch(/Never use formal, literary or textbook Urdu/);
  });

  it('opens in the interface language it was given', () => {
    expect(buildNoorRealtimeInstructions(context({ preferredLanguage: 'ur' }))).toContain("interface language is Urdu");
    expect(buildNoorRealtimeInstructions(context({ preferredLanguage: 'en' }))).toContain('interface language is English');
  });

  it('forbids invented memory on a first session', () => {
    const text = buildNoorRealtimeInstructions(context({ firstSession: true }));
    expect(text).toMatch(/first conversation with this member/);
    expect(text).toMatch(/Do not imply otherwise or invent history/);
    expect(text).not.toMatch(/Last conversation, in one line/);
  });

  it('includes only the memory it was actually given on a return session', () => {
    const text = buildNoorRealtimeInstructions(
      context({
        firstSession: false,
        displayName: 'Ammar',
        lastSessionGist: 'Work had been leaving them mentally exhausted.',
        recentActions: ['Take a ten-minute walk after dinner'],
        goals: ['Walk three evenings this week'],
        memoryLines: ['Overthinking is a pattern they want to work on'],
      }),
    );
    expect(text).toContain('The member is called Ammar.');
    expect(text).toContain('Work had been leaving them mentally exhausted.');
    expect(text).toContain('Take a ten-minute walk after dinner');
    expect(text).toContain('Overthinking is a pattern they want to work on');
    expect(text).toMatch(/Never invent a memory/);
    expect(text).toMatch(/Never recite the list/);
  });

  it('says plainly when there is nothing remembered', () => {
    const text = buildNoorRealtimeInstructions(context({ firstSession: false }));
    expect(text).toMatch(/no saved details about this member/);
  });

  it('opens gently after a difficult session', () => {
    const text = buildNoorRealtimeInstructions(context({ openGently: true, firstSession: false }));
    expect(text).toMatch(/previous conversation reached a difficult place/);
    expect(text).toMatch(/Do not refer back to the difficult content unless they raise it/);
  });

  it('never asks for a spoken disclaimer at the start of a session', () => {
    const text = buildNoorRealtimeInstructions(context());
    expect(text).toMatch(/No welcome script, no product tour, no disclaimer/);
    expect(text).toMatch(/consent was handled during onboarding/i);
  });

  it('puts safety above the style rules and forbids invented resources', () => {
    const text = buildNoorRealtimeInstructions(context());
    expect(text).toMatch(/# Safety — this outranks every style rule above/);
    expect(text).toMatch(/Stop all coaching, exercises, reframing and goal-setting immediately/);
    expect(text).toMatch(/cannot keep them safe on your own/);
    expect(text).toMatch(/Do not read out phone numbers or invent any service/);
  });

  it('tells Noor not to restart an interrupted sentence', () => {
    const text = buildNoorRealtimeInstructions(context());
    expect(text).toMatch(/stop immediately and listen/);
    expect(text).toMatch(/Do not restart what you were saying from the beginning/);
    expect(text).toMatch(/Silence is not an invitation to speak/);
  });
});

/**
 * These are the prompt-side guards against the defect this work fixes: replies
 * that fit the subject rather than the person, and a session that opens with
 * the same sentence every time.
 */
describe('answering the member rather than the topic', () => {
  it('requires a concrete detail from what the member just said', () => {
    const text = buildNoorRealtimeInstructions(context());
    expect(text).toMatch(/built from this member's own words, not from the subject/);
    expect(text).toMatch(/Name something concrete they just told you/);
    expect(text).toMatch(/two different answers/);
    expect(text).toMatch(/about to say something you could have said before they spoke/);
  });

  it('requires the whole conversation to be carried forward, pronouns included', () => {
    const text = buildNoorRealtimeInstructions(context());
    expect(text).toMatch(/Hold the whole conversation/);
    expect(text).toMatch(/When they say "she" or "he" or "it"/);
    expect(text).toMatch(/do not ask them to reintroduce it/);
  });

  it('asks for one question at a time, not an interview', () => {
    const text = buildNoorRealtimeInstructions(context());
    expect(text).toMatch(/At most one question in a turn/);
    expect(text).toMatch(/Two consecutive turns should not do the same job/);
    expect(text).toMatch(/Do not interview the member/);
  });

  it('forbids stock openings rather than merely discouraging them', () => {
    const text = buildNoorRealtimeInstructions(context());
    expect(text).toMatch(/Do not open a turn with a stock acknowledgement/);
    expect(text).toMatch(/that sounds difficult/i);
    expect(text).toMatch(/it sounds like/i);
    expect(text).toMatch(/Do not reuse your own earlier phrasing/);
  });

  it('takes a member who says they are okay at their word', () => {
    const text = buildNoorRealtimeInstructions(context());
    expect(text).toMatch(/If they say they are fine, or just wanted company, they are/);
    expect(text).toMatch(/do not treat an ordinary day as a symptom/);
    expect(text).toMatch(/Treating an ordinary difficult day.*as a condition/s);
  });

  it('says so rather than covering a misheard turn with a generic question', () => {
    const text = buildNoorRealtimeInstructions(context());
    expect(text).toMatch(/If you genuinely did not understand them, say so plainly/);
    expect(text).toMatch(/Never cover a gap with a general question about stress or feelings/);
  });

  /**
   * A quoted sample line in a system prompt gets spoken verbatim. Three
   * sessions later the member has learned the greeting by heart, and Noor
   * sounds like a recording — so openings are described, never quoted.
   */
  it('contains no example dialogue for Noor to copy as a script', () => {
    for (const ctx of [
      context({ firstSession: true }),
      context({ firstSession: false }),
      context({ firstSession: false, openGently: true }),
    ]) {
      const text = buildNoorRealtimeInstructions(ctx);
      expect(text).not.toMatch(/Example register/i);
      expect(text).not.toMatch(/e\.g\. "/);
      // Nothing quoted that reads as a complete spoken sentence. Short
      // quoted fragments are fine and necessary — they are the phrases she
      // is told NOT to use — but a finished sentence in quotes is a line
      // waiting to be read aloud verbatim.
      const spokenLines = [...text.matchAll(/"[^"]{12,}[.?!]"/g)].map((m) => m[0]);
      expect(spokenLines).toEqual([]);
      expect(text).toMatch(/never reuse the same first sentence from one conversation to the next/);
    }
  });

  it('gives no fixed opening even when there is memory to open from', () => {
    const text = buildNoorRealtimeInstructions(
      context({ firstSession: false, lastSessionGist: 'Work had been leaving them exhausted.' }),
    );
    expect(text).toMatch(/Word this opening freshly/);
    expect(text).toMatch(/never imply you remember something you do not/);
  });
});

describe('safetyStateInstruction', () => {
  it('escalates coaching away in Safety Mode', () => {
    const text = safetyStateInstruction('SAFETY_MODE')!;
    expect(text).toContain('SAFETY MODE');
    expect(text).toMatch(/Stop all coaching/);
  });
  it('softens for elevated support', () => {
    expect(safetyStateInstruction('ELEVATED_SUPPORT')).toMatch(/Slow down/);
  });
  it('steps back for a human handoff', () => {
    expect(safetyStateInstruction('HUMAN_HANDOFF')).toMatch(/Step back/);
  });
  it('has nothing to add in the normal state', () => {
    expect(safetyStateInstruction('NORMAL')).toBeNull();
  });
});

describe('audition instructions', () => {
  it('asks only for the line, with the identity intact', () => {
    const text = buildAuditionInstructions();
    expect(text).toContain('Soul Ease AI Wellbeing Guide');
    expect(text).toMatch(/Read the line the developer sends you, exactly as written/);
    expect(text).toMatch(/do not ask a question afterwards/);
  });
});
