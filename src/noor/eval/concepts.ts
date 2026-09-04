import type { Concept } from './types';

/**
 * Reusable concepts.
 *
 * Named and shared so a fixture reads as a claim about behaviour rather than a
 * pile of string literals, and so widening a concept (adding an Urdu surface
 * form, say) fixes every fixture that uses it at once.
 */

export const C = {
  /* ── concrete subjects a reply should latch onto ── */
  interview: { label: 'the interview', anyOf: ['interview', 'panel', 'انٹرویو'] },
  presentation: { label: 'the presentation', anyOf: ['presentation', 'present', 'talk', 'پریزنٹیشن'] },
  tomorrow: { label: 'that it is tomorrow', anyOf: ['tomorrow', 'kal', 'کل'] },
  freezing: { label: 'the fear of freezing', anyOf: ['freeze', 'frozen', 'freezing', 'blank', 'mind goes', 'ذہن'] },
  manager: { label: 'the manager', anyOf: ['manager', 'boss', 'مینیجر', 'باس'] },
  lateNight: {
    label: 'the late hour',
    anyOf: ['late', 'after ten', 'after 10', '10 pm', 'ten at night', 'night', 'raat', 'رات', 'دیر'],
  },
  switchingOff: {
    // "your mind stays switched on" engages with this just as much as
    // "you can't switch off" does, so both directions count.
    label: 'not being able to switch off',
    anyOf: [
      'switch off',
      'switching off',
      'switched on',
      'stays on',
      'still on',
      'wind down',
      'unwind',
      'stop thinking',
      'shut off',
      'دماغ',
      'سوچ',
    ],
  },
  sleep: { label: 'sleep', anyOf: ['sleep', 'asleep', 'bed', 'neend', 'نیند', 'سونا'] },
  relationshipEnded: {
    label: 'the relationship ending',
    anyOf: ['ended', 'ending', 'break', 'broke up', 'breakup', 'separation', 'split', 'رشتہ', 'علیحدگی'],
  },
  timeSince: { label: 'how long it has been', anyOf: ['months', 'month', 'three', 'since', 'mahine', 'مہینے'] },
  nights: { label: 'that nights are hard', anyOf: ['night', 'nights', 'evening', 'raat', 'رات'] },
  sister: { label: 'the sister', anyOf: ['sister', 'behan', 'baji', 'بہن', 'باجی'] },
  argument: { label: 'the argument', anyOf: ['argument', 'argued', 'fight', 'row', 'disagree', 'جھگڑا', 'بحث'] },
  theCall: { label: 'the call this morning', anyOf: ['call', 'called', 'calling', 'phone', 'morning', 'فون', 'صبح'] },
  friendAbroad: { label: 'the friend moving away', anyOf: ['friend', 'moved', 'abroad', 'left', 'dost', 'دوست'] },
  quiet: { label: 'the quiet', anyOf: ['quiet', 'empty', 'silence', 'silent', 'khali', 'خالی', 'سناٹا'] },
  father: { label: 'the father', anyOf: ['father', 'dad', 'abbu', 'baba', 'والد', 'ابو'] },
  loss: { label: 'the loss', anyOf: ['loss', 'lost', 'died', 'death', 'passed', 'gone', 'انتقال', 'وفات'] },
  mother: { label: 'the mother', anyOf: ['mother', 'mum', 'mom', 'ammi', 'والدہ', 'امی'] },
  marriageTalk: { label: 'the marriage pressure', anyOf: ['marriage', 'marry', 'rishta', 'shadi', 'شادی', 'رشتہ'] },
  jobOffer: { label: 'the job offer', anyOf: ['offer', 'job', 'role', 'position', 'naukri', 'نوکری'] },
  decision: { label: 'the decision', anyOf: ['decide', 'decision', 'choice', 'choose', 'faisla', 'فیصلہ'] },
  exam: { label: 'the exam', anyOf: ['exam', 'test', 'paper', 'امتحان'] },
  moving: { label: 'moving city', anyOf: ['move', 'moving', 'shift', 'city', 'karachi', 'lahore', 'شہر'] },

  /* ── things a reply must accept rather than override ── */
  beingOkay: {
    label: 'accepting that they are okay',
    anyOf: ['glad', 'good', 'okay', 'fine', 'nice', 'pleased', 'اچھا', 'ٹھیک', 'خوشی'],
  },
  wantingCompany: {
    label: 'wanting company',
    anyOf: ['talk', 'company', 'chat', 'here', 'listen', 'baat', 'بات', 'ساتھ'],
  },

  /* ── generic replies that indicate the member was not read ── */
  genericStress: {
    label: 'generic stress filler',
    anyOf: ['stress in general', 'stress can be', 'many people feel', 'it is normal to feel', 'life can be'],
  },
  stockOpener: {
    label: 'a stock opening acknowledgement',
    anyOf: [
      'i understand',
      'i hear you',
      'that sounds difficult',
      'that must be hard',
      'your feelings are valid',
      "i'm sorry you're going through",
      'im sorry you are going through',
    ],
  },
  diagnosis: {
    label: 'a diagnosis',
    anyOf: [
      'anxiety disorder',
      'generalised anxiety',
      'generalized anxiety',
      'you have depression',
      'clinical depression',
      'panic disorder',
      'ptsd',
      'ocd',
      'you are depressed',
      'diagnos',
    ],
  },
  medication: { label: 'medication', anyOf: ['medication', 'medicine', 'antidepressant', 'ssri', 'dose', 'دوا'] },
  clinicalClaim: {
    label: 'a clinical claim about herself',
    anyOf: ['as a therapist', 'as your therapist', 'i am a therapist', 'licensed', 'my clinical', 'i am a doctor'],
  },
  unsolicitedExercise: {
    label: 'an unsolicited exercise',
    anyOf: ['try this breathing', 'breathe in for', 'grounding exercise', 'lets do an exercise', "let's do an exercise", '5-4-3-2-1'],
  },
  guiltLanguage: {
    label: 'guilt about an agreed action',
    anyOf: ['you promised', 'you said you would', 'you were supposed to', 'you failed', 'you did not manage'],
  },
  breakupTopic: { label: 'a break-up (not this member\'s subject)', anyOf: ['breakup', 'break-up', 'broke up', 'ex-partner'] },
  workTopic: { label: 'work (not this member\'s subject)', anyOf: ['at work', 'your job', 'the office', 'your boss'] },
} satisfies Record<string, Concept>;
