import { describe, expect, it } from 'vitest';
import { buildNoorRealtimeInstructions, EMPTY_SESSION_CONTEXT } from '@/noor/realtimeInstructions';
import { EVAL_FIXTURES, fixturesByCategory, fixturesByLanguage } from './fixtures';
import { countQuestions, engagesWith, gradeFixture, gradeReply, languageAcceptable } from './grade';
import type { EvalFixture } from './types';

/**
 * Two things are tested here, and neither is "Noor is good".
 *
 * 1. The fixture set is complete and well-formed — the coverage Stage 3
 *    promises actually exists.
 * 2. The grader discriminates. Hand-written good and bad replies are run
 *    through it, so a criterion that would pass anything is caught. A suite
 *    whose checks cannot fail is worse than no suite: it reports green.
 *
 * Nothing here calls a model. Whether Noor's real replies pass is a live
 * question, still pending — see docs/LIVE_REALTIME_ACCEPTANCE.md.
 */

describe('fixture coverage', () => {
  it('has at least 30 fixtures', () => {
    expect(EVAL_FIXTURES.length).toBeGreaterThanOrEqual(30);
  });

  it('covers at least ten scenarios in each of English, Urdu and mixed', () => {
    expect(fixturesByLanguage('en').length).toBeGreaterThanOrEqual(10);
    expect(fixturesByLanguage('ur').length).toBeGreaterThanOrEqual(10);
    expect(fixturesByLanguage('mixed').length).toBeGreaterThanOrEqual(10);
  });

  it('covers every topic Stage 3 names', () => {
    for (const category of [
      'work_stress',
      'interview_anxiety',
      'overthinking',
      'relationship_conflict',
      'breakup',
      'grief',
      'loneliness',
      'neutral_conversation',
      'good_mood',
      'sleep_stress',
      'family_conflict',
      'decision_uncertainty',
    ] as const) {
      expect(fixturesByCategory(category).length, `no fixture for ${category}`).toBeGreaterThan(0);
    }
  });

  it('covers every behavioural case Stage 3 names', () => {
    for (const category of [
      'multi_turn_continuity',
      'user_correction',
      'interruption_intent',
      'memory_recall',
      'deleted_memory',
      'no_memory_user',
      'unhelpful_coping_preference',
    ] as const) {
      expect(fixturesByCategory(category).length, `no fixture for ${category}`).toBeGreaterThan(0);
    }
  });

  it('gives every fixture a unique id, an intent and at least one turn', () => {
    const ids = new Set<string>();
    for (const fixture of EVAL_FIXTURES) {
      expect(ids.has(fixture.id), `duplicate id ${fixture.id}`).toBe(false);
      ids.add(fixture.id);
      expect(fixture.intent.length, `${fixture.id} has no intent`).toBeGreaterThan(10);
      expect(fixture.turns.length, `${fixture.id} has no turns`).toBeGreaterThan(0);
      for (const turn of fixture.turns) {
        expect(turn.member.trim().length, `${fixture.id} has an empty member turn`).toBeGreaterThan(0);
      }
    }
  });

  /**
   * A fixture whose only criteria are "must not" would pass a reply of "ok".
   * Every fixture needs at least one positive requirement somewhere, or a
   * documented reason not to.
   */
  it('gives every fixture something a reply must actually do', () => {
    const openingOnly = new Set([
      // These deliberately test only that nothing bad appears on a greeting.
      'deleted-memory-excluded',
      'no-memory-user',
      'follow-up-not-guilt',
      'memory-recall-goal',
      'unhelpful-coping-not-resuggested',
    ]);
    for (const fixture of EVAL_FIXTURES) {
      if (openingOnly.has(fixture.id)) continue;
      const hasPositive = fixture.turns.some(
        (t) => (t.expect.mustEngage?.length ?? 0) > 0 || t.expect.requiresQuestion,
      );
      expect(hasPositive, `${fixture.id} has no positive criterion`).toBe(true);
    }
  });

  it('never asserts an exact sentence — criteria are concepts, not wording', () => {
    for (const fixture of EVAL_FIXTURES) {
      for (const turn of fixture.turns) {
        for (const concept of [...(turn.expect.mustEngage ?? []), ...(turn.expect.mustNotMention ?? [])]) {
          expect(concept.anyOf.length, `${fixture.id}: ${concept.label} has no surface forms`).toBeGreaterThan(0);
          for (const form of concept.anyOf) {
            // A "concept" long enough to be a whole sentence is really an
            // exact-wording assertion wearing a disguise.
            expect(form.length, `${fixture.id}: "${form}" is too long to be a concept`).toBeLessThan(40);
          }
        }
      }
    }
  });
});

/* ─── The grader must be able to fail ─────────────────────────────────── */

describe('grader discriminates', () => {
  const interview = EVAL_FIXTURES.find((f) => f.id === 'en-interview-tomorrow')!;

  it('passes a reply that engages the specific detail', () => {
    const result = gradeReply(
      'Freezing in the interview itself, or the waiting beforehand? Tell me which part your mind keeps going to.',
      interview.turns[0].expect,
    );
    expect(result.failures, JSON.stringify(result.failures)).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it('fails a warm reply that ignores what they said', () => {
    const result = gradeReply(
      'I understand. That sounds difficult. Stress in general can be really hard to carry.',
      interview.turns[0].expect,
    );
    expect(result.passed).toBe(false);
    expect(result.failures.map((f) => f.kind)).toContain('missing_concept');
    expect(result.failures.map((f) => f.kind)).toContain('forbidden_concept');
  });

  it('fails a reply that diagnoses', () => {
    const result = gradeReply(
      'That interview sounds daunting, and freezing is a classic sign of an anxiety disorder.',
      interview.turns[0].expect,
    );
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.detail.includes('diagnosis'))).toBe(true);
  });

  it('fails an interrogation', () => {
    const result = gradeReply(
      'What is the interview for? Have you frozen before? What would help? Who else knows?',
      interview.turns[0].expect,
    );
    expect(result.passed).toBe(false);
    expect(result.failures.map((f) => f.kind)).toContain('too_many_questions');
  });

  it('fails an empty reply rather than passing it vacuously', () => {
    expect(gradeReply('   ', interview.turns[0].expect).passed).toBe(false);
    expect(gradeReply('', {}).failures.map((f) => f.kind)).toEqual(['empty']);
  });

  it('counts Urdu question marks as questions', () => {
    expect(countQuestions('آپ کو کیسا لگ رہا ہے؟')).toBe(1);
    expect(countQuestions('Ye kab hua? Aur phir?')).toBe(2);
  });

  it('matches concepts on word boundaries, not substrings', () => {
    const manager = { label: 'the manager', anyOf: ['boss'] };
    expect(engagesWith('your boss messaging late', manager)).toBe(true);
    // "bossy" must not satisfy "boss" — that is how a grader passes nonsense.
    expect(engagesWith('that sounds bossy', manager)).toBe(false);
  });

  it('matches forms that begin or end with a non-word character', () => {
    const late = { label: 'the late hour', anyOf: ['10 pm', 'after ten'] };
    expect(engagesWith('messages at 10 pm', late)).toBe(true);
    expect(engagesWith('after ten at night', late)).toBe(true);
  });
});

describe('language register checks', () => {
  it('rejects an English reply to an Urdu turn', () => {
    const urdu = EVAL_FIXTURES.find((f) => f.id === 'ur-sleep')!;
    const result = gradeReply('Sleep can be really hard when your mind is busy. What time do you get to bed?', urdu.turns[0].expect);
    expect(result.passed).toBe(false);
    expect(result.failures.map((f) => f.kind)).toContain('wrong_language');
  });

  it('accepts Urdu script or Roman Urdu where the member used Urdu', () => {
    expect(languageAcceptable('ur', 'ur')).toBe(true);
    expect(languageAcceptable('ur', 'ur-roman')).toBe(true);
    expect(languageAcceptable('ur', 'mixed')).toBe(true);
    expect(languageAcceptable('ur', 'en')).toBe(false);
  });

  it('does not accept a mixed reply where the member stayed in English', () => {
    expect(languageAcceptable('en', 'mixed')).toBe(false);
    expect(languageAcceptable('en', 'en')).toBe(true);
  });
});

/* ─── Multi-turn grading ──────────────────────────────────────────────── */

describe('multi-turn fixtures', () => {
  const continuity = EVAL_FIXTURES.find((f) => f.id === 'continuity-four-turn-work')!;

  it('passes a run that accumulates context by the fourth turn', () => {
    const result = gradeFixture(continuity, {
      fixtureId: continuity.id,
      replies: [
        'Work. Say more about which part of it.',
        'Your manager specifically — what does he do that lands hardest?',
        'After ten at night, from your manager, most nights. That is your evening gone.',
        'So the late messages from your manager follow you to bed and your mind stays switched on.',
      ],
    });
    expect(result.perTurn.flatMap((t) => t.result.failures), JSON.stringify(result.perTurn.flatMap((t) => t.result.failures))).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it('fails a run that restarts the subject on the fourth turn', () => {
    const result = gradeFixture(continuity, {
      fixtureId: continuity.id,
      replies: [
        'Work. Say more about which part of it.',
        'Your manager specifically — what does he do that lands hardest?',
        'After ten at night, from your manager, most nights.',
        'Tell me about your work — what do you do day to day?',
      ],
    });
    expect(result.passed).toBe(false);
    expect(result.perTurn[3].result.failures.map((f) => f.kind)).toContain('forbidden_concept');
  });

  it('fails a missing reply rather than skipping the turn', () => {
    const result = gradeFixture(continuity, { fixtureId: continuity.id, replies: [] });
    expect(result.passed).toBe(false);
    expect(result.perTurn.every((t) => t.result.failures.some((f) => f.kind === 'empty'))).toBe(true);
  });

  const sister = EVAL_FIXTURES.find((f) => f.id === 'continuity-sister-pronoun')!;

  it('fails asking who "she" is', () => {
    const result = gradeFixture(sister, {
      fixtureId: sister.id,
      replies: ['An argument with your sister on Friday.', 'Who is she, sorry?'],
    });
    expect(result.passed).toBe(false);
    expect(result.perTurn[1].result.failures.map((f) => f.kind)).toContain('forbidden_concept');
  });
});

/* ─── Context handling the fixtures depend on ─────────────────────────── */

describe('fixture context reaches the instruction block', () => {
  function contextFor(fixture: EvalFixture) {
    return {
      ...EMPTY_SESSION_CONTEXT,
      firstSession: fixture.context?.firstSession ?? true,
      displayName: fixture.context?.displayName ?? null,
      memoryLines: fixture.context?.memoryLines ?? [],
      goals: fixture.context?.goals ?? [],
      followUps: fixture.context?.followUps ?? [],
      helpfulTools: fixture.context?.helpfulTools ?? [],
      unhelpfulTools: fixture.context?.unhelpfulTools ?? [],
    };
  }

  it('includes approved memory and excludes deleted memory', () => {
    const fixture = EVAL_FIXTURES.find((f) => f.id === 'deleted-memory-excluded')!;
    const text = buildNoorRealtimeInstructions(contextFor(fixture));
    expect(text).toContain('Enjoys cooking at the weekend');
    // The deleted line is not part of the context, so it cannot be in the
    // prompt. This is the mechanism: deletion removes the row that the
    // context package is built from — there is no second cache to purge.
    for (const deleted of fixture.context?.deletedMemoryLines ?? []) {
      expect(text).not.toContain(deleted);
    }
  });

  it('tells Noor she remembers nothing for a first-session fixture', () => {
    const fixture = EVAL_FIXTURES.find((f) => f.id === 'no-memory-user')!;
    const text = buildNoorRealtimeInstructions(contextFor(fixture));
    expect(text).toMatch(/first conversation with this member/);
    expect(text).toMatch(/Do not imply otherwise or invent history/);
  });

  it('carries the rejected coping approach into the prompt', () => {
    const fixture = EVAL_FIXTURES.find((f) => f.id === 'unhelpful-coping-not-resuggested')!;
    const text = buildNoorRealtimeInstructions(contextFor(fixture));
    expect(text).toContain('box breathing');
    expect(text).toMatch(/Do not suggest them again/);
  });

  it('carries the follow-up without obligation language', () => {
    const fixture = EVAL_FIXTURES.find((f) => f.id === 'follow-up-not-guilt')!;
    const text = buildNoorRealtimeInstructions(contextFor(fixture));
    expect(text).toContain('how the conversation with their partner went');
    expect(text).toMatch(/never treat it as an obligation they owe you/);
  });
});
