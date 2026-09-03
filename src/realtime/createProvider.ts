import { env } from '@/config/env';
import { DemoRealtimeProvider } from './DemoRealtimeProvider';
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
 * Default is `auto`: try the real realtime provider, and fall back to the
 * demo guide only if the deployment has no realtime credentials (the token
 * endpoint answers 503). Once credentials exist, live audio always wins —
 * the demo engine never speaks over a working realtime connection.
 *
 * `VITE_REALTIME_PROVIDER=demo` pins the demo guide for local UI work;
 * `openai` pins the realtime provider so a misconfiguration surfaces as an
 * error instead of silently degrading.
 */
export function createRealtimeProvider(deps: ProviderFactoryDeps): RealtimeConversationProvider {
  if (env.realtimeProvider === 'demo') return new DemoRealtimeProvider();
  return new OpenAIRealtimeProvider({
    getAccessToken: deps.getAccessToken,
    voiceOverride: deps.voiceOverride,
    // Demo mode has no member identity to send, so a refusal from the token
    // endpoint must not be reported to the member as a sign-in problem.
    canAuthenticate: !env.isDemoMode,
  });
}

/** True when the session controller may fall back to the demo guide. */
export function fallbackAllowed(): boolean {
  return env.realtimeProvider !== 'openai';
}

export function createFallbackProvider(): RealtimeConversationProvider {
  return new DemoRealtimeProvider();
}
