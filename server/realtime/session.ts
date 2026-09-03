/**
 * Realtime session minting — shared, framework-agnostic core.
 *
 * Runs unchanged on Cloudflare Pages Functions / Workers and Netlify
 * Functions: it uses only Web-standard `fetch`, `Request` and `Response`.
 * The permanent OPENAI_API_KEY is read here, server-side, and never leaves
 * this module; the browser only ever receives a short-lived `ek_...` client
 * secret.
 *
 * Flow:
 *   browser  → POST /api/realtime/session  (with the member's Supabase JWT)
 *   this fn  → verify caller
 *   this fn  → POST https://api.openai.com/v1/realtime/client_secrets
 *   browser  ← { clientSecret, expiresAt, model, voice, callsUrl }
 *   browser  → POST {callsUrl}  (SDP offer, Authorization: Bearer ek_...)
 */

export interface RealtimeEnv {
  OPENAI_API_KEY?: string;
  OPENAI_REALTIME_MODEL?: string;
  NOOR_VOICE?: string;
  /** Seconds the ephemeral secret stays valid. Kept short by design. */
  REALTIME_SECRET_TTL_SECONDS?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  /**
   * Preview escape hatch. When Supabase is not configured there is no member
   * to authenticate, so the endpoint refuses by default rather than leaving
   * an open door to a paid API key. Set to 'true' only for a private preview.
   */
  ALLOW_UNAUTHENTICATED_REALTIME?: string;
}

export const DEFAULT_REALTIME_MODEL = 'gpt-realtime-2.1';
export const DEFAULT_NOOR_VOICE = 'marin';
export const DEFAULT_SECRET_TTL_SECONDS = 120;

const OPENAI_CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets';
const OPENAI_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';

/** Voices this deployment is willing to mint. Guards against arbitrary input. */
export const SUPPORTED_VOICES = [
  'marin',
  'cedar',
  'coral',
  'shimmer',
  'sage',
  'alloy',
  'ash',
  'ballad',
  'echo',
  'verse',
] as const;

export type SupportedVoice = (typeof SUPPORTED_VOICES)[number];

export interface MintRequestBody {
  /** Full system instructions for Noor, composed on the client per session. */
  instructions?: string;
  /**
   * Developer-only voice override, used by the audition page. Ignored unless
   * the value is in SUPPORTED_VOICES.
   */
  voice?: string;
  /** Hint for input transcription; the model still auto-detects. */
  languages?: string[];
}

export interface MintedSession {
  clientSecret: string;
  expiresAt: number;
  model: string;
  voice: string;
  callsUrl: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export function resolveVoice(requested: string | undefined, env: RealtimeEnv): string {
  const candidate = requested?.trim();
  if (candidate && (SUPPORTED_VOICES as readonly string[]).includes(candidate)) return candidate;
  const configured = env.NOOR_VOICE?.trim();
  if (configured && (SUPPORTED_VOICES as readonly string[]).includes(configured)) return configured;
  return DEFAULT_NOOR_VOICE;
}

export function resolveTtlSeconds(env: RealtimeEnv): number {
  const parsed = Number.parseInt(env.REALTIME_SECRET_TTL_SECONDS ?? '', 10);
  if (Number.isFinite(parsed) && parsed >= 10 && parsed <= 7200) return parsed;
  return DEFAULT_SECRET_TTL_SECONDS;
}

/**
 * Build the session configuration attached to the client secret.
 *
 * Voice and model are fixed here, server-side, because the Realtime API does
 * not allow changing either once a session has started producing audio.
 * Turn detection uses semantic VAD with low eagerness so Noor waits through
 * ordinary thinking pauses, while `interrupt_response` keeps barge-in alive.
 */
export function buildSessionConfig(body: MintRequestBody, env: RealtimeEnv) {
  const model = env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_REALTIME_MODEL;
  const voice = resolveVoice(body.voice, env);
  return {
    model,
    voice,
    session: {
      type: 'realtime' as const,
      model,
      output_modalities: ['audio'],
      instructions: body.instructions,
      audio: {
        input: {
          transcription: {
            // Multilingual transcription; Urdu and Roman-Urdu both arrive here.
            model: 'gpt-4o-transcribe',
            ...(body.languages && body.languages.length > 0 ? { languages: body.languages } : {}),
          },
          noise_reduction: { type: 'near_field' as const },
          turn_detection: {
            type: 'semantic_vad' as const,
            eagerness: 'low' as const,
            create_response: true,
            interrupt_response: true,
          },
        },
        output: {
          voice,
          speed: 1,
        },
      },
    },
  };
}

interface VerifiedCaller {
  userId: string | null;
  /** 'supabase' when a member JWT was validated, 'preview' when explicitly allowed. */
  via: 'supabase' | 'preview';
}

async function verifyCaller(request: Request, env: RealtimeEnv): Promise<VerifiedCaller | null> {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const anonKey = env.SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !anonKey) {
    return env.ALLOW_UNAUTHENTICATED_REALTIME?.trim().toLowerCase() === 'true'
      ? { userId: null, via: 'preview' }
      : null;
  }

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  // Plain fetch against Supabase's user endpoint — no SDK, so this bundles
  // identically on every host. The anon key alone grants nothing; the JWT is
  // what identifies the member.
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const user = (await response.json()) as { id?: string };
  if (!user?.id) return null;
  return { userId: user.id, via: 'supabase' };
}

async function readBody(request: Request): Promise<MintRequestBody> {
  try {
    const raw = (await request.json()) as MintRequestBody | null;
    if (!raw || typeof raw !== 'object') return {};
    return {
      instructions: typeof raw.instructions === 'string' ? raw.instructions.slice(0, 20_000) : undefined,
      voice: typeof raw.voice === 'string' ? raw.voice : undefined,
      languages: Array.isArray(raw.languages)
        ? raw.languages.filter((l): l is string => typeof l === 'string').slice(0, 4)
        : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * The single request handler both hosting adapters call.
 *
 * Status codes the client relies on:
 *   405 wrong method
 *   401 caller could not be verified
 *   503 realtime not configured on this deployment (falls back to demo)
 *   502 upstream refused or returned an unexpected payload
 *   200 { clientSecret, expiresAt, model, voice, callsUrl }
 */
export async function handleRealtimeSessionRequest(request: Request, env: RealtimeEnv): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  }
  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return json(503, {
      error: 'realtime_not_configured',
      message: 'Realtime voice is not configured on this deployment.',
    });
  }

  const caller = await verifyCaller(request, env);
  if (!caller) {
    return json(401, { error: 'unauthorised' });
  }

  const body = await readBody(request);
  const { model, voice, session } = buildSessionConfig(body, env);

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_CLIENT_SECRETS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: resolveTtlSeconds(env) },
        session,
      }),
    });
  } catch {
    return json(502, { error: 'upstream_unreachable' });
  }

  if (!upstream.ok) {
    // Deliberately does not forward the upstream body: it can echo request
    // content and we never want key-adjacent detail reaching the browser.
    return json(502, { error: 'upstream_failed', status: upstream.status });
  }

  const payload = (await upstream.json()) as {
    value?: string;
    expires_at?: number;
    session?: { model?: string; audio?: { output?: { voice?: string } } };
  };

  if (!payload.value) {
    return json(502, { error: 'upstream_payload_invalid' });
  }

  const minted: MintedSession = {
    clientSecret: payload.value,
    // The API reports seconds; the client works in milliseconds.
    expiresAt: (payload.expires_at ?? Math.floor(Date.now() / 1000) + resolveTtlSeconds(env)) * 1000,
    model: payload.session?.model ?? model,
    voice: payload.session?.audio?.output?.voice ?? voice,
    callsUrl: OPENAI_CALLS_URL,
  };

  return json(200, minted);
}
