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
  /**
   * Input transcription model. Defaults to one that accepts a list of
   * possible languages, which is what Urdu-English code-switching needs.
   */
  OPENAI_TRANSCRIPTION_MODEL?: string;
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
/** Supports a list of possible input languages — see supportsLanguageList. */
export const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-transcribe';

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
  const transcriptionModel = resolveTranscriptionModel(env);
  return {
    model,
    voice,
    transcriptionModel,
    session: {
      type: 'realtime' as const,
      model,
      output_modalities: ['audio'],
      instructions: body.instructions,
      audio: {
        input: {
          transcription: {
            model: transcriptionModel,
            // A multi-language hint, so Urdu, English and a sentence that
            // switches between them mid-clause all transcribe correctly. Only
            // sent to models that accept it — see resolveTranscriptionModel.
            ...(supportsLanguageList(transcriptionModel) && body.languages && body.languages.length > 0
              ? { languages: body.languages }
              : {}),
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

/**
 * Transcription models that accept a list of possible input languages.
 *
 * This matters more than it looks. Pinning a single `language` would be wrong
 * for a Pakistani member — pin Urdu and their English clauses degrade, pin
 * English and their Urdu does — and a hint sent to a model that does not
 * support it is at best ignored. Members here switch language inside one
 * sentence, and a mistranscribed turn reaches the model as something the
 * member never said, which is one way a reply ends up answering nothing they
 * recognise.
 */
const LANGUAGE_LIST_MODELS = ['gpt-transcribe', 'gpt-live-transcribe'];

export function supportsLanguageList(transcriptionModel: string): boolean {
  return LANGUAGE_LIST_MODELS.includes(transcriptionModel);
}

export function resolveTranscriptionModel(env: RealtimeEnv): string {
  const configured = env.OPENAI_TRANSCRIPTION_MODEL?.trim();
  return configured || DEFAULT_TRANSCRIPTION_MODEL;
}

interface VerifiedCaller {
  userId: string | null;
  /** 'supabase' when a member JWT was validated, 'preview' when explicitly allowed. */
  via: 'supabase' | 'preview';
}

/**
 * Why a caller could not be verified. These are deliberately distinct:
 *
 *  - `auth_not_configured` is a DEPLOYMENT problem. The server has no Supabase
 *    configuration, so it cannot verify anybody — including a member who is
 *    perfectly well signed in. Reporting this as "you need to sign in" sends
 *    the member off to fix something that is not theirs to fix, which is the
 *    bug this distinction exists to prevent.
 *  - `no_token` means the request genuinely arrived without a bearer token.
 *  - `token_rejected` means Supabase declined the token (invalid or expired).
 *  - `auth_unreachable` means Supabase itself could not be reached.
 */
export type VerifyFailure = 'auth_not_configured' | 'no_token' | 'token_rejected' | 'auth_unreachable';

type VerifyResult = { ok: true; caller: VerifiedCaller } | { ok: false; failure: VerifyFailure };

async function verifyCaller(request: Request, env: RealtimeEnv): Promise<VerifyResult> {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const anonKey = env.SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !anonKey) {
    // An explicit preview opt-in is the only way to mint without a member.
    if (env.ALLOW_UNAUTHENTICATED_REALTIME?.trim().toLowerCase() === 'true') {
      return { ok: true, caller: { userId: null, via: 'preview' } };
    }
    return { ok: false, failure: 'auth_not_configured' };
  }

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, failure: 'no_token' };

  // Plain fetch against Supabase's user endpoint — no SDK, so this bundles
  // identically on every host. The anon key alone grants nothing; the JWT is
  // what identifies the member.
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
  } catch {
    return { ok: false, failure: 'auth_unreachable' };
  }
  if (!response.ok) return { ok: false, failure: 'token_rejected' };
  const user = (await response.json()) as { id?: string };
  if (!user?.id) return { ok: false, failure: 'token_rejected' };
  return { ok: true, caller: { userId: user.id, via: 'supabase' } };
}

/**
 * Configuration readiness — booleans only, never a value.
 *
 * Served on GET so an operator can see at a glance which variables a
 * deployment is actually missing, which is otherwise invisible from the
 * outside and easy to get wrong per deploy context (production vs preview).
 */
export function readinessReport(env: RealtimeEnv) {
  const openaiConfigured = !!env.OPENAI_API_KEY?.trim();
  const supabaseConfigured = !!env.SUPABASE_URL?.trim() && !!env.SUPABASE_ANON_KEY?.trim();
  const previewOptIn = env.ALLOW_UNAUTHENTICATED_REALTIME?.trim().toLowerCase() === 'true';
  const missing: string[] = [];
  if (!openaiConfigured) missing.push('OPENAI_API_KEY');
  if (!supabaseConfigured && !previewOptIn) {
    if (!env.SUPABASE_URL?.trim()) missing.push('SUPABASE_URL');
    if (!env.SUPABASE_ANON_KEY?.trim()) missing.push('SUPABASE_ANON_KEY');
  }
  return {
    endpoint: 'realtime-session',
    realtimeReady: openaiConfigured && (supabaseConfigured || previewOptIn),
    openaiConfigured,
    supabaseVerificationConfigured: supabaseConfigured,
    unauthenticatedPreviewOptIn: previewOptIn,
    model: env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_REALTIME_MODEL,
    voice: resolveVoice(undefined, env),
    transcriptionModel: resolveTranscriptionModel(env),
    missing,
  };
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
 *   401 the CALLER is at fault — no token, or a token Supabase rejected
 *   503 realtime is not available right now — either this DEPLOYMENT cannot do
 *       it (no API key, or no way to verify members) or the upstream account is
 *       rate-limited/out of quota (`reason: 'upstream_rate_limited'`). The
 *       client tells the member the voice is unavailable and does not
 *       substitute anything for the conversation.
 *   502 upstream refused or returned an unexpected payload
 *   200 { clientSecret, expiresAt, model, voice, callsUrl }
 *
 * The 401/503 split matters: a misconfigured deployment must never tell a
 * signed-in member that they are not signed in.
 */
export async function handleRealtimeSessionRequest(request: Request, env: RealtimeEnv): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { allow: 'GET, POST, OPTIONS' } });
  }
  // Readiness report: booleans only, so a deployment can be diagnosed from
  // the outside without exposing any value.
  if (request.method === 'GET') {
    return json(200, readinessReport(env));
  }
  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return json(503, {
      error: 'realtime_not_configured',
      reason: 'openai_key_missing',
      message: 'Realtime voice is not configured on this deployment.',
    });
  }

  const verified = await verifyCaller(request, env);
  if (!verified.ok) {
    switch (verified.failure) {
      case 'auth_not_configured':
        // A deployment problem, not the member's. 503 so the client offers a
        // working demo conversation instead of a misleading sign-in prompt.
        return json(503, {
          error: 'realtime_not_configured',
          reason: 'auth_not_configured',
          message: 'This deployment cannot verify members, so realtime voice is unavailable.',
        });
      case 'auth_unreachable':
        return json(503, {
          error: 'realtime_not_configured',
          reason: 'auth_unreachable',
          message: 'The sign-in service could not be reached, so realtime voice is unavailable.',
        });
      case 'token_rejected':
        return json(401, { error: 'unauthorised', reason: 'token_rejected' });
      case 'no_token':
      default:
        return json(401, { error: 'unauthorised', reason: 'no_token' });
    }
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
    // 429 is its own case. It means the account is rate-limited or has no
    // quota — the service is genuinely unavailable right now, and it is not
    // the member's connection, their sign-in, or a missing configuration.
    // Reporting it as any of those sends them to fix something that is not
    // theirs to fix. The status is passed on; the billing detail in the
    // upstream body is not.
    if (upstream.status === 429) {
      return json(503, {
        error: 'realtime_unavailable',
        reason: 'upstream_rate_limited',
        upstreamStatus: 429,
        message: 'The voice service is temporarily unavailable.',
      });
    }
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
