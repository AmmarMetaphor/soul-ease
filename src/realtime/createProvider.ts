import { env } from '@/config/env';
import { DemoRealtimeProvider } from './DemoRealtimeProvider';
import { OpenAIRealtimeProvider } from './OpenAIRealtimeProvider';
import type { RealtimeConversationProvider } from './types';

export interface ProviderFactoryDeps {
  getAccessToken: () => Promise<string | null>;
}

/**
 * Chooses the conversation provider for a session.
 *
 * Demo mode, or an unset/`demo` VITE_REALTIME_PROVIDER, always yields the demo
 * provider. Selecting `openai` returns the Phase 2 scaffold; the session
 * controller catches its `not_configured` / `not_implemented` errors and falls
 * back to demo so the member always gets a working experience.
 */
export function createRealtimeProvider(deps: ProviderFactoryDeps): RealtimeConversationProvider {
  if (env.isDemoMode || env.realtimeProvider !== 'openai') {
    return new DemoRealtimeProvider();
  }
  return new OpenAIRealtimeProvider({ getAccessToken: deps.getAccessToken });
}

export function createFallbackProvider(): RealtimeConversationProvider {
  return new DemoRealtimeProvider();
}
