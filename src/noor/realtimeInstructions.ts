/**
 * Public entry point for Noor's system instructions.
 *
 * The specification itself lives in `src/noor/spec/` — one module per
 * behaviour (identity, scope, contextual response rules, conversational style,
 * language, methods, memory, safety, prohibited, examples). This file exists
 * so the rest of the application has a single stable import and never depends
 * on how the specification happens to be split up today.
 */
export {
  buildAuditionInstructions,
  buildNoorRealtimeInstructions,
  safetyStateInstruction,
  SPEC_SECTIONS,
  EMPTY_SESSION_CONTEXT,
  NOOR_IDENTITY,
  BEHAVIOUR_EXAMPLES,
  transcriptionLanguagesFor,
  type BehaviourExample,
  type NoorSessionContext,
} from './spec';
