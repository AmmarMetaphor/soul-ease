import { detectLanguage } from '@/realtime/demo/languageDetection';
import type { Concept, EvalExpectation, EvalFixture } from './types';

/**
 * Grades one reply against one turn's expectations.
 *
 * A coarse instrument, deliberately. It answers "did this reply engage with
 * what the member said, and did it avoid the things that must never appear?"
 * — which is exactly the failure that made Noor sound pre-written. It cannot
 * judge warmth, timing or whether a question was the right one; those need a
 * person, and the live acceptance suite is where they are judged.
 *
 * Everything here is a *necessary* condition, never sufficient. A reply that
 * passes is not thereby good; a reply that fails is definitely wrong.
 */

export type FailureKind =
  | 'missing_concept'
  | 'forbidden_concept'
  | 'too_many_questions'
  | 'no_question'
  | 'too_long'
  | 'wrong_language'
  | 'empty';

export interface GradeFailure {
  kind: FailureKind;
  /** Human-readable, so a failing test says what went wrong. */
  detail: string;
}

export interface GradeResult {
  passed: boolean;
  failures: GradeFailure[];
}

/** Latin word-boundary match where possible; substring for other scripts. */
function mentions(reply: string, form: string): boolean {
  const haystack = reply.toLowerCase();
  const needle = form.toLowerCase();
  if (!/^[\x20-\x7e]+$/.test(needle)) return haystack.includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // \b fails against a leading/trailing non-word char (e.g. "10 pm"), so the
  // boundary is asserted only where the form itself starts/ends with a word
  // character.
  const left = /^\w/.test(needle) ? '\\b' : '';
  const right = /\w$/.test(needle) ? '\\b' : '';
  return new RegExp(`${left}${escaped}${right}`, 'i').test(haystack);
}

export function engagesWith(reply: string, concept: Concept): boolean {
  return concept.anyOf.some((form) => mentions(reply, form));
}

/** Question marks, Latin and Urdu (؟ U+061F). */
export function countQuestions(reply: string): number {
  return (reply.match(/[?؟]/g) ?? []).length;
}

export function countWords(reply: string): number {
  return reply.trim().split(/\s+/).filter(Boolean).length;
}

const DEFAULT_MAX_QUESTIONS = 1;
/** Generous: the spec asks for under 60, and a grader should not police style. */
const DEFAULT_MAX_WORDS = 90;

export function gradeReply(reply: string, expect: EvalExpectation): GradeResult {
  const failures: GradeFailure[] = [];

  if (!reply.trim()) {
    return { passed: false, failures: [{ kind: 'empty', detail: 'reply was empty' }] };
  }

  for (const concept of expect.mustEngage ?? []) {
    if (!engagesWith(reply, concept)) {
      failures.push({
        kind: 'missing_concept',
        detail: `did not engage with ${concept.label} (any of: ${concept.anyOf.join(', ')})`,
      });
    }
  }

  for (const concept of expect.mustNotMention ?? []) {
    const hit = concept.anyOf.find((form) => mentions(reply, form));
    if (hit) {
      failures.push({ kind: 'forbidden_concept', detail: `mentioned ${concept.label} ("${hit}")` });
    }
  }

  const questions = countQuestions(reply);
  const maxQuestions = expect.maxQuestions ?? DEFAULT_MAX_QUESTIONS;
  if (questions > maxQuestions) {
    failures.push({ kind: 'too_many_questions', detail: `asked ${questions} questions, limit ${maxQuestions}` });
  }
  if (expect.requiresQuestion && questions === 0) {
    failures.push({ kind: 'no_question', detail: 'expected one question, found none' });
  }

  const words = countWords(reply);
  const maxWords = expect.maxWords ?? DEFAULT_MAX_WORDS;
  if (words > maxWords) {
    failures.push({ kind: 'too_long', detail: `${words} words, limit ${maxWords}` });
  }

  if (expect.language) {
    const detected = detectLanguage(reply);
    if (!languageAcceptable(expect.language, detected)) {
      failures.push({ kind: 'wrong_language', detail: `expected ${expect.language} register, detected ${detected}` });
    }
  }

  return { passed: failures.length === 0, failures };
}

/**
 * Register matching is deliberately lenient in one direction.
 *
 * A member writing Roman Urdu may be answered in Roman Urdu or in Urdu
 * script — both mirror them. And a genuinely mixed reply is acceptable
 * wherever Urdu is, because that is how people actually speak here. What is
 * NOT acceptable is answering Urdu in plain English, or answering English in
 * Urdu, which is the failure this checks for.
 */
export function languageAcceptable(expected: 'en' | 'ur' | 'mixed', detected: string): boolean {
  if (expected === 'en') return detected === 'en';
  if (expected === 'ur') return detected === 'ur' || detected === 'ur-roman' || detected === 'mixed';
  return detected === 'mixed' || detected === 'ur-roman' || detected === 'ur';
}

export interface FixtureRun {
  fixtureId: string;
  /** One reply per turn, in order. */
  replies: string[];
}

export interface FixtureResult {
  fixtureId: string;
  passed: boolean;
  perTurn: Array<{ turn: number; member: string; reply: string; result: GradeResult }>;
}

/** Grade a whole fixture. Missing replies fail rather than being skipped. */
export function gradeFixture(fixture: EvalFixture, run: FixtureRun): FixtureResult {
  const perTurn = fixture.turns.map((turn, i) => {
    const reply = run.replies[i] ?? '';
    return { turn: i, member: turn.member, reply, result: gradeReply(reply, turn.expect) };
  });
  return { fixtureId: fixture.id, passed: perTurn.every((t) => t.result.passed), perTurn };
}

/** A one-line-per-failure report, for a live run's console output. */
export function formatFixtureResult(result: FixtureResult): string {
  if (result.passed) return `PASS  ${result.fixtureId}`;
  const lines = [`FAIL  ${result.fixtureId}`];
  for (const turn of result.perTurn) {
    for (const failure of turn.result.failures) {
      lines.push(`        turn ${turn.turn + 1}: [${failure.kind}] ${failure.detail}`);
    }
  }
  return lines.join('\n');
}
