import { env } from '@/config/env';
import { OpenAIRealtimeProvider } from './OpenAIRealtimeProvider';
import type { RealtimeConversationProvider } from './types';

export interface ProviderFactoryDeps {
  getAccessToken: () => Promise<string | null>;
  /** Developer-only voice override (audition page). */
  voiceOverride?: string;
}

/**
 * Chooses the conversation provider for a session.
 *
 * There is exactly one way to reach the scripted demo engine: asking for it
 * explicitly with `VITE_REALTIME_PROVIDER=demo`. Every other configuration
 * runs the real realtime model, and a realtime connection that cannot be
 * established is reported as such.
 *
 * This is deliberate, and it is the fix for a real defect. The scripted engine
 * answers from a small pool of pre-written lines chosen by topic regex. When it
 * was allowed to stand in for a missing realtime connection, members had a
 * conversation in which Noor said nearly the same thing whatever they told her
 * — and had no way to know they were not talking to the model. A fabricated
 * conversation is worse than an honest "not available": it is a wellbeing
 * product telling someone it is listening when it is pattern-matching.
 *
 * The demo engine's legitimate job is narrow: reviewing the session interface
 * (layout, states, barge-in affordances, transcript) with no credentials. It is
 * a UI harness, not a guide.
 *
 * It is loaded through a dynamic import, so a normal build does not contain
 * it at all: the pre-written lines are in a chunk that is only ever fetched by
 * a build that asked for them. "Must not substitute" becomes "cannot".
 */
export async function createRealtimeProvider(deps: ProviderFactoryDeps): Promise<RealtimeConversationProvider> {
  if (scriptedDemoRequested()) {
    const { DemoRealtimeProvider } = await import('./DemoRealtimeProvider');
    return new DemoRealtimeProvider();
  }
  return new OpenAIRealtimeProvider({
    getAccessToken: deps.getAccessToken,
    voiceOverride: deps.voiceOverride,
    // Demo mode has no member identity to send, so a refusal from the token
    // endpoint must not be reported to the member as a sign-in problem.
    canAuthenticate: !env.isDemoMode,
  });
}

/**
 * True only when this build was explicitly configured to run the scripted
 * demo engine. Never inferred from a missing credential, a failed connection,
 * or the absence of Supabase.
 */
export function scriptedDemoRequested(): boolean {
  return env.realtimeProvider === 'demo';
}
