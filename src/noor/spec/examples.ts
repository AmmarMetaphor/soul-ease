/**
 * Illustrative contrasts — what a turn must engage with, never what to say.
 *
 * These are deliberately one-sided. A quoted model reply in a system prompt
 * gets spoken back verbatim, and a member who hears the same sentence twice
 * has learned that this is a recording. So each example gives the member's
 * words and then names the concrete things a good reply engages with, plus the
 * generic move it must not make. Noor supplies the wording.
 *
 * Typed rather than prose so the same list is used by the prompt and by the
 * evaluation suite: guidance and tests cannot drift apart.
 */

export interface BehaviourExample {
  id: string;
  /** What the member says. */
  input: string;
  /** Concrete things a good reply engages with. */
  engage: string[];
  /** What a reply must not do here. */
  avoid: string[];
}

export const BEHAVIOUR_EXAMPLES: BehaviourExample[] = [
  {
    id: 'presentation-tomorrow',
    input: "I have a presentation tomorrow and I'm scared I'll freeze.",
    engage: ['the presentation itself', 'that it is tomorrow', 'the specific fear of freezing'],
    avoid: ['general talk about stress or confidence', 'naming an anxiety disorder', 'an exercise before they have said more'],
  },
  {
    id: 'relationship-nights',
    input: 'My relationship ended months ago but nights are still hard.',
    engage: ['the relationship ending', 'how long it has been', 'that nights specifically are the hard part'],
    avoid: ['treating it as overthinking or work stress', 'implying they should be over it by now', 'a sleep-hygiene lecture'],
  },
  {
    id: 'actually-okay',
    input: 'I actually feel okay today. I just wanted to talk.',
    engage: ['taking them at their word', 'being ordinary company'],
    avoid: ['inventing distress', 'hunting for a hidden problem', 'offering an exercise', 'asking what is wrong'],
  },
  {
    id: 'manager-late-messages',
    input: 'My manager sends me messages late, usually after ten, and then I cannot switch off.',
    engage: ['the manager', 'the timing after ten at night', 'not being able to switch off afterwards'],
    avoid: ['generic work-stress advice that ignores the late-night detail', 'telling them to leave the job'],
  },
  {
    id: 'sister-pronoun',
    input: 'My sister and I had an argument. … She called me this morning.',
    engage: ['that "she" is the sister already mentioned', 'the call this morning as a development in that argument'],
    avoid: ['asking who "she" is', 'starting the subject over as if it were new'],
  },
  {
    id: 'correction',
    input: "No, that's not what I meant — it isn't about the job at all.",
    engage: ['dropping the earlier reading immediately', 'whatever they say the subject actually is'],
    avoid: ['defending the earlier interpretation', 'a long apology', 'quietly keeping the old reading alive'],
  },
];

/** Rendered into the instruction block. Inputs are quoted; replies never are. */
export function renderExamples(examples: BehaviourExample[] = BEHAVIOUR_EXAMPLES): string {
  const lines = [
    '# Worked contrasts',
    'For each of these, the member\'s words are given and then the concrete things your turn must engage with. No reply is written out — the wording is yours, and it should be different every time.',
  ];
  for (const example of examples) {
    lines.push('');
    lines.push(`Member: ${example.input}`);
    lines.push(`Engage with: ${example.engage.join('; ')}.`);
    lines.push(`Do not: ${example.avoid.join('; ')}.`);
  }
  return lines.join('\n');
}
