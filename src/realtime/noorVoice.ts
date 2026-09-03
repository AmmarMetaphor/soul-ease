/**
 * Noor's voice identity — one place, one value.
 *
 * The realtime API fixes a session's voice before the first audio frame, so
 * the voice is chosen when the client secret is minted (server-side) and can
 * never change mid-conversation. Components never name a voice; they read
 * NOOR_VOICE, and developers override it through env only.
 *
 * Members never see a voice selector: Noor has a single consistent identity.
 */

/** Voices the deployment will mint. Mirrors SUPPORTED_VOICES on the server. */
export const REALTIME_VOICES = [
  'marin',
  'cedar',
  'coral',
  'shimmer',
  'sage',
  'alloy',
  'ash',
  'ballad',
  'echo',
  'verse',
] as const;

export type RealtimeVoice = (typeof REALTIME_VOICES)[number];

/**
 * Initial default. `marin` is a calm adult female voice — warm and
 * conversational rather than bright or announcer-like.
 *
 * Change via VITE_NOOR_VOICE (client hint) and NOOR_VOICE (server, decisive).
 * The server always has the final say.
 */
export const DEFAULT_NOOR_VOICE: RealtimeVoice = 'marin';

function readVoice(raw: string | undefined): RealtimeVoice {
  const candidate = raw?.trim();
  if (candidate && (REALTIME_VOICES as readonly string[]).includes(candidate)) {
    return candidate as RealtimeVoice;
  }
  return DEFAULT_NOOR_VOICE;
}

export const NOOR_VOICE: RealtimeVoice = readVoice(import.meta.env.VITE_NOOR_VOICE);

/**
 * The short list a developer compares on the audition page. Kept small on
 * purpose — the question is which voice gives Noor the most natural feminine
 * identity across English, Urdu and mixed speech, not an exhaustive survey.
 */
export const AUDITION_VOICES: RealtimeVoice[] = ['marin', 'coral', 'shimmer'];

export interface AuditionLine {
  id: 'english' | 'urdu' | 'mixed';
  label: string;
  text: string;
  /** Rough language hint for the transcription config during an audition. */
  languages: string[];
}

/**
 * Identical lines for every voice, so the comparison is about the voice.
 * Written the way Noor actually speaks: short, unhurried, no stock sympathy.
 */
export const AUDITION_LINES: AuditionLine[] = [
  {
    id: 'english',
    label: 'English',
    text: "I'm here. Take your time and tell me what's been on your mind today.",
    languages: ['en'],
  },
  {
    id: 'urdu',
    label: 'Urdu',
    text: 'Main yahan hoon. Aap araam se bataiye, aaj sab se zyada kis baat ne aap ko pareshan kiya?',
    languages: ['ur', 'en'],
  },
  {
    id: 'mixed',
    label: 'Mixed Urdu-English',
    text: "It's okay, araam se bataiye. Jo bhi aap ke mind mein chal raha hai, hum us se start kar sakte hain.",
    languages: ['ur', 'en'],
  },
];
