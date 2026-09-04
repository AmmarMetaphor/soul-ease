/**
 * Soul Ease's three memory layers.
 *
 * Naming them explicitly matters, because they have different lifetimes,
 * different consent requirements, and different failure modes. Collapsing them
 * — treating everything said in a session as durable, or replaying whole
 * transcripts into every future conversation — is how a wellbeing product ends
 * up holding far more of someone's life than they agreed to hand over.
 *
 *  ┌─ 1. ACTIVE SESSION MEMORY ──────────────────────────────────────────┐
 *  │ Where:    inside the live realtime session, plus the provider's      │
 *  │           bounded turn history for reconnection                      │
 *  │ Lifetime: dies with the session                                      │
 *  │ Consent:  none needed — it is the conversation itself                │
 *  │ Purpose:  "she" still means the sister four turns later              │
 *  └──────────────────────────────────────────────────────────────────────┘
 *  ┌─ 2. SESSION SUMMARY ────────────────────────────────────────────────┐
 *  │ Where:    session_summaries, one row per session                     │
 *  │ Lifetime: as long as the account, unless deleted                     │
 *  │ Consent:  transcript_storage OR long_term_memory                     │
 *  │ Purpose:  the member can look back; the next session gets one line   │
 *  └──────────────────────────────────────────────────────────────────────┘
 *  ┌─ 3. APPROVED LONG-TERM MEMORY ──────────────────────────────────────┐
 *  │ Where:    memory_items, follow_up_items, goals, coping_preferences   │
 *  │ Lifetime: until the member deletes it                                │
 *  │ Consent:  long_term_memory, and each item individually approved      │
 *  │ Purpose:  continuity between conversations                           │
 *  └──────────────────────────────────────────────────────────────────────┘
 *
 * Nothing moves from layer 1 to layer 3 on its own. A session proposes
 * candidates (src/memory/candidates.ts), the member approves or discards them
 * on the summary screen, and only survivors persist. Deleting an item removes
 * it from the source of the context package, so it stops reaching the model on
 * the very next session — there is no separate cache to go stale.
 */

export type MemoryLayer = 'active_session' | 'session_summary' | 'approved_long_term';

export interface MemoryLayerSpec {
  layer: MemoryLayer;
  /** Where the data physically lives. */
  store: string;
  /** What ends it. */
  lifetime: string;
  /** Consent required before anything is written. */
  requiresConsent: 'none' | 'transcript_or_memory' | 'long_term_memory';
  /** Whether the member individually approves each item. */
  itemLevelApproval: boolean;
}

export const MEMORY_LAYERS: Record<MemoryLayer, MemoryLayerSpec> = {
  active_session: {
    layer: 'active_session',
    store: 'realtime session + provider turn buffer (in memory)',
    lifetime: 'ends with the session',
    requiresConsent: 'none',
    itemLevelApproval: false,
  },
  session_summary: {
    layer: 'session_summary',
    store: 'session_summaries',
    lifetime: 'until the member deletes the session',
    requiresConsent: 'transcript_or_memory',
    itemLevelApproval: false,
  },
  approved_long_term: {
    layer: 'approved_long_term',
    store: 'memory_items, follow_up_items, goals, coping_preferences',
    lifetime: 'until the member deletes it',
    requiresConsent: 'long_term_memory',
    itemLevelApproval: true,
  },
};
