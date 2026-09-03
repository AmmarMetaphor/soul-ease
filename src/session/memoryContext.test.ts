import { describe, expect, it } from 'vitest';
import type { Goal, MemoryItem, Profile, SessionSummary, WellbeingSession } from '@/data/types';
import type { ConsentState } from '@/memory/permissions';
import { buildMemoryContext, MEMORY_LIMITS, transcriptionLanguages, type MemorySources } from './memoryContext';

const CONSENT_ALL: ConsentState = {
  core: true,
  transcriptStorage: true,
  longTermMemory: true,
  assessmentStorage: true,
};

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-1',
    displayName: 'Ammar',
    preferredLanguage: 'en',
    preferredMode: 'audio',
    ageConfirmedAt: '2026-01-01T00:00:00Z',
    onboardingCompletedAt: '2026-01-01T00:00:00Z',
    primaryConcerns: ['overthinking'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function memory(id: string, content: string): MemoryItem {
  return {
    id,
    userId: 'user-1',
    category: 'stressor',
    content,
    sourceSessionId: null,
    createdAt: '2026-01-01T00:00:00Z',
    lastReferencedAt: null,
  };
}

function goal(id: string, title: string, status: Goal['status'] = 'active'): Goal {
  return {
    id,
    userId: 'user-1',
    title,
    description: null,
    status,
    targetDate: null,
    sessionId: null,
    createdAt: '2026-01-01T00:00:00Z',
    completedAt: null,
  };
}

function session(overrides: Partial<WellbeingSession> = {}): WellbeingSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    mode: 'audio',
    status: 'ended',
    title: null,
    startedAt: '2026-01-01T00:00:00Z',
    endedAt: '2026-01-01T00:20:00Z',
    durationSeconds: 1200,
    topicTags: ['overthinking'],
    languageDetected: 'en',
    maxSafetyState: 'NORMAL',
    countedTowardsAllowance: true,
    ...overrides,
  };
}

function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: 'summary-1',
    sessionId: 'session-1',
    userId: 'user-1',
    whatWeTalkedAbout: 'You talked with Noor about the thoughts that keep circling.',
    mostImportant: 'Work has been leaving you mentally exhausted.',
    agreedActions: ['Take a ten-minute walk after dinner'],
    recommendedExerciseSlug: 'thought-check',
    goalBeforeNext: null,
    createdAt: '2026-01-01T00:20:00Z',
    ...overrides,
  };
}

function sources(overrides: Partial<MemorySources> = {}): MemorySources {
  return {
    profile: profile(),
    consent: CONSENT_ALL,
    memories: [],
    goals: [],
    lastEndedSession: null,
    lastSummary: null,
    endedSessionCount: 0,
    ...overrides,
  };
}

describe('buildMemoryContext', () => {
  it('carries the name, goals, agreed actions and a one-line gist', () => {
    const context = buildMemoryContext(
      sources({
        memories: [memory('m1', 'Work pressure is a recurring stressor')],
        goals: [goal('g1', 'Walk three evenings this week')],
        lastEndedSession: session(),
        lastSummary: summary(),
        endedSessionCount: 2,
      }),
    );
    expect(context.displayName).toBe('Ammar');
    expect(context.memoryLines).toEqual(['Work pressure is a recurring stressor']);
    expect(context.goals).toEqual(['Walk three evenings this week']);
    expect(context.recentActions).toEqual(['Take a ten-minute walk after dinner']);
    expect(context.lastSessionGist).toContain('thoughts that keep circling');
    expect(context.firstSession).toBe(false);
  });

  it('sends no memory lines when long-term memory consent is withheld', () => {
    const context = buildMemoryContext(
      sources({
        consent: { ...CONSENT_ALL, longTermMemory: false },
        memories: [memory('m1', 'Should not be sent')],
        endedSessionCount: 3,
      }),
    );
    expect(context.memoryLines).toEqual([]);
  });

  it('bounds the payload — transcripts are never replayed', () => {
    const many = Array.from({ length: 40 }, (_, i) => memory(`m${i}`, `Remembered item ${i}`));
    const manyGoals = Array.from({ length: 10 }, (_, i) => goal(`g${i}`, `Goal ${i}`));
    const context = buildMemoryContext(
      sources({
        memories: many,
        goals: manyGoals,
        lastSummary: summary({ agreedActions: ['a', 'b', 'c', 'd', 'e'] }),
        endedSessionCount: 9,
      }),
    );
    expect(context.memoryLines).toHaveLength(MEMORY_LIMITS.memoryLines);
    expect(context.goals).toHaveLength(MEMORY_LIMITS.goals);
    expect(context.recentActions).toHaveLength(MEMORY_LIMITS.recentActions);
  });

  it('truncates a long gist rather than sending a whole summary', () => {
    const context = buildMemoryContext(
      sources({
        lastSummary: summary({ whatWeTalkedAbout: 'x'.repeat(900) }),
        endedSessionCount: 1,
      }),
    );
    expect(context.lastSessionGist!.length).toBeLessThanOrEqual(MEMORY_LIMITS.gistChars);
    expect(context.lastSessionGist!.endsWith('…')).toBe(true);
  });

  it('only includes active goals', () => {
    const context = buildMemoryContext(
      sources({
        goals: [goal('g1', 'Done thing', 'completed'), goal('g2', 'Let go thing', 'let_go'), goal('g3', 'Live one')],
        endedSessionCount: 1,
      }),
    );
    expect(context.goals).toEqual(['Live one']);
  });

  it('marks a genuine first session so Noor cannot imply a history', () => {
    const context = buildMemoryContext(sources({ endedSessionCount: 0 }));
    expect(context.firstSession).toBe(true);
    expect(context.lastSessionGist).toBeNull();
    expect(context.recentActions).toEqual([]);
  });

  it('opens gently after a session that reached a safety state', () => {
    expect(
      buildMemoryContext(sources({ lastEndedSession: session({ maxSafetyState: 'SAFETY_MODE' }), endedSessionCount: 1 }))
        .openGently,
    ).toBe(true);
    expect(
      buildMemoryContext(sources({ lastEndedSession: session({ maxSafetyState: 'NORMAL' }), endedSessionCount: 1 }))
        .openGently,
    ).toBe(false);
  });

  it('degrades to an empty context when nothing is available', () => {
    const context = buildMemoryContext(sources({ profile: null }));
    expect(context.displayName).toBeNull();
    expect(context.preferredLanguage).toBe('en');
    expect(context.memoryLines).toEqual([]);
    expect(context.goals).toEqual([]);
  });
});

describe('transcriptionLanguages', () => {
  it('always allows both languages so code-switching is not penalised', () => {
    expect(transcriptionLanguages('en')).toEqual(['en', 'ur']);
    expect(transcriptionLanguages('ur')).toEqual(['ur', 'en']);
  });
});
