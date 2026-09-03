import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAIRealtimeProvider } from './OpenAIRealtimeProvider';
import type { RealtimeError, RealtimeEvent } from './types';

/**
 * Barge-in and turn handling, exercised against a simulated WebRTC stack.
 *
 * The point of these tests is the interruption contract, which is the hardest
 * part of the realtime experience to get right and the easiest to regress:
 * when the member speaks over Noor, the buffered audio must be cleared, the
 * response cancelled, and the turn truncated to what was actually heard.
 */

interface SentEvent {
  type: string;
  [key: string]: unknown;
}

class FakeDataChannel {
  readyState: RTCDataChannelState = 'connecting';
  sent: SentEvent[] = [];
  private handlers = new Map<string, Set<(event: unknown) => void>>();

  addEventListener(name: string, handler: (event: unknown) => void): void {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(handler);
  }

  send(raw: string): void {
    this.sent.push(JSON.parse(raw) as SentEvent);
  }

  close(): void {
    this.readyState = 'closed';
  }

  /** Drive the channel as the transport would. */
  open(): void {
    this.readyState = 'open';
    this.fire('open', {});
  }

  serverEvent(event: Record<string, unknown>): void {
    this.fire('message', { data: JSON.stringify(event) });
  }

  private fire(name: string, event: unknown): void {
    for (const handler of this.handlers.get(name) ?? []) handler(event);
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
  localDescription: unknown = null;
  remoteDescription: unknown = null;

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
    return { type: 'offer', sdp: 'v=0 fake offer' };
  }
  async setLocalDescription(desc: unknown): Promise<void> {
    this.localDescription = desc;
  }
  async setRemoteDescription(desc: unknown): Promise<void> {
    this.remoteDescription = desc;
  }
  close(): void {
    this.connectionState = 'closed';
  }
}

const MINTED = {
  clientSecret: 'ek_test_secret',
  expiresAt: Date.now() + 120_000,
  model: 'gpt-realtime-2.1',
  voice: 'marin',
  callsUrl: 'https://api.openai.com/v1/realtime/calls',
};

function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/realtime/session')) {
      return new Response(JSON.stringify(MINTED), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/realtime/calls')) {
      return new Response('v=0 fake answer', { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const CONNECT_OPTIONS = {
  mode: 'text' as const, // no microphone needed for the transport contract
  preferredLanguage: 'en' as const,
  memoryContext: [],
  instructions: 'test instructions',
  openGently: false,
};

async function connectProvider() {
  const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => 'member-jwt' });
  const events: RealtimeEvent[] = [];
  provider.subscribe((event) => events.push(event));
  await provider.connect({ ...CONNECT_OPTIONS, greetFirst: false });
  channel.open();
  return { provider, events };
}

/** The server's acknowledgement that an item is now in the conversation. */
function ackItem(id: string, role: 'user' | 'assistant'): void {
  channel.serverEvent({ type: 'conversation.item.created', item: { id, role } });
}

/** Put Noor mid-sentence: a response is generating and audio is playing. */
function startNoorSpeaking(itemId = 'item_noor_1') {
  channel.serverEvent({ type: 'response.created' });
  channel.serverEvent({ type: 'response.output_item.added', item: { id: itemId } });
  channel.serverEvent({ type: 'response.output_audio_transcript.delta', delta: 'Sounds like a lot has been' });
  channel.serverEvent({ type: 'output_audio_buffer.started' });
}

beforeEach(() => {
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
  vi.stubGlobal('fetch', stubFetch());
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('connection', () => {
  it('mints a credential through our own backend and never receives an API key', async () => {
    const { events } = await connectProvider();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const tokenCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/realtime/session'));
    expect(tokenCall).toBeDefined();
    const init = tokenCall![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer member-jwt');
    // The SDP exchange is authorised with the ephemeral secret only.
    const sdpCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/realtime/calls'));
    const sdpInit = sdpCall![1] as RequestInit;
    expect((sdpInit.headers as Record<string, string>).Authorization).toBe(`Bearer ${MINTED.clientSecret}`);
    expect((sdpInit.headers as Record<string, string>)['content-type']).toBe('application/sdp');
    expect(events.some((e) => e.type === 'connection' && e.state === 'connected')).toBe(true);
  });

  it('sends the instructions on the data channel once it opens', async () => {
    await connectProvider();
    const update = channel.lastOfType('session.update');
    expect(update).toBeDefined();
    const session = update!.session as { instructions?: string; voice?: string; model?: string };
    expect(session.instructions).toBe('test instructions');
    // Voice and model are fixed server-side and must never be re-sent.
    expect(session.voice).toBeUndefined();
    expect(session.model).toBeUndefined();
  });

  it.each([
    [503, 'host configured but no API key'],
    [404, 'no server function deployed at all'],
  ])('reports not_configured on %i (%s) so the member is told the voice is unavailable', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status })));
    const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => null });
    await expect(
      provider.connect({
        mode: 'text',
        preferredLanguage: 'en',
        memoryContext: [],
        instructions: 'x',
        openGently: false,
      }),
    ).rejects.toMatchObject({ code: 'not_configured', recoverable: true });
  });

  const CONNECT = {
    mode: 'text' as const,
    preferredLanguage: 'en' as const,
    memoryContext: [],
    instructions: 'x',
    openGently: false,
  };

  it('reports not signed in when real auth exists and no token was sent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'unauthorised', reason: 'no_token' }), { status: 401 })),
    );
    const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => null, canAuthenticate: true });
    await expect(provider.connect(CONNECT)).rejects.toMatchObject({
      code: 'not_signed_in',
      recoverable: false,
    });
  });

  it('reports an expired session distinctly when the token was rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ error: 'unauthorised', reason: 'token_rejected' }), { status: 401 }),
      ),
    );
    const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => 'stale', canAuthenticate: true });
    await expect(provider.connect(CONNECT)).rejects.toMatchObject({
      code: 'session_expired',
      recoverable: false,
    });
  });

  /**
   * Without real auth there is no member identity to send, so the member
   * cannot fix a 401 by signing in. It must read as "no realtime here" — not
   * as a sign-in prompt to someone who is already "logged in".
   */
  it('treats a 401 as "no realtime here" when the deployment has no real auth', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401 })));
    const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => null, canAuthenticate: false });
    await expect(provider.connect(CONNECT)).rejects.toMatchObject({
      code: 'not_configured',
      recoverable: true,
    });
  });

  it('reports not_configured rather than a parse error when a rewrite serves HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<!doctype html><html><body>index</body></html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      ),
    );
    const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => 'jwt', canAuthenticate: true });
    await expect(provider.connect(CONNECT)).rejects.toMatchObject({
      code: 'not_configured',
      recoverable: true,
    });
  });

  it('never shows an internal server message for a 500', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('TypeError at line 42 of handler.js', { status: 500 })));
    const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => 'jwt', canAuthenticate: true });
    const error = await provider.connect(CONNECT).then(
      () => null,
      (e: unknown) => e as RealtimeError,
    );
    expect(error).not.toBeNull();
    if (!error) return;
    expect(error.code).toBe('credential_failed');
    expect(error.message).not.toMatch(/TypeError|handler\.js/);
    expect(error.message).toContain("Noor's voice session");
  });
});

describe('barge-in', () => {
  it('clears audio, cancels the response and truncates the turn when the member speaks over Noor', async () => {
    const { events } = await connectProvider();
    startNoorSpeaking('item_noor_1');
    expect(events.some((e) => e.type === 'assistant_speech_started')).toBe(true);

    // The member starts talking ~3 seconds in.
    await new Promise((resolve) => setTimeout(resolve, 30));
    channel.serverEvent({ type: 'input_audio_buffer.speech_started' });

    const types = channel.sentTypes();
    expect(types).toContain('output_audio_buffer.clear');
    expect(types).toContain('response.cancel');
    expect(types).toContain('conversation.item.truncate');

    // Order matters: silence the speaker before anything else.
    expect(types.indexOf('output_audio_buffer.clear')).toBeLessThan(types.indexOf('response.cancel'));

    const truncate = channel.lastOfType('conversation.item.truncate')!;
    expect(truncate.item_id).toBe('item_noor_1');
    expect(truncate.content_index).toBe(0);
    // Truncated to the audio actually heard, not the whole generated turn.
    expect(truncate.audio_end_ms).toBeGreaterThan(0);
    expect(truncate.audio_end_ms).toBeLessThan(5_000);

    const stateEvents = events.filter((e): e is Extract<RealtimeEvent, { type: 'state' }> => e.type === 'state');
    expect(stateEvents.at(-1)?.state).toBe('interrupted');
  });

  it('records the interrupted turn as partial, not as a full sentence', async () => {
    const { events } = await connectProvider();
    startNoorSpeaking();
    channel.serverEvent({ type: 'input_audio_buffer.speech_started' });
    channel.serverEvent({ type: 'output_audio_buffer.cleared' });

    const stopped = events.find(
      (e): e is Extract<RealtimeEvent, { type: 'assistant_speech_stopped' }> => e.type === 'assistant_speech_stopped',
    );
    expect(stopped?.cancelled).toBe(true);

    const turn = events
      .filter((e): e is Extract<RealtimeEvent, { type: 'turn_completed' }> => e.type === 'turn_completed')
      .find((e) => e.turn.role === 'noor');
    expect(turn?.turn.text).toBe('Sounds like a lot has been—');
  });

  it('does nothing when the member is not actually talking over her', async () => {
    await connectProvider();
    // Noor is not speaking: a speech_started is just the member taking a turn.
    channel.serverEvent({ type: 'input_audio_buffer.speech_started' });
    expect(channel.sentTypes()).not.toContain('conversation.item.truncate');
    expect(channel.sentTypes()).not.toContain('response.cancel');
  });

  /**
   * The Phase 2 acceptance scenario: Noor begins a ~10 second answer and the
   * member starts speaking about 3 seconds in. The turn must be truncated to
   * roughly the 3 seconds that were actually heard — not to zero, and not to
   * the full generated length.
   */
  it('truncates to the audio heard when interrupted 3s into a 10s answer', async () => {
    vi.useFakeTimers();
    try {
      const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => 'jwt' });
      const events: RealtimeEvent[] = [];
      provider.subscribe((e) => events.push(e));
      const connecting = provider.connect({
        mode: 'text',
        preferredLanguage: 'en',
        memoryContext: [],
        instructions: 'i',
        openGently: false,
        greetFirst: false,
      });
      await vi.runOnlyPendingTimersAsync();
      await connecting;
      channel.open();

      channel.serverEvent({ type: 'response.created' });
      channel.serverEvent({ type: 'response.output_item.added', item: { id: 'item_long' } });
      channel.serverEvent({
        type: 'response.output_audio_transcript.delta',
        delta: 'That sounds like a lot to be carrying, and it makes sense that',
      });
      channel.serverEvent({ type: 'output_audio_buffer.started' });

      // 3 seconds of Noor's answer are heard.
      vi.advanceTimersByTime(3_000);
      channel.serverEvent({ type: 'input_audio_buffer.speech_started' });

      const truncate = channel.lastOfType('conversation.item.truncate')!;
      expect(truncate.item_id).toBe('item_long');
      expect(truncate.audio_end_ms).toBeGreaterThanOrEqual(2_900);
      expect(truncate.audio_end_ms).toBeLessThanOrEqual(3_200);

      // The floor returns to the member rather than sticking on "interrupted".
      vi.advanceTimersByTime(400);
      const states = events.filter((e): e is Extract<RealtimeEvent, { type: 'state' }> => e.type === 'state');
      expect(states.map((s) => s.state)).toContain('interrupted');
    } finally {
      vi.useRealTimers();
    }
  });

  it('manual interrupt() is a no-op unless Noor is speaking', async () => {
    const { provider } = await connectProvider();
    provider.interrupt();
    expect(channel.sentTypes()).not.toContain('output_audio_buffer.clear');

    startNoorSpeaking();
    provider.interrupt();
    expect(channel.sentTypes()).toContain('output_audio_buffer.clear');
  });
});

describe('turn transcripts', () => {
  it('emits completed user turns from the model transcription so safety screening sees speech', async () => {
    const { events } = await connectProvider();
    channel.serverEvent({
      type: 'conversation.item.input_audio_transcription.delta',
      item_id: 'item_user_1',
      delta: 'I have been ',
    });
    channel.serverEvent({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item_user_1',
      transcript: 'I have been overthinking everything at work.',
    });

    const completed = events
      .filter((e): e is Extract<RealtimeEvent, { type: 'turn_completed' }> => e.type === 'turn_completed')
      .filter((e) => e.turn.role === 'user');
    expect(completed).toHaveLength(1);
    expect(completed[0].turn.text).toBe('I have been overthinking everything at work.');
    expect(completed[0].turn.language).toBe('en');
  });

  it('detects the register of a mixed Urdu-English turn', async () => {
    const { events } = await connectProvider();
    channel.serverEvent({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item_user_2',
      transcript: 'Work ka pressure bohat zyada hai and honestly mujhe lagta hai ke main switch off hi nahi kar pata',
    });
    const turn = events
      .filter((e): e is Extract<RealtimeEvent, { type: 'turn_completed' }> => e.type === 'turn_completed')
      .at(-1);
    expect(turn?.turn.language).toBe('mixed');
  });

  it('a typed message becomes a user turn and asks for a spoken reply', async () => {
    const { provider, events } = await connectProvider();
    provider.sendText('mera dimagh bohat overthink kar raha hai');

    const create = channel.lastOfType('conversation.item.create')!;
    const item = create.item as { id: string; content: Array<{ type: string; text: string }>; role: string };
    expect(item.role).toBe('user');
    expect(item.content[0]).toEqual({ type: 'input_text', text: 'mera dimagh bohat overthink kar raha hai' });

    // The reply is requested only once the turn is really in the conversation.
    ackItem(item.id, 'user');
    expect(channel.sentTypes()).toContain('response.create');

    const turn = events
      .filter((e): e is Extract<RealtimeEvent, { type: 'turn_completed' }> => e.type === 'turn_completed')
      .at(-1);
    expect(turn?.turn.role).toBe('user');
    // "overthink" inside an Urdu sentence is code-switching, not English.
    expect(turn?.turn.language).toBe('mixed');
  });
});

/**
 * Event ordering — the guard against a reply that answers nothing.
 *
 * A `response.create` sent before the member's turn is part of the
 * conversation asks the model to speak with no new input to speak about. The
 * answer it produces is generic by construction, which is indistinguishable
 * from a canned reply and was one of the suspects for Noor sounding
 * pre-written.
 */
describe('turn ordering', () => {
  it('never asks for a reply before the member’s typed turn is committed', async () => {
    const { provider } = await connectProvider();
    provider.sendText('I have an important interview tomorrow');

    // Nothing has been acknowledged yet: no reply may be requested.
    expect(channel.sentTypes()).not.toContain('response.create');

    const item = (channel.lastOfType('conversation.item.create')!.item as { id: string }).id;
    ackItem(item, 'user');

    const types = channel.sentTypes();
    expect(types).toContain('response.create');
    // …and in this order, so the model always has the turn before the request.
    expect(types.indexOf('conversation.item.create')).toBeLessThan(types.indexOf('response.create'));
  });

  it('asks for a reply anyway if the acknowledgement never arrives', async () => {
    vi.useFakeTimers();
    try {
      const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => 'jwt' });
      const connecting = provider.connect({ ...CONNECT_OPTIONS, greetFirst: false });
      await vi.runOnlyPendingTimersAsync();
      await connecting;
      channel.open();

      provider.sendText('are you there?');
      expect(channel.sentTypes()).not.toContain('response.create');
      // The member is owed an answer more than we are owed an ordered log.
      vi.advanceTimersByTime(2_100);
      expect(channel.sentTypes()).toContain('response.create');
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends nothing at all for an empty message, and substitutes no placeholder', async () => {
    const { provider } = await connectProvider();
    provider.sendText('   ');
    expect(channel.sentTypes()).not.toContain('conversation.item.create');
    expect(channel.sentTypes()).not.toContain('response.create');
  });

  /**
   * Each spoken turn is committed by the server and answered on its own. The
   * session is never rebuilt between turns: a `session.update` per VAD cycle
   * would discard the conversation and leave Noor answering every turn as if
   * it were the first thing she had heard.
   */
  it('accumulates spoken turns in one session without resetting it', async () => {
    const { events } = await connectProvider();
    const updatesAfterOpen = channel.sentTypes().filter((t) => t === 'session.update').length;

    const turns = [
      "I've been really stressed about work.",
      "It's mostly because of my manager.",
      'He messages me after 10 PM almost every night.',
      "And then I can't switch my brain off when I go to bed.",
    ];
    turns.forEach((text, i) => {
      channel.serverEvent({ type: 'input_audio_buffer.speech_started' });
      channel.serverEvent({ type: 'input_audio_buffer.speech_stopped' });
      channel.serverEvent({ type: 'input_audio_buffer.committed', item_id: `item_u${i}` });
      channel.serverEvent({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: `item_u${i}`,
        transcript: text,
      });
      channel.serverEvent({ type: 'response.created' });
      channel.serverEvent({ type: 'response.done', response: { status: 'completed' } });
    });

    // No extra session.update, and no client-side response.create: semantic
    // VAD asks for the reply itself once the turn is committed.
    expect(channel.sentTypes().filter((t) => t === 'session.update').length).toBe(updatesAfterOpen);
    expect(channel.sentTypes()).not.toContain('response.create');

    const userTurns = events
      .filter((e): e is Extract<RealtimeEvent, { type: 'turn_completed' }> => e.type === 'turn_completed')
      .filter((e) => e.turn.role === 'user')
      .map((e) => e.turn.text);
    expect(userTurns).toEqual(turns);
  });
});

/**
 * Reconnection — the within-session memory that used to be lost.
 *
 * A realtime session's history lives on the server and dies with it. Minting
 * a replacement without re-seeding gave the member a Noor who had never heard
 * of their sister, and who greeted them again mid-conversation.
 */
describe('reconnection', () => {
  it('re-seeds what was already said and does not start the conversation over', async () => {
    vi.useFakeTimers();
    try {
      const provider = new OpenAIRealtimeProvider({ getAccessToken: async () => 'jwt' });
      const connecting = provider.connect({ ...CONNECT_OPTIONS, greetFirst: true });
      await vi.runOnlyPendingTimersAsync();
      await connecting;
      channel.open();
      // A first session opens with a greeting request.
      expect(channel.sentTypes()).toContain('response.create');

      // The member tells Noor about their sister, and Noor answers.
      channel.serverEvent({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'item_u1',
        transcript: 'My sister has been going through a hard time.',
      });
      channel.serverEvent({ type: 'response.created' });
      channel.serverEvent({ type: 'response.output_item.added', item: { id: 'item_n1' } });
      channel.serverEvent({ type: 'response.output_audio_transcript.delta', delta: 'What has that been like for you?' });
      channel.serverEvent({ type: 'output_audio_buffer.started' });
      channel.serverEvent({ type: 'output_audio_buffer.stopped' });

      // The connection drops and the provider rebuilds the session.
      const before = channel;
      before.readyState = 'closed';
      (provider as unknown as { handleDropout(): void }).handleDropout();
      await vi.advanceTimersByTimeAsync(1_200);
      expect(channel).not.toBe(before);
      channel.open();

      // History is restored, in order, on the new session.
      const seeded = channel.sent.filter((e) => e.type === 'conversation.item.create');
      expect(seeded).toHaveLength(2);
      const roles = seeded.map((e) => (e.item as { role: string }).role);
      expect(roles).toEqual(['user', 'assistant']);
      const first = seeded[0].item as { content: Array<{ text: string }> };
      expect(first.content[0].text).toBe('My sister has been going through a hard time.');

      // History goes in before anything else is asked of the model…
      const types = channel.sentTypes();
      expect(types.indexOf('session.update')).toBeLessThan(types.indexOf('conversation.item.create'));
      // …and she does not greet a member she is already mid-conversation with.
      expect(types).not.toContain('response.create');

      const update = channel.lastOfType('session.update')!;
      const session = update.session as { instructions: string };
      expect(session.instructions).toContain('Do not greet the member');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('safety and lifecycle', () => {
  it('pushes a safety instruction update mid-session without touching voice or model', async () => {
    const { provider } = await connectProvider();
    provider.updateSafetyState('SAFETY_MODE');
    const update = channel.lastOfType('session.update')!;
    const session = update.session as { instructions: string; voice?: string; model?: string };
    expect(session.instructions).toContain('SAFETY MODE');
    expect(session.instructions).toContain('Stop all coaching');
    expect(session.voice).toBeUndefined();
    expect(session.model).toBeUndefined();
  });

  it('pausing stops Noor talking and muting is reported as such', async () => {
    const { provider, events } = await connectProvider();
    startNoorSpeaking();
    provider.pause();
    expect(channel.sentTypes()).toContain('output_audio_buffer.clear');
    expect(channel.sentTypes()).toContain('response.cancel');
    const stateEvents = events.filter((e): e is Extract<RealtimeEvent, { type: 'state' }> => e.type === 'state');
    expect(stateEvents.at(-1)?.state).toBe('paused');
  });

  it('disconnect tears the transport down and reports it', async () => {
    const { provider, events } = await connectProvider();
    await provider.disconnect();
    expect(channel.readyState).toBe('closed');
    expect(events.some((e) => e.type === 'connection' && e.state === 'disconnected')).toBe(true);
    const stateEvents = events.filter((e): e is Extract<RealtimeEvent, { type: 'state' }> => e.type === 'state');
    expect(stateEvents.at(-1)?.state).toBe('ended');
  });
});
