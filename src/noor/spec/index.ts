import { GUIDE_NAME } from '@/config/app';
import { CONVERSATION_SHAPE, SPEAKING_STYLE } from './conversationalStyle';
import { CORRECTIONS, RESPONDING, TURN_TAKING } from './contextualResponseRules';
import { IDENTITY, VOICE_DELIVERY } from './identity';
import { LANGUAGE } from './languageBehaviour';
import { MEMORY } from './memoryRules';
import { METHOD_PROGRESSION, METHODS, GOALS_AND_FOLLOW_UPS } from './therapeuticMethods';
import { OPENING } from './opening';
import { PROHIBITED } from './prohibited';
import { renderExamples } from './examples';
import { SAFETY } from './safetyRules';
import { HUMAN_SUPPORT, SCOPE } from './scope';
import type { NoorSessionContext } from './context';

/**
 * Noor's behavioural specification, composed.
 *
 * Each section is a separate module so one behaviour — language mirroring,
 * say — can be revised and tested without touching the rest, and so the
 * safety section can be re-sent as a stronger variant mid-session. This is a
 * prompt *architecture*, not one long paragraph: Noor is built from
 * instructions, context and evaluation rather than fine-tuning.
 *
 * Section order is deliberate. Identity and scope establish standing, then
 * `RESPONDING` comes before any style or method rule, because answering the
 * person rather than the topic is the behaviour everything else depends on.
 * Safety appears late and says explicitly that it outranks what came before.
 *
 * The same composition serves voice and text. There is no second text-mode
 * Noor.
 */

/** Section headings, in composition order. Used by tests and diagnostics. */
export const SPEC_SECTIONS = [
  '# Identity',
  '# Scope',
  '# Answering what they actually said — the first rule',
  '# When they correct you',
  '# How you speak',
  '# Shape of the conversation',
  '# Turn-taking',
  '# Where you are in the conversation',
  '# Language',
  '# Voice delivery',
  '# Approaches you may draw on',
  '# Goals and follow-ups',
  '# Memory',
  '# Worked contrasts',
  '# Safety',
  '# Human support',
  '# Never say',
  '# Opening',
] as const;

/** Compose the full instruction block for a session. */
export function buildNoorRealtimeInstructions(ctx: NoorSessionContext): string {
  return [
    IDENTITY(GUIDE_NAME),
    SCOPE,
    RESPONDING,
    CORRECTIONS,
    SPEAKING_STYLE,
    CONVERSATION_SHAPE,
    TURN_TAKING,
    METHOD_PROGRESSION,
    LANGUAGE(ctx.preferredLanguage),
    VOICE_DELIVERY,
    METHODS,
    GOALS_AND_FOLLOW_UPS,
    MEMORY(ctx),
    renderExamples(),
    SAFETY,
    HUMAN_SUPPORT,
    PROHIBITED,
    OPENING(ctx),
  ]
    .map((section) => section.trim())
    .join('\n\n');
}

/**
 * Instructions for the developer voice-audition page — deliberately minimal.
 * Identity and delivery only, so the audition tests the voice and not the
 * conversation.
 */
export function buildAuditionInstructions(): string {
  return [
    IDENTITY(GUIDE_NAME).trim(),
    VOICE_DELIVERY.trim(),
    '# Task',
    'You are being auditioned for voice quality. Read the line the developer sends you, exactly as written, once, in your natural speaking voice. Do not add a greeting, do not comment on the line, and do not ask a question afterwards.',
  ].join('\n\n');
}

export { EMPTY_SESSION_CONTEXT, type NoorSessionContext } from './context';
export { safetyStateInstruction } from './safetyRules';
export { transcriptionLanguagesFor } from './languageBehaviour';
export { NOOR_IDENTITY } from './identity';
export { BEHAVIOUR_EXAMPLES, type BehaviourExample } from './examples';
