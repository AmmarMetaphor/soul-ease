import type { ConcernId } from '@/data/types';
import type { SafetyState } from '@/safety/types';
import { detectTopic } from '@/session/topicTags';
import type { DetectedLanguage } from '../types';
import { detectLanguage } from './languageDetection';

/**
 * Scripted UI harness for the session interface — NOT a conversation engine.
 *
 * It replies from small pools of pre-written lines selected by a topic regex
 * and a phase counter. It cannot understand a sentence, cannot refer to
 * anything the member actually said beyond echoing a fragment, and will
 * answer two completely different problems with nearly the same words. That
 * is not a limitation to work around; it is what a rule-based script is.
 *
 * Its only legitimate use is reviewing the session interface with no
 * credentials configured: layout, conversation states, barge-in affordances,
 * transcript rendering, safety panel. It must never stand in for Noor for a
 * real member, which is why it is reachable only through an explicit
 * `VITE_REALTIME_PROVIDER=demo` build (see realtime/createProvider.ts).
 */

export type DemoPhase =
  | 'opening'
  | 'clarifying'
  | 'exploring'
  | 'challenging'
  | 'offering'
  | 'guiding'
  | 'next_step'
  | 'confirmed'
  | 'closing';

export interface DemoEngineState {
  phase: DemoPhase;
  userTurns: number;
  topic: ConcernId | null;
  language: DetectedLanguage;
  interventionSlug: string | null;
  interventionAccepted: boolean | null;
  agreedActions: string[];
  /** Short fragments of the member's own words, used for reflection. */
  fragments: string[];
  safetyTurns: number;
}

export function createDemoState(preferredLanguage: 'en' | 'ur'): DemoEngineState {
  return {
    phase: 'opening',
    userTurns: 0,
    topic: null,
    language: preferredLanguage === 'ur' ? 'ur-roman' : 'en',
    interventionSlug: null,
    interventionAccepted: null,
    agreedActions: [],
    fragments: [],
    safetyTurns: 0,
  };
}

/* ─── Small intent detectors ──────────────────────────────────────────── */

const YES_RE = /^(yes|yeah|yep|ok(ay)?|sure|haan|han|ji|jee|theek|thik|chalo|acha|let'?s|try|ہاں|جی|ٹھیک)\b/i;
const NO_RE = /^(no|nah|nope|not now|nahi|nahin|nai|rather not|keep talking|baat|نہیں)\b/i;
const BYE_RE = /\b(bye|goodbye|that'?s all|i (should|have to|need to) go|thank(s| you)( so much)?[.!]?$|khuda hafiz|allah hafiz|shukriya|bas (itna|yehi)|chalta hoon|chalti hoon|اللہ حافظ|خدا حافظ|شکریہ)\b/i;
const HUMAN_Q_RE = /\b(are you (a )?(human|real|person|bot|ai|robot)|kya (aap|tum) (insaan|robot|ai) (ho|hain)|are you (a )?(therapist|doctor|psychologist|counsell?or))\b/i;

/* ─── Language-register templates ─────────────────────────────────────── */

type Register = DetectedLanguage;
type Lines = Partial<Record<Register, string[]>> & { en: string[] };

/** Fallback order keeps the closest register: mixed/ur → ur-roman → en. */
function pick(lines: Lines, register: Register, seed: number): string {
  const pool =
    lines[register] ?? (register === 'mixed' || register === 'ur' ? lines['ur-roman'] : undefined) ?? lines.en;
  return pool[seed % pool.length];
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}

const OPENING: Lines = {
  en: [
    'Hi{name}. I\'m Noor. There\'s no rush here — how are you arriving today?',
    'Hello{name}, I\'m Noor. Take a moment. What\'s been on your mind lately?',
  ],
  mixed: ['Hi{name}. Main Noor hoon. Koi jaldi nahi — aaj aap kaisa feel kar rahe hain?'],
  'ur-roman': [
    'Assalam o alaikum{name}. Main Noor hoon. Koi jaldi nahi — aaj aap kaisa mehsoos kar rahe hain?',
  ],
  ur: ['السلام علیکم{name}۔ میں نور ہوں۔ کوئی جلدی نہیں — آج آپ کیسا محسوس کر رہے ہیں؟'],
};

const OPENING_GENTLE: Lines = {
  en: ['Hi{name}. Last time we spoke, things were heavy. Before anything else — how are you today, honestly?'],
  'ur-roman': ['Assalam o alaikum{name}. Pichli baar baat kaafi bhaari thi. Sab se pehle — aaj aap sach mein kaise hain?'],
  ur: ['السلام علیکم{name}۔ پچھلی بار بات کافی بھاری تھی۔ سب سے پہلے — آج آپ سچ میں کیسے ہیں؟'],
};

const CLARIFY: Record<ConcernId | 'none', Lines> = {
  anxiety: {
    en: ['When the anxiety shows up, where do you notice it first — in your body, or in your thoughts?'],
    mixed: ['Jab anxiety aati hai, sab se pehle kahan notice hoti hai — body mein ya thoughts mein?'],
    'ur-roman': ['Jab ghabrahat aati hai, sab se pehle kahan mehsoos hoti hai — jism mein ya sochon mein?'],
    ur: ['جب گھبراہٹ آتی ہے تو سب سے پہلے کہاں محسوس ہوتی ہے — جسم میں یا سوچوں میں؟'],
  },
  overthinking: {
    en: ['What\'s the thought that keeps coming back most often?'],
    mixed: ['Wo kaunsi thought hai jo sab se zyada baar baar wapas aati hai?'],
    'ur-roman': ['Wo kaunsi soch hai jo sab se zyada baar baar wapas aati hai?'],
    ur: ['وہ کون سی سوچ ہے جو سب سے زیادہ بار بار واپس آتی ہے؟'],
  },
  low_mood: {
    en: ['How long has it felt like this — a few days, or longer than that?'],
    mixed: ['Kitne din se aisa feel ho raha hai — kuch din, ya kaafi time se?'],
    'ur-roman': ['Kitne din se aisa lag raha hai — kuch din, ya kaafi waqt se?'],
    ur: ['کتنے دن سے ایسا لگ رہا ہے — کچھ دن، یا کافی وقت سے؟'],
  },
  stress: {
    en: ['If you had to name the one thing pressing hardest right now, what would it be?'],
    mixed: ['Agar aik cheez ka naam lena ho jo abhi sab se zyada pressure de rahi hai, wo kya hogi?'],
    'ur-roman': ['Agar aik cheez ka naam lena ho jo abhi sab se zyada bhaari lag rahi hai, wo kya hogi?'],
    ur: ['اگر ایک چیز کا نام لینا ہو جو ابھی سب سے زیادہ بھاری لگ رہی ہے، تو وہ کیا ہوگی؟'],
  },
  grief: {
    en: ['Tell me about them, if you\'d like to. What comes to mind first?'],
    mixed: ['Agar aap chahein, unke baare mein bataiye. Sab se pehle kya yaad aata hai?'],
    'ur-roman': ['Agar aap chahein, unke baare mein bataiye. Sab se pehle kya yaad aata hai?'],
    ur: ['اگر آپ چاہیں تو ان کے بارے میں بتائیں۔ سب سے پہلے کیا یاد آتا ہے؟'],
  },
  relationships: {
    en: ['What happened most recently that\'s still sitting with you?'],
    mixed: ['Recently kya hua jo abhi tak dil pe hai?'],
    'ur-roman': ['Haal hi mein kya hua jo abhi tak dil pe hai?'],
    ur: ['حال ہی میں کیا ہوا جو ابھی تک دل پر ہے؟'],
  },
  someone_to_talk_to: {
    en: ['I\'m listening. Start wherever feels easiest.'],
    'ur-roman': ['Main sun rahi hoon. Jahan se asaan lage, wahan se shuru karein.'],
    ur: ['میں سن رہی ہوں۔ جہاں سے آسان لگے وہاں سے شروع کریں۔'],
  },
  something_else: {
    en: ['Say more about that — what does it look like on an ordinary day?'],
    'ur-roman': ['Thora aur bataiye — aik aam din mein yeh kaisa lagta hai?'],
    ur: ['تھوڑا اور بتائیں — ایک عام دن میں یہ کیسا لگتا ہے؟'],
  },
  none: {
    en: ['I\'m listening. What\'s been on your mind?'],
    'ur-roman': ['Main sun rahi hoon. Aaj kal dil mein kya chal raha hai?'],
    ur: ['میں سن رہی ہوں۔ آج کل دل میں کیا چل رہا ہے؟'],
  },
};

const EXPLORE: Record<'default' | 'grief' | 'relationships', Lines> = {
  default: {
    en: [
      'That makes sense. When it\'s at its worst, what goes through your mind first?',
      'Okay. And when that happens, what do you usually do with it — push through, shut down, something else?',
    ],
    mixed: ['Samajh aa rahi hai. Jab sab se zyada mushkil hota hai, sab se pehle kya thought aati hai?'],
    'ur-roman': ['Samajh aa rahi hai. Jab sab se zyada mushkil hota hai, sab se pehle kya soch aati hai?'],
    ur: ['سمجھ آ رہی ہے۔ جب سب سے زیادہ مشکل ہوتا ہے تو سب سے پہلے کیا سوچ آتی ہے؟'],
  },
  grief: {
    en: ['There\'s no right way to feel about this. Day to day, what do you find yourself missing most?'],
    'ur-roman': ['Iska koi "sahi" tareeqa nahi hota. Roz ke din mein aap ko sab se zyada kya kami mehsoos hoti hai?'],
    ur: ['اس کا کوئی "صحیح" طریقہ نہیں ہوتا۔ روز کے دن میں آپ کو سب سے زیادہ کس چیز کی کمی محسوس ہوتی ہے؟'],
  },
  relationships: {
    en: ['I\'m not going to tell you what to do about them — that\'s yours. But what do you want to be different?'],
    mixed: ['Main aap ko nahi bataoongi ke unke saath kya karna hai — wo aap ka faisla hai. Lekin aap kya different chahte hain?'],
    'ur-roman': ['Main aap ko nahi bataoongi ke unke saath kya karna hai — wo aap ka faisla hai. Lekin aap kya alag chahte hain?'],
    ur: ['میں آپ کو نہیں بتاؤں گی کہ ان کے ساتھ کیا کرنا ہے — وہ آپ کا فیصلہ ہے۔ لیکن آپ کیا الگ چاہتے ہیں؟'],
  },
};

const CHALLENGE: Lines = {
  en: [
    'Can I check something with you? "{fragment}" — is that something you know, or something you fear?',
    'You said "{fragment}". If a close friend said that about themselves, what would you say to them?',
  ],
  mixed: ['Aik cheez check karoon? "{fragment}" — yeh aap ko pata hai, ya iska darr hai?'],
  'ur-roman': ['Aik cheez check karoon? "{fragment}" — yeh aap ko pata hai, ya iska darr hai?'],
  ur: ['ایک چیز چیک کروں؟ "{fragment}" — یہ آپ کو پتا ہے، یا اس کا ڈر ہے؟'],
};

const LISTEN_ONLY: Lines = {
  en: [
    'Go on. I\'m here.',
    'Take your time with that.',
    'That sounds like a lot to hold. What else is there?',
  ],
  'ur-roman': ['Bataiye. Main yahan hoon.', 'Aaram se. Koi jaldi nahi.'],
  ur: ['بتائیں۔ میں یہاں ہوں۔', 'آرام سے۔ کوئی جلدی نہیں۔'],
};

interface InterventionCopy {
  slug: string;
  offer: Lines;
  guide: Lines;
}

const INTERVENTIONS: Record<ConcernId, InterventionCopy | null> = {
  anxiety: {
    slug: 'five-senses-grounding',
    offer: {
      en: ['Would it help to try something short together — a couple of minutes to bring your attention back to the room — or would you rather keep talking?'],
      mixed: ['Kya aik short cheez try karein — do minute ke liye attention wapas room mein lana — ya aap baat continue karna chahein ge?'],
      'ur-roman': ['Kya aik choti si cheez try karein — do minute ke liye tawajju wapas kamre mein lana — ya aap baat jaari rakhna chahein ge?'],
      ur: ['کیا ایک چھوٹی سی چیز آزمائیں — دو منٹ کے لیے توجہ واپس کمرے میں لانا — یا آپ بات جاری رکھنا چاہیں گے؟'],
    },
    guide: {
      en: ['Okay. Wherever you are, name five things you can see. Take your time — just tell me what they are.'],
      'ur-roman': ['Theek hai. Jahan bhi aap hain, paanch cheezein bataiye jo aap dekh sakte hain. Aaram se.'],
      ur: ['ٹھیک ہے۔ جہاں بھی آپ ہیں، پانچ چیزیں بتائیں جو آپ دیکھ سکتے ہیں۔ آرام سے۔'],
    },
  },
  overthinking: {
    slug: 'thought-check',
    offer: {
      en: ['Would it be useful to slow one of those thoughts down and look at it fairly — or do you want to keep talking it through first?'],
      mixed: ['Kya aik thought ko slow karke fairly dekhein — ya pehle aap baat karna chahte hain?'],
      'ur-roman': ['Kya aik soch ko dheema karke insaaf se dekhein — ya pehle aap baat karna chahte hain?'],
      ur: ['کیا ایک سوچ کو دھیما کر کے انصاف سے دیکھیں — یا پہلے آپ بات کرنا چاہتے ہیں؟'],
    },
    guide: {
      en: ['Say the thought in one sentence, exactly as it sounds in your head. Then we\'ll ask what the evidence actually is.'],
      'ur-roman': ['Wo soch aik jumle mein bolein, bilkul waise jaise dimagh mein aati hai. Phir dekhte hain iska saboot kya hai.'],
      ur: ['وہ سوچ ایک جملے میں کہیں، بالکل ویسے جیسے دماغ میں آتی ہے۔ پھر دیکھتے ہیں اس کا ثبوت کیا ہے۔'],
    },
  },
  low_mood: {
    slug: 'one-small-thing',
    offer: {
      en: ['When energy is this low, waiting to feel like doing something rarely works. Could we find one very small thing for today — or is it a day for just talking?'],
      'ur-roman': ['Jab energy itni kam ho, dil karne ka intezaar karna kam hi kaam karta hai. Aaj ke liye aik bohat choti cheez dhoondein — ya aaj sirf baat karne ka din hai?'],
      ur: ['جب توانائی اتنی کم ہو تو دل کرنے کا انتظار کم ہی کام کرتا ہے۔ آج کے لیے ایک بہت چھوٹی چیز ڈھونڈیں — یا آج صرف بات کرنے کا دن ہے؟'],
    },
    guide: {
      en: ['Think of something that used to feel even slightly good. Now shrink it until it\'s almost too easy. What is it?'],
      'ur-roman': ['Koi cheez sochein jo pehle thori si bhi achi lagti thi. Ab usay itna chota karein ke bilkul asaan lage. Wo kya hai?'],
      ur: ['کوئی چیز سوچیں جو پہلے تھوڑی سی بھی اچھی لگتی تھی۔ اب اسے اتنا چھوٹا کریں کہ بالکل آسان لگے۔ وہ کیا ہے؟'],
    },
  },
  stress: {
    slug: 'problem-shrink',
    offer: {
      en: ['Would it help to break this into pieces small enough to actually hold — or do you need to get more of it out first?'],
      'ur-roman': ['Kya isay itne chote hisson mein torein ke sambhala ja sake — ya pehle aap ko aur bolna hai?'],
      ur: ['کیا اسے اتنے چھوٹے حصوں میں توڑیں کہ سنبھالا جا سکے — یا پہلے آپ کو اور کہنا ہے؟'],
    },
    guide: {
      en: ['Describe the problem in one plain sentence. If it needs three, it\'s probably three problems — and that\'s useful to know.'],
      'ur-roman': ['Masla aik saaf jumle mein bataiye. Agar teen jumle chahiye, to shayad teen masle hain — aur yeh jaan lena faida mand hai.'],
      ur: ['مسئلہ ایک صاف جملے میں بتائیں۔ اگر تین جملے چاہیے ہوں تو شاید تین مسئلے ہیں — اور یہ جان لینا فائدہ مند ہے۔'],
    },
  },
  grief: {
    slug: 'unsent-letter',
    offer: {
      en: ['Some people find it helps to write to the person — a letter that never has to be sent. It\'s there in your journal if you want it. For now, I\'m happy to just listen.'],
      'ur-roman': ['Kuch logon ko unko khat likhna madad deta hai — aisa khat jo kabhi bhejna nahi parta. Journal mein yeh mojood hai agar aap chahein. Abhi ke liye, main bas sunna chahti hoon.'],
      ur: ['کچھ لوگوں کو ان کو خط لکھنا مدد دیتا ہے — ایسا خط جو کبھی بھیجنا نہ پڑے۔ جرنل میں یہ موجود ہے اگر آپ چاہیں۔ ابھی کے لیے، میں بس سننا چاہتی ہوں۔'],
    },
    guide: {
      en: ['Begin with their name, and say what you never got to say. Stop when you\'re ready — it doesn\'t have to finish.'],
      'ur-roman': ['Unke naam se shuru karein, aur wo kahein jo kabhi keh nahi paye. Jab chahein rukein — khatam hona zaroori nahi.'],
      ur: ['ان کے نام سے شروع کریں، اور وہ کہیں جو کبھی کہہ نہ پائے۔ جب چاہیں رکیں — ختم ہونا ضروری نہیں۔'],
    },
  },
  relationships: {
    slug: 'i-feel-when',
    offer: {
      en: ['If you ever want to say this to them without it becoming a fight, there\'s a simple structure we could practise. Or we can stay with how it feels for now.'],
      'ur-roman': ['Agar aap kabhi yeh unse kehna chahein bagair larai ke, aik asaan tareeqa hai jo practise kar sakte hain. Ya abhi hum is pe rukein ke aap kaisa mehsoos kar rahe hain.'],
      ur: ['اگر آپ کبھی یہ ان سے بغیر لڑائی کے کہنا چاہیں تو ایک آسان طریقہ ہے جس کی مشق کر سکتے ہیں۔ یا ابھی ہم اس پر رکیں کہ آپ کیسا محسوس کر رہے ہیں۔'],
    },
    guide: {
      en: ['Start with the feeling, not the accusation: "I feel…" Then the specific moment: "when…" Try the first half now.'],
      'ur-roman': ['Ilzaam se nahi, ehsaas se shuru karein: "Mujhe … lagta hai" Phir wo khaas lamha: "jab …" Pehla hissa abhi try karein.'],
      ur: ['الزام سے نہیں، احساس سے شروع کریں: "مجھے … لگتا ہے" پھر وہ خاص لمحہ: "جب …" پہلا حصہ ابھی آزمائیں۔'],
    },
  },
  someone_to_talk_to: null,
  something_else: null,
};

const DECLINE_ACK: Lines = {
  en: ['That\'s fine. We can just talk. Where were we?'],
  'ur-roman': ['Bilkul theek. Hum bas baat karte hain. Kahan the hum?'],
  ur: ['بالکل ٹھیک۔ ہم بس بات کرتے ہیں۔ کہاں تھے ہم؟'],
};

const GUIDE_FOLLOW: Lines = {
  en: ['Good. Notice if anything in your body has shifted, even slightly. No need for it to have.'],
  'ur-roman': ['Acha. Dekhein ke jism mein kuch badla hai, thora sa bhi. Zaroori nahi ke badla ho.'],
  ur: ['اچھا۔ دیکھیں کہ جسم میں کچھ بدلا ہے، تھوڑا سا بھی۔ ضروری نہیں کہ بدلا ہو۔'],
};

const NEXT_STEP: Lines = {
  en: ['Before we finish — what\'s one small thing you could try between now and next time? Small enough that it\'s almost easy.'],
  mixed: ['Finish karne se pehle — agli baar tak aik choti si cheez jo aap try kar sakein? Itni choti ke almost easy lage.'],
  'ur-roman': ['Khatam karne se pehle — agli baar tak aik choti si cheez jo aap try kar sakein? Itni choti ke asaan lage.'],
  ur: ['ختم کرنے سے پہلے — اگلی بار تک ایک چھوٹی سی چیز جو آپ آزما سکیں؟ اتنی چھوٹی کہ آسان لگے۔'],
};

const CONFIRM_STEP: Lines = {
  en: ['Good. "{action}" — let\'s keep it at that. Nothing more. If it doesn\'t happen, that\'s information, not failure.'],
  'ur-roman': ['Acha. "{action}" — bas itna hi. Iss se zyada nahi. Agar na ho sake, to wo bhi aik baat hai, nakaami nahi.'],
  ur: ['اچھا۔ "{action}" — بس اتنا ہی۔ اس سے زیادہ نہیں۔ اگر نہ ہو سکے تو وہ بھی ایک بات ہے، ناکامی نہیں۔'],
};

const CLOSING: Lines = {
  en: ['Thank you for talking with me today. I\'ll put together a short summary you can look over, and I\'ll be here when you come back.'],
  'ur-roman': ['Aaj baat karne ka shukriya. Main aik choti si summary bana deti hoon jo aap dekh sakte hain. Jab wapas aayein, main yahan hoon.'],
  ur: ['آج بات کرنے کا شکریہ۔ میں ایک چھوٹی سی سمری بنا دیتی ہوں جو آپ دیکھ سکتے ہیں۔ جب واپس آئیں، میں یہاں ہوں۔'],
};

const HUMAN_ANSWER: Lines = {
  en: ['I\'m not a person — I\'m Noor, an AI guide, and I\'m not a therapist or doctor. If you\'d like to speak with a human, I can help you find one through Soul Ease. For now, I\'m listening.'],
  'ur-roman': ['Main insaan nahi hoon — main Noor hoon, aik AI guide, aur main therapist ya doctor nahi. Agar aap kisi insaan se baat karna chahein, Soul Ease ke zariye main madad kar sakti hoon. Abhi, main sun rahi hoon.'],
  ur: ['میں انسان نہیں ہوں — میں نور ہوں، ایک AI گائیڈ، اور میں تھراپسٹ یا ڈاکٹر نہیں۔ اگر آپ کسی انسان سے بات کرنا چاہیں تو Soul Ease کے ذریعے میں مدد کر سکتی ہوں۔ ابھی، میں سن رہی ہوں۔'],
};

const SAFETY: Lines[] = [
  {
    en: ['Thank you for telling me that. It matters, and I\'m taking it seriously. Right now — are you safe? Are you somewhere you won\'t be hurt in the next little while?'],
    'ur-roman': ['Mujhe batane ka shukriya. Yeh bohat ahem hai, aur main isay serious le rahi hoon. Abhi is waqt — aap mehfooz hain? Aap aisi jagah hain jahan agle kuch waqt mein aap ko nuqsan na ho?'],
    ur: ['مجھے بتانے کا شکریہ۔ یہ بہت اہم ہے، اور میں اسے سنجیدگی سے لے رہی ہوں۔ ابھی اس وقت — آپ محفوظ ہیں؟ آپ ایسی جگہ ہیں جہاں اگلے کچھ وقت میں آپ کو نقصان نہ ہو؟'],
  },
  {
    en: ['Is there someone near you — family, a friend, a neighbour — who could be with you right now? You don\'t need to explain everything to them. "I\'m not okay and I don\'t want to be alone" is enough.'],
    'ur-roman': ['Koi aap ke paas hai — ghar wale, dost, koi hamsaya — jo abhi aap ke saath ho sake? Unhein sab kuch batane ki zaroorat nahi. "Main theek nahi hoon aur akela nahi rehna chahta" kaafi hai.'],
    ur: ['کوئی آپ کے پاس ہے — گھر والے، دوست، کوئی ہمسایہ — جو ابھی آپ کے ساتھ ہو سکے؟ انہیں سب کچھ بتانے کی ضرورت نہیں۔ "میں ٹھیک نہیں ہوں اور اکیلا نہیں رہنا چاہتا" کافی ہے۔'],
  },
  {
    en: ['I\'m an AI, and I can\'t keep you safe on my own — I won\'t pretend otherwise. The support options on your screen are there for exactly this, and I can help you reach a person. I\'m staying right here with you while you decide.'],
    'ur-roman': ['Main AI hoon, aur akeli aap ko mehfooz nahi rakh sakti — main yeh dawa nahi karoongi. Screen pe jo support options hain wo isi liye hain, aur main aap ko kisi insaan tak pohanchne mein madad kar sakti hoon. Main yahan hoon jab tak aap faisla karein.'],
    ur: ['میں AI ہوں، اور اکیلی آپ کو محفوظ نہیں رکھ سکتی — میں یہ دعویٰ نہیں کروں گی۔ اسکرین پر جو سپورٹ آپشنز ہیں وہ اسی لیے ہیں، اور میں آپ کو کسی انسان تک پہنچنے میں مدد کر سکتی ہوں۔ میں یہاں ہوں جب تک آپ فیصلہ کریں۔'],
  },
];

const HANDOFF: Lines = {
  en: ['Okay. I\'ve opened the human support options for you. I\'ll step back now so you can reach a person — that\'s the right call.'],
  'ur-roman': ['Theek hai. Main ne aap ke liye human support options khol diye hain. Ab main peeche hoti hoon taake aap kisi insaan tak pohanch sakein — yeh sahi faisla hai.'],
  ur: ['ٹھیک ہے۔ میں نے آپ کے لیے ہیومن سپورٹ آپشنز کھول دیے ہیں۔ اب میں پیچھے ہوتی ہوں تاکہ آپ کسی انسان تک پہنچ سکیں — یہ صحیح فیصلہ ہے۔'],
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function extractFragment(text: string): string | null {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const clause = cleaned.split(/[.!?؟،,;]/)[0]?.trim() ?? '';
  const words = clause.split(' ');
  if (words.length < 3) return null;
  return words.slice(0, 12).join(' ');
}

function nameSuffix(displayName?: string | null): string {
  const trimmed = displayName?.trim();
  return trimmed ? ` ${trimmed}` : '';
}

/* ─── Public API ──────────────────────────────────────────────────────── */

export function openingLine(
  state: DemoEngineState,
  opts: { displayName?: string | null; openGently: boolean; memoryContext: string[] },
): string {
  const vars = { name: nameSuffix(opts.displayName) };
  const base = pick(opts.openGently ? OPENING_GENTLE : OPENING, state.language, 0);
  const line = fill(base, vars);
  if (!opts.openGently && opts.memoryContext.length > 0) {
    const memory = opts.memoryContext[0];
    const recall: Lines = {
      en: [` Last time you mentioned ${memory.toLowerCase()} — we can pick that up, or start somewhere new.`],
      'ur-roman': [` Pichli baar aap ne ${memory} ka zikr kiya tha — wahan se shuru karein, ya kuch naya?`],
      ur: [` پچھلی بار آپ نے ${memory} کا ذکر کیا تھا — وہاں سے شروع کریں، یا کچھ نیا؟`],
    };
    return line + pick(recall, state.language, 0);
  }
  return line;
}

export interface DemoReply {
  text: string;
  state: DemoEngineState;
  /** Set when the member has signalled they want to finish. */
  wantsToEnd: boolean;
}

export function respond(
  previous: DemoEngineState,
  userText: string,
  safetyState: SafetyState,
): DemoReply {
  const language = detectLanguage(userText);
  const state: DemoEngineState = {
    ...previous,
    language,
    userTurns: previous.userTurns + 1,
    fragments: [...previous.fragments],
    agreedActions: [...previous.agreedActions],
  };
  const seed = state.userTurns;

  // Safety Mode overrides everything else — no coaching, no techniques.
  if (safetyState === 'SAFETY_MODE') {
    const idx = Math.min(state.safetyTurns, SAFETY.length - 1);
    state.safetyTurns += 1;
    return { text: pick(SAFETY[idx], language, 0), state, wantsToEnd: false };
  }
  if (safetyState === 'HUMAN_HANDOFF') {
    return { text: pick(HANDOFF, language, 0), state, wantsToEnd: false };
  }

  if (HUMAN_Q_RE.test(userText)) {
    return { text: pick(HUMAN_ANSWER, language, 0), state, wantsToEnd: false };
  }

  if (BYE_RE.test(userText) && state.userTurns > 1) {
    state.phase = 'closing';
    return { text: pick(CLOSING, language, 0), state, wantsToEnd: true };
  }

  const detected = detectTopic(userText);
  if (detected && !state.topic) state.topic = detected;
  const fragment = extractFragment(userText);
  if (fragment) state.fragments.push(fragment);

  switch (state.phase) {
    case 'opening': {
      state.phase = 'clarifying';
      const topic = state.topic ?? 'none';
      return { text: pick(CLARIFY[topic], language, seed), state, wantsToEnd: false };
    }
    case 'clarifying': {
      state.phase = 'exploring';
      const key =
        state.topic === 'grief' ? 'grief' : state.topic === 'relationships' ? 'relationships' : 'default';
      return { text: pick(EXPLORE[key], language, seed), state, wantsToEnd: false };
    }
    case 'exploring': {
      const canChallenge =
        (state.topic === 'overthinking' || state.topic === 'anxiety' || state.topic === 'low_mood') &&
        state.fragments.length > 0;
      if (canChallenge) {
        state.phase = 'challenging';
        const text = fill(pick(CHALLENGE, language, seed), {
          fragment: state.fragments[state.fragments.length - 1],
        });
        return { text, state, wantsToEnd: false };
      }
      state.phase = 'offering';
      return offerOrListen(state, language, seed);
    }
    case 'challenging': {
      state.phase = 'offering';
      return offerOrListen(state, language, seed);
    }
    case 'offering': {
      if (state.interventionSlug) {
        if (YES_RE.test(userText.trim())) {
          state.interventionAccepted = true;
          state.phase = 'guiding';
          const copy = state.topic ? INTERVENTIONS[state.topic] : null;
          return { text: copy ? pick(copy.guide, language, 0) : pick(LISTEN_ONLY, language, seed), state, wantsToEnd: false };
        }
        if (NO_RE.test(userText.trim())) {
          state.interventionAccepted = false;
          state.phase = 'next_step';
          return { text: pick(DECLINE_ACK, language, 0), state, wantsToEnd: false };
        }
      }
      state.phase = 'next_step';
      return { text: pick(LISTEN_ONLY, language, seed), state, wantsToEnd: false };
    }
    case 'guiding': {
      state.phase = 'next_step';
      return { text: pick(GUIDE_FOLLOW, language, 0), state, wantsToEnd: false };
    }
    case 'next_step': {
      state.phase = 'confirmed';
      return { text: pick(NEXT_STEP, language, 0), state, wantsToEnd: false };
    }
    case 'confirmed': {
      const action = userText.replace(/\s+/g, ' ').trim();
      if (action.length > 3 && !NO_RE.test(action)) {
        state.agreedActions.push(action.length > 140 ? `${action.slice(0, 137)}…` : action);
        state.phase = 'closing';
        return { text: fill(pick(CONFIRM_STEP, language, 0), { action: state.agreedActions[0] }), state, wantsToEnd: false };
      }
      state.phase = 'closing';
      return { text: pick(LISTEN_ONLY, language, seed), state, wantsToEnd: false };
    }
    case 'closing':
    default: {
      return { text: pick(LISTEN_ONLY, language, seed), state, wantsToEnd: false };
    }
  }
}

function offerOrListen(state: DemoEngineState, language: Register, seed: number): DemoReply {
  const copy = state.topic ? INTERVENTIONS[state.topic] : null;
  if (copy) {
    state.interventionSlug = copy.slug;
    return { text: pick(copy.offer, language, 0), state, wantsToEnd: false };
  }
  state.phase = 'next_step';
  return { text: pick(LISTEN_ONLY, language, seed), state, wantsToEnd: false };
}
