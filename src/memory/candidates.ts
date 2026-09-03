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

  if (material.recommendedExerciseSlug) {
    push('coping_preference', `The "${material.recommendedExerciseSlug.replace(/-/g, ' ')}" exercise was suggested as a possible fit`);
  }

  return out.slice(0, 6);
}

export function toMemoryLine(item: { category: MemoryCategory; content: string }): string {
  return item.content;
}
