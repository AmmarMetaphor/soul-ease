/**
 * POST /api/realtime/token
 *
 * Mints a short-lived realtime client credential for the signed-in member.
 * This is the ONLY place the permanent OPENAI_API_KEY may be read — it never
 * reaches the browser. The frontend exchanges the ephemeral secret for a
 * WebRTC session in Phase 2.
 *
 * Behaviour:
 *  - 405  method other than POST
 *  - 401  missing or invalid Supabase access token
 *  - 503  realtime not configured on this deployment (no OPENAI_API_KEY)
 *  - 502  upstream credential request failed
 *  - 200  { clientSecret, expiresAt, model }
 *
 * Phase 1 note: the upstream call is implemented against the documented
 * ephemeral-session endpoint but has not been exercised against a live
 * account in this phase. Treat it as scaffolding to be verified in Phase 2.
 */

import { createClient } from '@supabase/supabase-js';

export const config = {
  path: '/api/realtime/token',
};

const DEFAULT_MODEL = 'gpt-4o-realtime-preview';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function verifyMember(request: Request): Promise<{ userId: string } | null> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  // The anon key + the member's JWT is enough to validate the token; no
  // service-role credential is required.
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const member = await verifyMember(request);
  if (!member) {
    return json(401, { error: 'unauthorised' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(503, {
      error: 'realtime_not_configured',
      message: 'Realtime voice is not configured on this deployment.',
    });
  }

  const model = process.env.OPENAI_REALTIME_MODEL || DEFAULT_MODEL;

  try {
    const upstream = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        // Noor's instructions are supplied client-side per session via
        // session.update, so memory context never has to transit this function.
        modalities: ['audio', 'text'],
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: { type: 'server_vad' },
      }),
    });

    if (!upstream.ok) {
      return json(502, { error: 'upstream_failed', status: upstream.status });
    }

    const payload = (await upstream.json()) as {
      client_secret?: { value?: string; expires_at?: number };
      model?: string;
    };
    const secret = payload.client_secret?.value;
    const expiresAt = payload.client_secret?.expires_at;
    if (!secret || !expiresAt) {
      return json(502, { error: 'upstream_payload_invalid' });
    }

    return json(200, {
      clientSecret: secret,
      expiresAt: expiresAt * 1000,
      model: payload.model ?? model,
    });
  } catch {
    return json(502, { error: 'upstream_unreachable' });
  }
}
