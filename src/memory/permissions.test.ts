import { describe, expect, it } from 'vitest';
import { generateMemoryCandidates } from './candidates';
import {
  canPersistAssessment,
  canPersistLongTermMemory,
  canPersistSessionSummary,
  canPersistTranscript,
  canProceedToSessions,
  consentStateFromRecords,
  DEFAULT_CONSENT_STATE,
} from './permissions';

describe('memory & transcript permissions', () => {
  const all = { core: true, transcriptStorage: true, longTermMemory: true, assessmentStorage: true };

  it('nothing is permitted without core consent', () => {
    const noCore = { ...all, core: false };
    expect(canProceedToSessions(noCore)).toBe(false);
    expect(canPersistTranscript(noCore)).toBe(false);
    expect(canPersistLongTermMemory(noCore)).toBe(false);
    expect(canPersistAssessment(noCore)).toBe(false);
    expect(canPersistSessionSummary(noCore)).toBe(false);
  });

  it('transcript and memory consent are independent', () => {
    const transcriptOnly = { ...all, longTermMemory: false };
    expect(canPersistTranscript(transcriptOnly)).toBe(true);
    expect(canPersistLongTermMemory(transcriptOnly)).toBe(false);

    const memoryOnly = { ...all, transcriptStorage: false };
    expect(canPersistTranscript(memoryOnly)).toBe(false);
    expect(canPersistLongTermMemory(memoryOnly)).toBe(true);
  });

  it('a summary is stored only if transcripts or memory are permitted', () => {
    expect(canPersistSessionSummary({ ...all, transcriptStorage: false, longTermMemory: false })).toBe(false);
    expect(canPersistSessionSummary({ ...all, transcriptStorage: false })).toBe(true);
    expect(canPersistSessionSummary({ ...all, longTermMemory: false })).toBe(true);
  });

  it('defaults deny everything', () => {
    expect(DEFAULT_CONSENT_STATE).toEqual({ core: false, transcriptStorage: false, longTermMemory: false, assessmentStorage: false });
  });
});

describe('consentStateFromRecords', () => {
  it('uses the most recent record for each consent type', () => {
    const state = consentStateFromRecords([
      { consentType: 'core_terms_and_ai_disclosure', granted: true },
      { consentType: 'long_term_memory', granted: true },
      { consentType: 'long_term_memory', granted: false }, // later revocation wins
      { consentType: 'transcript_storage', granted: true },
    ]);
    expect(state.core).toBe(true);
    expect(state.longTermMemory).toBe(false);
    expect(state.transcriptStorage).toBe(true);
    expect(state.assessmentStorage).toBe(false);
  });
});

describe('generateMemoryCandidates', () => {
  it('proposes — never saves — structured candidates from a session', () => {
    const candidates = generateMemoryCandidates({
      sessionId: 's1',
      topic: 'overthinking',
      agreedActions: ['Take a ten-minute walk after dinner'],
      userTurns: ['My boss keeps changing the deadline and I want to stop taking it home with me.'],
      recommendedExerciseSlug: 'thought-check',
    });
    const categories = candidates.map((c) => c.category);
    expect(categories).toContain('stressor');
    expect(categories).toContain('agreed_action');
    expect(categories).toContain('relationship');
    expect(categories).toContain('goal');
    expect(categories).toContain('coping_preference');
    expect(candidates.every((c) => c.sourceSessionId === 's1')).toBe(true);
    expect(candidates.every((c) => typeof c.candidateId === 'string' && c.candidateId.length > 0)).toBe(true);
  });

  it('returns nothing for an empty session', () => {
    expect(generateMemoryCandidates({ sessionId: 's2', topic: null, agreedActions: [], userTurns: [], recommendedExerciseSlug: null })).toEqual([]);
  });

  it('caps the number of candidates', () => {
    const many = generateMemoryCandidates({
      sessionId: 's3',
      topic: 'stress',
      agreedActions: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      userTurns: [],
      recommendedExerciseSlug: null,
    });
    expect(many.length).toBeLessThanOrEqual(6);
  });
});
