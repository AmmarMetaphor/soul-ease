import type { ConcernId, MemoryCategory, NewMemoryItem } from '@/data/types';

export interface MemoryCandidate extends NewMemoryItem {
  /** Client-side id so the member can remove a candidate before saving. */
  candidateId: string;
}

export interface CandidateSourceMaterial {
  sessionId: string;
  topic: ConcernId | null;
  agreedActions: string[];
  userTurns: string[];
  recommendedExerciseSlug: string | null;
  /** Things the member asked Noor to check back on next time. */
  followUpRequests?: string[];
  /** Observed language register, e.g. 'mixed' — a communication preference. */
  languageObserved?: string | null;
}

const TOPIC_LABELS: Record<ConcernId, string> = {
  anxiety: 'Anxiety has been a recurring stressor',
  low_mood: 'Low mood has been weighing on them',
  stress: 'Work or life pressure has been a recurring stressor',
  overthinking: 'Overthinking is a pattern they want to work on',
  grief: 'They are grieving a loss',
  relationships: 'A relationship has been a source of stress',
  someone_to_talk_to: 'They came mainly wanting to be heard',
  something_else: 'They have something on their mind they are still naming',
};

const RELATIONSHIP_RE =
  /\b(my|mera|meri|mere)\s+(wife|husband|partner|mother|father|mom|dad|brother|sister|son|daughter|boss|manager|friend|ammi|abbu|amma|abba|bhai|behan|baji|biwi|shohar|dost|saas|susar)\b/i;

const GOAL_RE = /\b(i want to|i'd like to|i wish i could|main chahta hoon|main chahti hoon|mujhe .* karna hai)\b/i;

/**
 * An explicit request to be asked again next time. Only an explicit one:
 * inferring a follow-up from a passing mention would turn a conversation into
 * a list of things the member has to account for.
 */
const FOLLOW_UP_RE =
  /\b(ask me (next time|again)|remind me( next time)?|check (in )?with me|follow up (with|on) (me|this)|agli baar poochh|yaad dila)\b/i;

/** How the member prefers to be spoken to, when they say so outright. */
const COMMUNICATION_RE =
  /\b(don'?t (give me|offer) advice|just listen|i (just )?(want|need) to (talk|vent)|no exercises?|keep it short|talk to me in (urdu|english)|urdu mein baat|sirf sun)\b/i;

let counter = 0;
function nextId(): string {
  counter += 1;
  return `cand-${Date.now().toString(36)}-${counter}`;
}

function candidate(category: MemoryCategory, content: string, sessionId: string): MemoryCandidate {
  return { candidateId: nextId(), category, content, sourceSessionId: sessionId };
}

/**
 * Turn a finished session into a short list of *proposed* memory items.
 *
 * Nothing here is saved automatically. The member reviews the list on the
 * session summary screen, removes anything they don't want kept, and only
 * then are the survivors written to long-term memory (and only if they have
 * consented to memory at all).
 *
 * Phase 1 uses simple heuristics; Phase 2 will have the model propose
 * candidates in the same shape.
 */
export function generateMemoryCandidates(material: CandidateSourceMaterial): MemoryCandidate[] {
  const out: MemoryCandidate[] = [];
  const seen = new Set<string>();
  const push = (category: MemoryCategory, content: string) => {
    const key = `${category}:${content.toLowerCase()}`;
    if (seen.has(key) || !content.trim()) return;
    seen.add(key);
    out.push(candidate(category, content.trim(), material.sessionId));
  };

  if (material.topic) push('stressor', TOPIC_LABELS[material.topic]);

  for (const action of material.agreedActions) {
    push('agreed_action', `Agreed to try: ${action}`);
  }

  for (const turn of material.userTurns) {
    const rel = RELATIONSHIP_RE.exec(turn);
    if (rel) {
      push('relationship', `Mentioned their ${rel[2].toLowerCase()} as important context`);
    }
    if (GOAL_RE.test(turn)) {
      const clause = turn.split(/[.!?؟]/)[0].trim();
      if (clause.length > 8 && clause.length <= 160) push('goal', clause);
    }
  }

  for (const turn of material.userTurns) {
    if (FOLLOW_UP_RE.test(turn)) {
      const clause = turn.split(/[.!?؟]/)[0].trim();
      if (clause.length > 8 && clause.length <= 200) push('follow_up', clause);
    }
    if (COMMUNICATION_RE.test(turn)) {
      const clause = turn.split(/[.!?؟]/)[0].trim();
      if (clause.length > 6 && clause.length <= 200) push('communication_preference', clause);
    }
  }

  for (const request of material.followUpRequests ?? []) {
    push('follow_up', request);
  }

  if (material.languageObserved === 'mixed') {
    push('communication_preference', 'Speaks in mixed Urdu-English and is comfortable being answered the same way');
  } else if (material.languageObserved === 'ur' || material.languageObserved === 'ur-roman') {
    push('communication_preference', 'Prefers to talk in Urdu');
  }

  if (material.recommendedExerciseSlug) {
    push('coping_preference', `The "${material.recommendedExerciseSlug.replace(/-/g, ' ')}" exercise was suggested as a possible fit`);
  }

  return out.slice(0, 8);
}

/**
 * Candidates that should become follow-up rows rather than memory lines.
 *
 * A follow-up is a thing Noor may raise once; a memory line is a thing she
 * knows. Keeping them apart is what stops "ask how the interview went"
 * becoming a permanent fact about the member.
 */
export function followUpCandidates(candidates: MemoryCandidate[]): MemoryCandidate[] {
  return candidates.filter((c) => c.category === 'follow_up');
}

export function toMemoryLine(item: { category: MemoryCategory; content: string }): string {
  return item.content;
}
