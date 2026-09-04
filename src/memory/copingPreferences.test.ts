import { describe, expect, it } from 'vitest';
import type { CopingPreference, CopingOutcome } from '@/data/types';
import { classifyCopingPreferences, isRejectedTool, selectOfferableTools } from './copingPreferences';

function pref(toolSlug: string, outcome: CopingOutcome): CopingPreference {
  return {
    id: `p-${toolSlug}`,
    userId: 'u1',
    toolSlug,
    outcome,
    note: null,
    sourceSessionId: null,
    suggestedAt: '2026-01-01T00:00:00Z',
    reportedAt: outcome === 'suggested' ? null : '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  };
}

describe('classifyCopingPreferences', () => {
  it('separates rejected, welcomed and never-reported approaches', () => {
    const result = classifyCopingPreferences([
      pref('box-breathing', 'tried_unhelpful'),
      pref('short-walk', 'tried_helpful'),
      pref('thought-check', 'suggested'),
      pref('journalling', 'unknown'),
    ]);
    expect(result.rejected).toEqual(['box-breathing']);
    expect(result.welcomed).toEqual(['short-walk']);
    expect(result.unreported).toEqual(['thought-check', 'journalling']);
  });

  /**
   * 'not_tried' is information about the week, not about the approach. Treating
   * it as a rejection would quietly retire a tool the member never actually
   * formed a view on.
   */
  it('treats "not tried" as neither a rejection nor an endorsement', () => {
    const result = classifyCopingPreferences([pref('grounding', 'not_tried')]);
    expect(result.rejected).toEqual([]);
    expect(result.welcomed).toEqual([]);
    expect(result.unreported).toEqual([]);
  });
});

describe('selectOfferableTools', () => {
  const preferences = [
    pref('box-breathing', 'tried_unhelpful'),
    pref('short-walk', 'tried_helpful'),
  ];

  /**
   * The rule this whole module exists for. Offering something a member has
   * already said did nothing for them is the clearest possible signal that
   * nobody was listening the first time.
   */
  it('never offers an approach the member said did not help', () => {
    const offered = selectOfferableTools(['box-breathing', 'thought-check', 'grounding'], preferences);
    expect(offered).not.toContain('box-breathing');
    expect(offered).toEqual(['thought-check', 'grounding']);
  });

  it('puts a previously helpful approach first without dropping the rest', () => {
    const offered = selectOfferableTools(['thought-check', 'grounding', 'short-walk'], preferences);
    expect(offered[0]).toBe('short-walk');
    expect(offered).toHaveLength(3);
  });

  it('preserves the caller’s own ordering within each group', () => {
    // This reorders by history; it does not decide relevance.
    const offered = selectOfferableTools(['grounding', 'thought-check', 'journalling'], preferences);
    expect(offered).toEqual(['grounding', 'thought-check', 'journalling']);
  });

  it('offers everything when nothing is known about the member', () => {
    expect(selectOfferableTools(['a', 'b'], [])).toEqual(['a', 'b']);
  });

  it('can return nothing rather than offering a rejected approach', () => {
    expect(selectOfferableTools(['box-breathing'], preferences)).toEqual([]);
  });
});

describe('isRejectedTool', () => {
  it('is true only for an approach reported as unhelpful', () => {
    const preferences = [
      pref('box-breathing', 'tried_unhelpful'),
      pref('short-walk', 'tried_helpful'),
      pref('grounding', 'not_tried'),
    ];
    expect(isRejectedTool('box-breathing', preferences)).toBe(true);
    expect(isRejectedTool('short-walk', preferences)).toBe(false);
    expect(isRejectedTool('grounding', preferences)).toBe(false);
    expect(isRejectedTool('never-mentioned', preferences)).toBe(false);
  });
});
