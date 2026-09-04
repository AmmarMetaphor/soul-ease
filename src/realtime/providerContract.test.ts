import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildNoorRealtimeInstructions, EMPTY_SESSION_CONTEXT } from '@/noor/realtimeInstructions';
import { buildMemoryContext } from '@/session/memoryContext';
import { DEFAULT_CONSENT_STATE } from '@/memory/permissions';
import { NOOR_VOICE } from './noorVoice';
import { OpenAIRealtimeProvider } from './OpenAIRealtimeProvider';
import type { RealtimeError, RealtimeEvent } from './types';

/**
 * Provider contract — what must be true of what we send, regardless of what
 * comes back.
 *
 * These run with no OpenAI access at all. They check the pipeline: that the
 * member's current turn reaches the provider, that prior turns are carried,
 * that approved memory is included and deleted memory is not, that the system
 * instructions are present, that Noor's voice is requested, that no scripted
 * path and no browser speech synthesis can activate, and that safety context
 * survives. Every one of these was a real defect at some point.
 *
 * What they do NOT check is whether Noor answers well, or sounds female, or
 * responds at all. That needs a live model — see
 * docs/LIVE_REALTIME_ACCEPTANCE.md.
 */

interface SentEvent {
  type: string;
  [key: string]: unknown;
}

class FakeDataChannel {
  readyState: RTCDataChannelState = 'connecting';
  sent: SentEvent[] = [];
  private handlers = new Map<string, Set<(e: unknown) => void>>();
  addEventListener(name: string, handler: (e: unknown) => void): void {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(handler);
  }
  send(raw: string): void {
    this.sent.push(JSON.parse(raw) as SentEvent);
  }
  close(): void {
    this.readyState = 'closed';
  }
  open(): void {
    this.readyState = 'open';
    for (const h of this.handlers.get('open') ?? []) h({});
  }
  serverEvent(event: Record<string, unknown>): void {
    for (const h of this.handlers.get('message') ?? []) h({ data: JSON.stringify(event) });
  }
  sentTypes(): string[] {
    return this.sent.map((e) => e.type);
  }
  lastOfType(type: string): SentEvent | undefined {
    return [...this.sent].reverse().find((e) => e.type === type);
  }
}

let channel: FakeDataChannel;

class FakePeerConnection {
  connectionState: RTCPeerConnectionState = 'new';
  iceConnectionState: RTCIceConnectionState = 'new';
  addEventListener(): void {}
  addTrack(): RTCRtpSender {
    return { replaceTrack: vi.fn() } as unknown as RTCRtpSender;
  }
  addTransceiver(): RTCRtpTransceiver {
    return { sender: { replaceTrack: vi.fn() } } as unknown as RTCRtpTransceiver;
  }
  createDataChannel(): FakeDataChannel {
    channel = new FakeDataChannel();
    return channel;
  }
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'offer', sdp: 'v=0 offer' };
  }
  async setLocalDescription(): Promise<void> {}
  async setRemoteDescription(): Promise<void> {}
  close(): void {
    this.connectionState = 'closed';
  }
}

/** Captured token-endpoint request bodies, so we can assert what was sent. */
let tokenRequests: Array<{ instructions?: string; voice?: string; languages?: string[] }> = [];

function stubFetch(voice = NOOR_VOICE) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/realtime/session')) {
      tokenRequests.push(JSON.parse(String(init?.body ?? '{}')));
      return new Response(
        JSON.stringify({
          clientSecret: 'ek_contract_test',
          expiresAt: Date.now() + 120_000,
          model: 'gpt-realtime-2.1',
          voice,
          callsUrl: 'https://api.openai.com/v1/realtime/calls',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.includes('/realtime/calls')) return new Response('v=0 answer', { status: 200 });
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const CONNECT = {
  mode: 'text' as const,
  preferredLanguage: 'en' as const,
  memoryContext: [] as string[],
  openGently: false,
};

async function connect(instructions: string, extra: Record<string, unknown> = {}) {
  const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => 'member-jwt' });
  const events: RealtimeEvent[] = [];
  provider.subscribe((e) => events.push(e));
  await provider.connect({ ...CONNECT, instructions, greetFirst: false, ...extra });
  channel.open();
  return { provider, events };
}

beforeEach(() => {
  tokenRequests = [];
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
  vi.stubGlobal('fetch', stubFetch());
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ─── The member's words reach the model ──────────────────────────────── */

describe('current user turn enters provider input', () => {
  it('sends the typed turn verbatim as a user message', async () => {
    const { provider } = await connect('instructions');
    provider.sendText('I have an interview tomorrow and I am terrified I will freeze.');
    const item = channel.lastOfType('conversation.item.create')!.item as {
      role: string;
      content: Array<{ type: string; text: string }>;
    };
    expect(item.role).toBe('user');
    expect(item.content[0].type).toBe('input_text');
    expect(item.content[0].text).toBe('I have an interview tomorrow and I am terrified I will freeze.');
  });

  it('substitutes nothing for a turn it could not understand', async () => {
    const { provider } = await connect('instructions');
    // Whitespace only: nothing is sent at all, and no placeholder stands in.
    provider.sendText('    ');
    expect(channel.sentTypes()).not.toContain('conversation.item.create');
    expect(channel.sentTypes()).not.toContain('response.create');
    // A garbled transcript is passed through as-is rather than replaced.
    provider.sendText('asdkj lkajsd');
    const item = channel.lastOfType('conversation.item.create')!.item as { content: Array<{ text: string }> };
    expect(item.content[0].text).toBe('asdkj lkajsd');
  });

  it('emits a completed user turn for spoken input, so safety screening sees it', async () => {
    const { events } = await connect('instructions');
    channel.serverEvent({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item_u1',
      transcript: 'I have not been sleeping.',
    });
    const turn = events
      .filter((e): e is Extract<RealtimeEvent, { type: 'turn_completed' }> => e.type === 'turn_completed')
      .at(-1);
    expect(turn?.turn.role).toBe('user');
    expect(turn?.turn.text).toBe('I have not been sleeping.');
  });
});

/* ─── Prior turns are carried, not lost ───────────────────────────────── */

describe('prior session turns are included appropriately', () => {
  it('does not re-send history while one session is healthy', async () => {
    const { events } = await connect('instructions');
    channel.serverEvent({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'u1',
      transcript: 'My sister and I argued.',
    });
    channel.serverEvent({ type: 'response.created' });
    channel.serverEvent({ type: 'response.output_item.added', item: { id: 'n1' } });
    channel.serverEvent({ type: 'response.output_audio_transcript.delta', delta: 'What happened between you?' });
    channel.serverEvent({ type: 'output_audio_buffer.started' });
    channel.serverEvent({ type: 'output_audio_buffer.stopped' });
    // The live session holds its own history: re-seeding it every turn would
    // duplicate the conversation.
    expect(channel.sent.filter((e) => e.type === 'conversation.item.create')).toHaveLength(0);
    expect(events.filter((e) => e.type === 'turn_completed')).toHaveLength(2);
  });

  it('re-seeds recent turns in order after a reconnection', async () => {
    vi.useFakeTimers();
    try {
      const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => 'jwt' });
      const connecting = provider.connect({ ...CONNECT, instructions: 'instructions', greetFirst: false });
      await vi.runOnlyPendingTimersAsync();
      await connecting;
      channel.open();

      channel.serverEvent({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'u1',
        transcript: 'My sister and I argued.',
      });
      channel.serverEvent({ type: 'response.created' });
      channel.serverEvent({ type: 'response.output_item.added', item: { id: 'n1' } });
      channel.serverEvent({ type: 'response.output_audio_transcript.delta', delta: 'What happened between you?' });
      channel.serverEvent({ type: 'output_audio_buffer.started' });
      channel.serverEvent({ type: 'output_audio_buffer.stopped' });

      const before = channel;
      (provider as unknown as { handleDropout(): void }).handleDropout();
      await vi.advanceTimersByTimeAsync(1_200);
      expect(channel).not.toBe(before);
      channel.open();

      const seeded = channel.sent.filter((e) => e.type === 'conversation.item.create');
      expect(seeded).toHaveLength(2);
      expect(seeded.map((e) => (e.item as { role: string }).role)).toEqual(['user', 'assistant']);
      expect((seeded[0].item as { content: Array<{ text: string }> }).content[0].text).toBe('My sister and I argued.');
      // History goes in before anything else is asked of the model.
      const types = channel.sentTypes();
      expect(types.indexOf('session.update')).toBeLessThan(types.indexOf('conversation.item.create'));
    } finally {
      vi.useRealTimers();
    }
  });
});

/* ─── Memory: what is included and what is not ────────────────────────── */

describe('approved memory is included and deleted memory is excluded', () => {
  const consent = { ...DEFAULT_CONSENT_STATE, core: true, longTermMemory: true };

  function contextWith(memoryContents: string[]) {
    return buildMemoryContext({
      profile: null,
      consent,
      memories: memoryContents.map((content, i) => ({
        id: `m${i}`,
        userId: 'u',
        category: 'context' as const,
        content,
        sourceSessionId: null,
        createdAt: '2026-01-01T00:00:00Z',
        lastReferencedAt: null,
      })),
      goals: [],
      followUps: [],
      copingPreferences: [],
      journalEntries: [],
      lastEndedSession: null,
      lastSummary: null,
      endedSessionCount: 1,
    });
  }

  it('sends approved memory in the instructions', async () => {
    const instructions = buildNoorRealtimeInstructions(contextWith(['Sister lives in Lahore']));
    await connect(instructions);
    expect(tokenRequests[0].instructions).toContain('Sister lives in Lahore');
  });

  /**
   * Deletion works by removing the row the context package is built from.
   * There is no second cache, so a deleted item cannot reach the model on the
   * next session — this test pins that mechanism rather than trusting it.
   */
  it('cannot send a memory that is no longer in the store', async () => {
    const before = buildNoorRealtimeInstructions(contextWith(['Was made redundant in March', 'Sister lives in Lahore']));
    expect(before).toContain('Was made redundant in March');

    const after = buildNoorRealtimeInstructions(contextWith(['Sister lives in Lahore']));
    expect(after).not.toContain('redundant');
    await connect(after);
    expect(tokenRequests[0].instructions).not.toContain('redundant');
    expect(tokenRequests[0].instructions).toContain('Sister lives in Lahore');
  });

  it('sends no memory at all when the member has not consented to it', () => {
    const withoutConsent = buildMemoryContext({
      profile: null,
      consent: { ...DEFAULT_CONSENT_STATE, core: true, longTermMemory: false },
      memories: [
        {
          id: 'm1',
          userId: 'u',
          category: 'context',
          content: 'Sister lives in Lahore',
          sourceSessionId: null,
          createdAt: '2026-01-01T00:00:00Z',
          lastReferencedAt: null,
        },
      ],
      goals: [],
      followUps: [],
      copingPreferences: [],
      journalEntries: [],
      lastEndedSession: null,
      lastSummary: null,
      endedSessionCount: 1,
    });
    expect(withoutConsent.memoryLines).toEqual([]);
    expect(buildNoorRealtimeInstructions(withoutConsent)).not.toContain('Lahore');
  });

  it('keeps the journal out unless journal access was granted', () => {
    const journalEntry = {
      id: 'j1',
      userId: 'u',
      title: null,
      body: 'I did not tell anyone about the argument',
      mood: null,
      sessionId: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const base = {
      profile: null,
      memories: [],
      goals: [],
      followUps: [],
      copingPreferences: [],
      journalEntries: [journalEntry],
      lastEndedSession: null,
      lastSummary: null,
      endedSessionCount: 1,
    };
    const denied = buildMemoryContext({ ...base, consent: { ...DEFAULT_CONSENT_STATE, core: true } });
    expect(denied.journalLines).toEqual([]);
    expect(buildNoorRealtimeInstructions(denied)).not.toContain('did not tell anyone');
    expect(buildNoorRealtimeInstructions(denied)).toMatch(/journal is private and you cannot see it/);

    const allowed = buildMemoryContext({
      ...base,
      consent: { ...DEFAULT_CONSENT_STATE, core: true, journalAiAccess: true },
    });
    expect(allowed.journalLines).toHaveLength(1);
    expect(buildNoorRealtimeInstructions(allowed)).toContain('did not tell anyone about the argument');
  });
});

/* ─── System instructions, voice, and the absence of stand-ins ────────── */

describe('system instructions are present', () => {
  it('sends the full specification, not a fragment', async () => {
    const instructions = buildNoorRealtimeInstructions(EMPTY_SESSION_CONTEXT);
    await connect(instructions);
    const sent = tokenRequests[0].instructions ?? '';
    expect(sent).toBe(instructions);
    for (const heading of ['# Identity', '# Answering what they actually said', '# Safety', '# Never say']) {
      expect(sent).toContain(heading);
    }
    // And repeated on the data channel once it opens, so a session.update
    // cannot leave the model running on nothing.
    const update = channel.lastOfType('session.update')!;
    expect((update.session as { instructions: string }).instructions).toBe(instructions);
  });
});

describe('voice configuration is passed', () => {
  it('never names a voice from the client on a member session', async () => {
    await connect('instructions');
    // The server decides. A client-chosen voice would let a member's browser
    // override Noor's identity.
    expect(tokenRequests[0].voice).toBeUndefined();
  });

  it('passes the developer override only when one was given', async () => {
    const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => 'jwt', voiceOverride: 'coral' });
    await provider.connect({ ...CONNECT, instructions: 'i', greetFirst: false });
    expect(tokenRequests[0].voice).toBe('coral');
  });

  it('reports back the voice the server actually minted', async () => {
    const { provider } = await connect('instructions');
    expect(provider.currentVoice).toBe(NOOR_VOICE);
    expect(provider.currentModel).toBe('gpt-realtime-2.1');
  });

  it('sends both languages for transcription so code-switching survives', async () => {
    await connect('instructions', { transcriptionLanguages: ['en', 'ur'] });
    expect(tokenRequests[0].languages).toEqual(['en', 'ur']);
  });
});

describe('no scripted path and no browser speech synthesis', () => {
  it('never touches speechSynthesis', async () => {
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        constructor(public text: string) {}
      },
    );
    const { provider } = await connect('instructions');
    provider.sendText('say something');
    channel.serverEvent({ type: 'response.created' });
    channel.serverEvent({ type: 'response.output_audio_transcript.delta', delta: 'Something.' });
    channel.serverEvent({ type: 'output_audio_buffer.started' });
    channel.serverEvent({ type: 'output_audio_buffer.stopped' });
    // Noor's audio is a WebRTC media track. A male browser voice reading text
    // is not a fallback; it is a different product.
    expect(speak).not.toHaveBeenCalled();
  });

  it('reports 429 as a temporary service problem, never as the member’s network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'realtime_unavailable', reason: 'upstream_rate_limited' }), {
            status: 503,
          }),
      ),
    );
    const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => 'jwt', canAuthenticate: true });
    const error = await provider.connect({ ...CONNECT, instructions: 'i' }).then(
      () => null,
      (e: unknown) => e as RealtimeError,
    );
    expect(error?.code).toBe('service_unavailable');
    expect(error?.message).not.toMatch(/internet|connection/i);
    expect(error?.recoverable).toBe(true);
  });

  it('reports a bare 429 the same way', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Too Many Requests', { status: 429 })));
    const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => 'jwt', canAuthenticate: true });
    const error = await provider.connect({ ...CONNECT, instructions: 'i' }).then(
      () => null,
      (e: unknown) => e as RealtimeError,
    );
    expect(error?.code).toBe('service_unavailable');
  });
});

/* ─── Safety context survives ─────────────────────────────────────────── */

describe('safety context is preserved', () => {
  it('pushes a stronger instruction mid-session without dropping the base spec', async () => {
    const instructions = buildNoorRealtimeInstructions(EMPTY_SESSION_CONTEXT);
    const { provider } = await connect(instructions);
    provider.updateSafetyState('SAFETY_MODE');
    const update = channel.lastOfType('session.update')!;
    const session = update.session as { instructions: string; voice?: string; model?: string };
    // The whole specification is still there — safety is added, not swapped in.
    expect(session.instructions).toContain('# Identity');
    expect(session.instructions).toContain('# Answering what they actually said');
    expect(session.instructions).toContain('SAFETY MODE');
    expect(session.instructions).toMatch(/Stop all coaching/);
    // Voice and model are never re-sent: the API forbids changing them.
    expect(session.voice).toBeUndefined();
    expect(session.model).toBeUndefined();
  });

  it('keeps the safety instruction after a reconnection', async () => {
    vi.useFakeTimers();
    try {
      const instructions = buildNoorRealtimeInstructions(EMPTY_SESSION_CONTEXT);
      const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => 'jwt' });
      const connecting = provider.connect({ ...CONNECT, instructions, greetFirst: false });
      await vi.runOnlyPendingTimersAsync();
      await connecting;
      channel.open();
      (provider as unknown as { handleDropout(): void }).handleDropout();
      await vi.advanceTimersByTimeAsync(1_200);
      channel.open();
      provider.updateSafetyState('SAFETY_MODE');
      const session = channel.lastOfType('session.update')!.session as { instructions: string };
      expect(session.instructions).toContain('SAFETY MODE');
      // …and the continuation note, so she does not greet mid-crisis.
      expect(session.instructions).toContain('Do not greet the member');
    } finally {
      vi.useRealTimers();
    }
  });

  it('states in the specification that memory may not discount a safety signal', () => {
    const text = buildNoorRealtimeInstructions(EMPTY_SESSION_CONTEXT);
    expect(text).toMatch(/Nothing you remember about this member may be used to soften, explain away or discount/);
  });
});
