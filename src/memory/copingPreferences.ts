import type { CopingPreference, CopingOutcome } from '@/data/types';

/**
 * Which approaches Noor may offer.
 *
 * The whole point is the negative case. Suggesting box breathing to someone
 * who already said box breathing did nothing for them is the clearest signal
 * available that nobody was listening the first time — worse than offering
 * nothing, because it undoes the trust the earlier conversation built.
 *
 * So this is a deny-list first and a preference list second: a rejected
 * approach is excluded permanently unless the member themselves says otherwise,
 * while a helpful one is only a nudge in the ordering.
 */

/** Outcomes that mean "do not offer this again". */
const REJECTED: CopingOutcome[] = ['tried_unhelpful'];

/** Outcomes that mean "this landed well before". */
const WELCOMED: CopingOutcome[] = ['tried_helpful'];

export interface ToolSelection {
  /** Slugs Noor must never suggest again. */
  rejected: string[];
  /** Slugs the member found helpful, worth reaching for first. */
  welcomed: string[];
  /** Suggested previously but never reported on — fine to revisit, gently. */
  unreported: string[];
}

export function classifyCopingPreferences(preferences: CopingPreference[]): ToolSelection {
  const rejected: string[] = [];
  const welcomed: string[] = [];
  const unreported: string[] = [];
  for (const p of preferences) {
    if (REJECTED.includes(p.outcome)) rejected.push(p.toolSlug);
    else if (WELCOMED.includes(p.outcome)) welcomed.push(p.toolSlug);
    else if (p.outcome === 'suggested' || p.outcome === 'unknown') unreported.push(p.toolSlug);
    // 'not_tried' is deliberately in none of these: the member told us they
    // did not try it, which is neither a rejection of the approach nor
    // evidence it helps. It may be offered again without special weight.
  }
  return { rejected, welcomed, unreported };
}

/**
 * Filter a candidate list of tool slugs down to what may be offered, ordered
 * so anything that has helped this member before comes first.
 *
 * Ordering is stable within each group, so the caller's own relevance ranking
 * survives — this reorders by history, it does not decide relevance.
 */
export function selectOfferableTools(candidates: string[], preferences: CopingPreference[]): string[] {
  const { rejected, welcomed } = classifyCopingPreferences(preferences);
  const rejectedSet = new Set(rejected);
  const welcomedSet = new Set(welcomed);
  const allowed = candidates.filter((slug) => !rejectedSet.has(slug));
  return [...allowed.filter((s) => welcomedSet.has(s)), ...allowed.filter((s) => !welcomedSet.has(s))];
}

/** True when this approach must not be suggested to this member again. */
export function isRejectedTool(slug: string, preferences: CopingPreference[]): boolean {
  return preferences.some((p) => p.toolSlug === slug && REJECTED.includes(p.outcome));
}
