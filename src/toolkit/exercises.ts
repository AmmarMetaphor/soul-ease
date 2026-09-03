import type { ConcernId } from '@/data/types';

export type ExerciseKind =
  | 'grounding'
  | 'breathing'
  | 'thought_check'
  | 'behavioural_activation'
  | 'mindfulness'
  | 'problem_solving'
  | 'journaling'
  | 'communication';

export interface Exercise {
  slug: string;
  kind: ExerciseKind;
  title: string;
  /** Roman-Urdu / Urdu friendly short name shown as a secondary line. */
  subtitle: string;
  durationMinutes: number;
  summary: string;
  steps: string[];
  helpfulFor: ConcernId[];
  /** Plain note about where this approach comes from — no treatment claims. */
  basis: string;
}

/**
 * Phase 1 toolkit. Written as wellbeing exercises, not clinical procedures.
 */
export const EXERCISES: Exercise[] = [
  {
    slug: 'five-senses-grounding',
    kind: 'grounding',
    title: 'Five senses grounding',
    subtitle: 'Come back to the room',
    durationMinutes: 3,
    summary:
      'When your mind is racing ahead, this brings your attention back to what is actually around you right now.',
    steps: [
      'Sit or stand somewhere you can be still for a few minutes.',
      'Name five things you can see. Say them quietly to yourself or out loud.',
      'Name four things you can feel — the chair, your feet on the floor, the air on your skin.',
      'Name three things you can hear, near or far.',
      'Name two things you can smell, or two smells you like.',
      'Name one thing you can taste, or take one slow sip of water.',
      'Notice how your breathing has changed, if it has.',
    ],
    helpfulFor: ['anxiety', 'overthinking', 'stress'],
    basis: 'A widely used grounding technique from mindfulness and anxiety-management practice.',
  },
  {
    slug: 'box-breathing',
    kind: 'breathing',
    title: 'Box breathing',
    subtitle: 'Four sides, four counts',
    durationMinutes: 4,
    summary: 'A steady rhythm that gives a tense body something simple to follow.',
    steps: [
      'Breathe out fully first.',
      'Breathe in through your nose for a slow count of four.',
      'Hold gently for four.',
      'Breathe out through your mouth for four.',
      'Hold empty for four.',
      'Repeat for four to six rounds. If four feels too long, use three.',
    ],
    helpfulFor: ['anxiety', 'stress'],
    basis: 'A paced-breathing exercise commonly taught for calming the body.',
  },
  {
    slug: 'thought-check',
    kind: 'thought_check',
    title: 'The thought check',
    subtitle: 'Is this a fact, or a fear?',
    durationMinutes: 8,
    summary:
      'Overthinking often treats a worry as if it were already true. This slows the thought down and looks at it fairly.',
    steps: [
      'Write the thought down in one sentence, exactly as it sounds in your head.',
      'Ask: what is the evidence this is true? Write it down.',
      'Ask: what is the evidence it may not be true, or not the whole story?',
      'Ask: if a close friend said this about themselves, what would I say to them?',
      'Write a more balanced version of the thought. Not falsely positive — just fairer.',
      'Notice how the balanced version feels in your body compared with the first one.',
    ],
    helpfulFor: ['overthinking', 'anxiety', 'low_mood'],
    basis: 'Adapted from CBT-style thought records used in self-help wellbeing programmes.',
  },
  {
    slug: 'one-small-thing',
    kind: 'behavioural_activation',
    title: 'One small thing',
    subtitle: 'Action before motivation',
    durationMinutes: 5,
    summary:
      'When mood is low, waiting to feel like doing something rarely works. Choosing one very small action can shift the day a little.',
    steps: [
      'Think of something you used to find satisfying, comforting or meaningful — even something tiny.',
      'Shrink it until it feels almost too easy: a five-minute walk, one phone call, making one cup of chai properly.',
      'Decide when today you will do it. Say the time out loud.',
      'Do it, even if you do not feel like it. Feeling like it is not the goal.',
      'Afterwards, rate your mood from 1 to 5. Just notice — no judgement.',
    ],
    helpfulFor: ['low_mood', 'stress', 'grief'],
    basis: 'Based on behavioural activation principles from wellbeing self-help.',
  },
  {
    slug: 'worry-window',
    kind: 'mindfulness',
    title: 'The worry window',
    subtitle: 'A time for worrying — and a time to stop',
    durationMinutes: 15,
    summary:
      'Instead of fighting worries all day, give them a fixed appointment. Outside that window, gently postpone them.',
    steps: [
      'Choose a 15-minute slot later today. Not right before sleep.',
      'When a worry appears before then, note it in one line and tell yourself: "I will come back to this at my worry time."',
      'At your worry time, go through the list. Some worries will have faded.',
      'For each remaining worry ask: is there one concrete step I can take? If yes, write it down. If no, let it sit.',
      'End the window on time. Do something ordinary and physical afterwards — wash a cup, step outside.',
    ],
    helpfulFor: ['overthinking', 'anxiety'],
    basis: 'A stimulus-control approach to worry, commonly used in anxiety self-help.',
  },
  {
    slug: 'problem-shrink',
    kind: 'problem_solving',
    title: 'Shrink the problem',
    subtitle: 'From everything to one next step',
    durationMinutes: 10,
    summary:
      'When a problem feels like a wall, this breaks it into pieces small enough to actually hold.',
    steps: [
      'Describe the problem in one plain sentence. If it needs three, it is probably three problems.',
      'Separate what you can influence from what you cannot. Only work on the first list.',
      'Brainstorm every possible next step, including bad ones. Do not judge yet.',
      'Pick the one step that is smallest and most within reach.',
      'Decide when you will do it and what "done" looks like.',
    ],
    helpfulFor: ['stress', 'relationships', 'something_else'],
    basis: 'Structured problem solving, a standard wellbeing and coaching method.',
  },
  {
    slug: 'unsent-letter',
    kind: 'journaling',
    title: 'The unsent letter',
    subtitle: 'Say what you never got to say',
    durationMinutes: 15,
    summary:
      'Grief and unfinished conversations weigh heavily. Writing to the person — without needing to send it — gives the words somewhere to go.',
    steps: [
      'Find a private moment. Open a fresh journal entry.',
      'Begin with their name. Write as if speaking to them.',
      'Say what you miss, what you are angry about, what you wish you had said. All of it is allowed.',
      'Stop when you are ready, not when it feels finished. It does not have to finish.',
      'Close the entry. You can return to it, add to it, or never open it again.',
    ],
    helpfulFor: ['grief', 'relationships'],
    basis: 'An expressive-writing exercise often used in grief support.',
  },
  {
    slug: 'i-feel-when',
    kind: 'communication',
    title: 'Saying it without a fight',
    subtitle: 'I feel… when… because…',
    durationMinutes: 6,
    summary:
      'A simple structure for raising something difficult with a partner or family member without it turning into blame.',
    steps: [
      'Name the feeling first: "I feel hurt", "I feel ignored", "I feel worried".',
      'Describe the specific moment, not the person\'s character: "when plans change at the last minute".',
      'Say what it means to you: "because I had rearranged my day."',
      'Make one clear, small request: "Could you message me as soon as you know?"',
      'Practise it out loud once before the real conversation. Notice the tone you want.',
    ],
    helpfulFor: ['relationships', 'stress'],
    basis: 'Assertive-communication structure used in relationship and communication skills work.',
  },
];

export function getExercise(slug: string): Exercise | undefined {
  return EXERCISES.find((e) => e.slug === slug);
}

export function suggestExercise(concerns: ConcernId[], excludeSlugs: string[] = []): Exercise {
  const candidates = EXERCISES.filter((e) => !excludeSlugs.includes(e.slug));
  for (const concern of concerns) {
    const match = candidates.find((e) => e.helpfulFor.includes(concern));
    if (match) return match;
  }
  return candidates[0] ?? EXERCISES[0];
}
