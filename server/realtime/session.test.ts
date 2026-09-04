import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_NOOR_VOICE,
  DEFAULT_REALTIME_MODEL,
  DEFAULT_TRANSCRIPTION_MODEL,
  buildSessionConfig,
  handleRealtimeSessionRequest,
  resolveTtlSeconds,
  resolveVoice,
  supportsLanguageList,
  type RealtimeEnv,
} from './session';

const BASE_ENV: RealtimeEnv = {
  OPENAI_API_KEY: 'sk-test-not-a-real-key',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
};

function post(body: unknown = {}, headers: Record<string, string> = { authorization: 'Bearer member-jwt' }): Request {
  return new Request('https://soul-ease.pages.dev/api/realtime/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

/** Supabase user lookup succeeds; OpenAI mints a secret. */
function stubHappyPath(capture?: { body?: unknown }) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-123' }), { status: 200 });
    }
    if (url.includes('/v1/realtime/client_secrets')) {
      if (capture) capture.body = JSON.parse(String(init?.body ?? '{}'));
      return new Response(
        JSON.stringify({
          value: 'ek_minted_secret',
          expires_at: 1_800_000_000,
          session: { model: DEFAULT_REALTIME_MODEL, audio: { output: { voice: DEFAULT_NOOR_VOICE } } },
        }),
        { status: 200 },
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resolveVoice', () => {
  it('defaults to marin', () => {
    expect(resolveVoice(undefined, {})).toBe('marin');
    expect(DEFAULT_NOOR_VOICE).toBe('marin');
  });
  it('honours the server configuration over the default', () => {
    expect(resolveVoice(undefined, { NOOR_VOICE: 'coral' })).toBe('coral');
  });
  it('lets a developer override for one session', () => {
    expect(resolveVoice('shimmer', { NOOR_VOICE: 'coral' })).toBe('shimmer');
  });
  it('rejects anything not on the supported list', () => {
    expect(resolveVoice('sinister-clown', {})).toBe('marin');
    expect(resolveVoice('', { NOOR_VOICE: 'nonsense' })).toBe('marin');
  });
});

describe('resolveTtlSeconds', () => {
  it('keeps the credential short-lived by default', () => {
    expect(resolveTtlSeconds({})).toBe(120);
  });
  it('accepts a sane override and ignores an absurd one', () => {
    expect(resolveTtlSeconds({ REALTIME_SECRET_TTL_SECONDS: '600' })).toBe(600);
    expect(resolveTtlSeconds({ REALTIME_SECRET_TTL_SECONDS: '99999999' })).toBe(120);
    expect(resolveTtlSeconds({ REALTIME_SECRET_TTL_SECONDS: 'soon' })).toBe(120);
  });
});

describe('buildSessionConfig', () => {
  it('uses semantic VAD with low eagerness so thinking pauses are respected', () => {
    const { session } = buildSessionConfig({}, BASE_ENV);
    expect(session.audio.input.turn_detection).toEqual({
      type: 'semantic_vad',
      eagerness: 'low',
      create_response: true,
      interrupt_response: true,
    });
  });

  it('requests audio output in Noor’s voice and asks for input transcription', () => {
    const { session, voice, model } = buildSessionConfig({ languages: ['en', 'ur'] }, BASE_ENV);
    expect(session.output_modalities).toEqual(['audio']);
    expect(session.audio.output.voice).toBe('marin');
    expect(voice).toBe('marin');
    expect(model).toBe(DEFAULT_REALTIME_MODEL);
    expect(session.model).toBe(DEFAULT_REALTIME_MODEL);
    // Transcription exists for the transcript view, memory, summaries and safety.
    expect(session.audio.input.transcription.model).toBe(DEFAULT_TRANSCRIPTION_MODEL);
    expect(session.audio.input.transcription.languages).toEqual(['en', 'ur']);
  });

  /**
   * A Pakistani member switches language inside a sentence. Both languages
   * must be offered to transcription — pin one and the other degrades — and a
   * mistranscribed turn reaches the model as words the member never said.
   */
  it('offers both languages to a transcription model that accepts a list', () => {
    expect(supportsLanguageList(DEFAULT_TRANSCRIPTION_MODEL)).toBe(true);
    const { session } = buildSessionConfig({ languages: ['ur', 'en'] }, BASE_ENV);
    expect(session.audio.input.transcription.languages).toEqual(['ur', 'en']);
    // Never a single pinned language, which would degrade the other.
    expect(session.audio.input.transcription).not.toHaveProperty('language');
  });

  it('omits the language list for a model that does not support it', () => {
    const env = { ...BASE_ENV, OPENAI_TRANSCRIPTION_MODEL: 'gpt-4o-transcribe' };
    expect(supportsLanguageList('gpt-4o-transcribe')).toBe(false);
    const { session } = buildSessionConfig({ languages: ['en', 'ur'] }, env);
    expect(session.audio.input.transcription.model).toBe('gpt-4o-transcribe');
    // Sending an unsupported parameter risks the whole mint being rejected.
    expect(session.audio.input.transcription.languages).toBeUndefined();
  });

  it('honours a configured model', () => {
    const { model } = buildSessionConfig({}, { ...BASE_ENV, OPENAI_REALTIME_MODEL: 'gpt-realtime-2' });
    expect(model).toBe('gpt-realtime-2');
  });

  it('passes Noor’s instructions through', () => {
    const { session } = buildSessionConfig({ instructions: 'You are Noor.' }, BASE_ENV);
    expect(session.instructions).toBe('You are Noor.');
  });
});

describe('handleRealtimeSessionRequest', () => {
  it('rejects anything but GET/POST', async () => {
    const response = await handleRealtimeSessionRequest(
      new Request('https://x/api/realtime/session', { method: 'DELETE' }),
      BASE_ENV,
    );
    expect(response.status).toBe(405);
  });

  describe('readiness report (GET)', () => {
    it('names the missing variables without exposing a single value', async () => {
      const response = await handleRealtimeSessionRequest(
        new Request('https://x/api/realtime/session', { method: 'GET' }),
        { OPENAI_REALTIME_MODEL: 'gpt-realtime-2.1' },
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toMatchObject({
        realtimeReady: false,
        openaiConfigured: false,
        supabaseVerificationConfigured: false,
      });
      expect(body.missing).toEqual(['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']);
      // Booleans and names only — never a secret value.
      const text = JSON.stringify(body);
      expect(text).not.toContain('sk-');
      expect(text).not.toContain('anon-key');
    });

    it('reports a fully configured deployment as ready', async () => {
      const response = await handleRealtimeSessionRequest(
        new Request('https://x/api/realtime/session', { method: 'GET' }),
        BASE_ENV,
      );
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toMatchObject({ realtimeReady: true, missing: [] });
      expect(JSON.stringify(body)).not.toContain(BASE_ENV.OPENAI_API_KEY!);
    });
  });

  it('answers 503 when the deployment has no API key, so the client falls back', async () => {
    const response = await handleRealtimeSessionRequest(post(), { ...BASE_ENV, OPENAI_API_KEY: undefined });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'realtime_not_configured' });
  });

  it('refuses a caller with no JWT when Supabase is configured', async () => {
    vi.stubGlobal('fetch', stubHappyPath());
    const response = await handleRealtimeSessionRequest(post({}, {}), BASE_ENV);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'unauthorised', reason: 'no_token' });
  });

  it('reports a rejected token distinctly, so the UI can say "signed out" not "not signed in"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/auth/v1/user')) return new Response('nope', { status: 401 });
        throw new Error('should not reach OpenAI');
      }),
    );
    const response = await handleRealtimeSessionRequest(post(), BASE_ENV);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ reason: 'token_rejected' });
  });

  /**
   * The Deploy Preview bug: a member was genuinely signed in and sent a valid
   * bearer token, but the deployment had no SUPABASE_URL/ANON_KEY, so the
   * server could not verify anyone and answered 401 — which the UI showed as
   * "You need to be signed in". A deployment problem must never be reported
   * as the member's auth problem.
   */
  it('does NOT return 401 when the server itself cannot verify anyone', async () => {
    const response = await handleRealtimeSessionRequest(post(), { OPENAI_API_KEY: 'sk-test' });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: 'realtime_not_configured',
      reason: 'auth_not_configured',
    });
  });

  it('treats an unreachable auth service as a deployment problem, not a sign-in problem', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/auth/v1/user')) throw new Error('network down');
        throw new Error('should not reach OpenAI');
      }),
    );
    const response = await handleRealtimeSessionRequest(post(), BASE_ENV);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ reason: 'auth_unreachable' });
  });

  it('still refuses to mint without a verified member (verification is not bypassed)', async () => {
    // No Supabase config and no opt-in: the API key must never be reachable.
    const response = await handleRealtimeSessionRequest(post(), { OPENAI_API_KEY: 'sk-test' });
    expect(response.status).not.toBe(200);
  });

  it('allows an explicitly opted-in preview with no Supabase', async () => {
    vi.stubGlobal('fetch', stubHappyPath());
    const response = await handleRealtimeSessionRequest(post(), {
      OPENAI_API_KEY: 'sk-test',
      ALLOW_UNAUTHENTICATED_REALTIME: 'true',
    });
    expect(response.status).toBe(200);
  });

  it('mints a client secret and returns only browser-safe fields', async () => {
    const capture: { body?: unknown } = {};
    vi.stubGlobal('fetch', stubHappyPath(capture));
    const response = await handleRealtimeSessionRequest(post({ instructions: 'You are Noor.' }), BASE_ENV);
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      clientSecret: 'ek_minted_secret',
      expiresAt: 1_800_000_000_000,
      model: DEFAULT_REALTIME_MODEL,
      voice: 'marin',
      callsUrl: 'https://api.openai.com/v1/realtime/calls',
    });
    // The permanent key is never echoed back to the browser.
    expect(JSON.stringify(body)).not.toContain('sk-test');

    // The upstream request carries a short expiry and the session config.
    const sent = capture.body as { expires_after?: { seconds?: number }; session?: { instructions?: string } };
    expect(sent.expires_after?.seconds).toBe(120);
    expect(sent.session?.instructions).toBe('You are Noor.');
  });

  it('reports 502 without leaking the upstream body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/auth/v1/user')) return new Response(JSON.stringify({ id: 'u' }), { status: 200 });
        return new Response('sk-test-leak inside upstream error', { status: 400 });
      }),
    );
    const response = await handleRealtimeSessionRequest(post(), BASE_ENV);
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain('sk-test-leak');
    expect(text).toContain('upstream_failed');
  });

  it('never caches a credential response', async () => {
    vi.stubGlobal('fetch', stubHappyPath());
    const response = await handleRealtimeSessionRequest(post(), BASE_ENV);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('ignores an unsupported developer voice override', async () => {
    const capture: { body?: unknown } = {};
    vi.stubGlobal('fetch', stubHappyPath(capture));
    await handleRealtimeSessionRequest(post({ voice: 'not-a-voice' }), BASE_ENV);
    const sent = capture.body as { session?: { audio?: { output?: { voice?: string } } } };
    expect(sent.session?.audio?.output?.voice).toBe('marin');
  });
});
