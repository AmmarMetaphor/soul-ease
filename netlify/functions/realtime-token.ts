/**
 * Netlify Function — POST /api/realtime/session
 *
 * Host adapter only; the logic is shared with the Cloudflare Pages Function
 * in functions/api/realtime/session.ts. Netlify's v2 functions receive a
 * Web-standard Request and return a Response, so the shared handler is used
 * verbatim.
 *
 * `process.env` is read here rather than inside the shared module so the
 * shared module stays runtime-agnostic (Cloudflare passes env explicitly).
 */
import { handleRealtimeSessionRequest, type RealtimeEnv } from '../../server/realtime/session';

export const config = {
  path: '/api/realtime/session',
};

function readEnv(): RealtimeEnv {
  const e = process.env;
  return {
    OPENAI_API_KEY: e.OPENAI_API_KEY,
    OPENAI_REALTIME_MODEL: e.OPENAI_REALTIME_MODEL,
    NOOR_VOICE: e.NOOR_VOICE,
    REALTIME_SECRET_TTL_SECONDS: e.REALTIME_SECRET_TTL_SECONDS,
    SUPABASE_URL: e.SUPABASE_URL ?? e.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: e.SUPABASE_ANON_KEY ?? e.VITE_SUPABASE_ANON_KEY,
    ALLOW_UNAUTHENTICATED_REALTIME: e.ALLOW_UNAUTHENTICATED_REALTIME,
  };
}

export default async function handler(request: Request): Promise<Response> {
  return handleRealtimeSessionRequest(request, readEnv());
}
