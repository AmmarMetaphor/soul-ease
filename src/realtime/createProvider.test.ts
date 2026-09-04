import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The scripted engine must be unreachable unless it was asked for.
 *
 * This is a regression test for a defect with a member-facing cost, not a
 * style preference. The scripted engine picks a reply from fixed line pools by
 * topic regex: tell it about a break-up and it can answer with the line it
 * keeps for overthinking; say you are having a fine day and it asks what is
 * wrong. When it was allowed to substitute for a realtime connection that
 * could not be made, members had that conversation believing it was Noor
 * listening to them.
 *
 * So: no missing credential, failed connection, absent Supabase, or any other
 * runtime condition may reach it. Only an explicit VITE_REALTIME_PROVIDER=demo
 * build, which announces itself in the UI.
 */

async function loadFactory(overrides: Record<string, string | boolean>) {
  vi.resetModules();
  vi.doMock('@/config/env', () => ({
    env: {
      supabaseConfigured: false,
      isDemoMode: false,
      isDev: false,
      devToolsEnabled: false,
      realtimeProvider: 'auto',
      ...overrides,
    },
    siteOrigin: () => 'https://soul-ease.test',
  }));
  return import('./createProvider');
}

afterEach(() => {
  vi.doUnmock('@/config/env');
  vi.resetModules();
});

describe('createRealtimeProvider', () => {
  it('runs the realtime model by default', async () => {
    const { createRealtimeProvider, scriptedDemoRequested } = await loadFactory({ realtimeProvider: 'auto' });
    expect(scriptedDemoRequested()).toBe(false);
    expect((await createRealtimeProvider({ getAccessToken: async () => 'jwt' })).kind).toBe('openai_realtime_webrtc');
  });

  it('runs the realtime model when it is pinned', async () => {
    const { createRealtimeProvider } = await loadFactory({ realtimeProvider: 'openai' });
    expect((await createRealtimeProvider({ getAccessToken: async () => 'jwt' })).kind).toBe('openai_realtime_webrtc');
  });

  /**
   * Missing Supabase is why members sign in as demo members and why the token
   * endpoint answers 503 — the exact state that used to produce a fabricated
   * conversation. It still runs the realtime provider, which reports the
   * failure honestly instead.
   */
  it('does not reach the scripted engine just because Supabase is absent', async () => {
    const { createRealtimeProvider, scriptedDemoRequested } = await loadFactory({
      realtimeProvider: 'auto',
      isDemoMode: true,
      supabaseConfigured: false,
    });
    expect(scriptedDemoRequested()).toBe(false);
    expect((await createRealtimeProvider({ getAccessToken: async () => null })).kind).toBe('openai_realtime_webrtc');
  });

  it('runs the scripted engine only when it is explicitly requested', async () => {
    const { createRealtimeProvider, scriptedDemoRequested } = await loadFactory({ realtimeProvider: 'demo' });
    expect(scriptedDemoRequested()).toBe(true);
    expect((await createRealtimeProvider({ getAccessToken: async () => null })).kind).toBe('demo');
  });

  it('exposes no way to substitute the scripted engine after a failure', async () => {
    const factory = await loadFactory({ realtimeProvider: 'auto' });
    // The old escape hatches. Their existence was the bug.
    expect(factory).not.toHaveProperty('createFallbackProvider');
    expect(factory).not.toHaveProperty('fallbackAllowed');
  });
});
