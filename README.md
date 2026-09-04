# Soul Ease — Your AI-Guided Mental Wellbeing Companion

_A private space to talk, reflect and find your next step._

Soul Ease is a voice-first AI wellbeing companion for adults (18+) in Pakistan.
Members talk with **Noor**, the _Soul Ease AI Wellbeing Guide_, in English, Urdu
or naturally mixed Urdu-English about anxiety, low mood, stress, overthinking,
grief and relationship strain.

> **Soul Ease is not a medical product.** It does not diagnose, treat or
> prescribe, and Noor is never described as licensed, accredited or clinically
> qualified. It is not for emergencies. See `/safety` in the app.

**Phase 1** built the product foundation — onboarding, consent,
authentication, database schema, dashboard, session interface, summaries,
history, journal, goals, toolkit, memory management, Safety Mode architecture,
human-support scaffolding and a free-session entitlement.

**Phase 2** replaced the simulated voice with a genuine realtime
speech-to-speech conversation: the member's microphone goes straight to the
OpenAI Realtime model over WebRTC, Noor answers in her own voice, and the
member can interrupt her mid-sentence. See
[Realtime voice architecture](#realtime-voice-architecture).

---

## Contents

- [Stack](#stack)
- [Quick start (demo mode)](#quick-start-demo-mode)
- [Realtime voice architecture](#realtime-voice-architecture)
- [Environment variables](#environment-variables)
- [Verifying the conversation](#verifying-the-conversation)
- [Live realtime acceptance (pending)](docs/LIVE_REALTIME_ACCEPTANCE.md)
- [Supabase setup](#supabase-setup)
- [Cloudflare deployment](#cloudflare-deployment)
- [Netlify deployment](#netlify-deployment)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [Safety, privacy and clinical boundaries](#safety-privacy-and-clinical-boundaries)
- [Phase 1 limitations & Phase 2 scope](#phase-1-limitations--phase-2-scope)

---

## Stack

| Layer     | Choice                                                                        |
| --------- | ----------------------------------------------------------------------------- |
| Frontend  | React 19 · TypeScript · Vite 7 · Tailwind CSS 4 · React Router 7               |
| Voice     | OpenAI Realtime (`gpt-realtime-2.1`) over WebRTC, speech-to-speech             |
| Auth      | Supabase Auth (email/password, verification, reset) with a local demo fallback |
| Database  | Supabase PostgreSQL with Row Level Security (`supabase/migrations`)            |
| Server    | One shared handler (`server/realtime/session.ts`) with Cloudflare Pages Functions and Netlify Function adapters |
| Tests     | Vitest + Testing Library (140 tests)                                           |
| Hosting   | Cloudflare Pages or Netlify — no host-specific code in the app                  |

## Quick start (demo mode)

```bash
npm install
npm run dev
```

Open http://localhost:5173. With no Supabase variables set the app runs in
**DEMO MODE**: accounts and all wellbeing data live only in your browser's
localStorage and nothing leaves the device. Use **"Continue as demo member"** on
the sign-in page for an instant account, then walk through onboarding.

Without `OPENAI_API_KEY` the realtime endpoint answers 503 and the session
screen says plainly that Noor is not available. **Nothing stands in for the
conversation.** Everything else — safety resources, journal, goals, toolkit,
history — keeps working.

To review the session *interface* with no credentials at all, build with
`VITE_REALTIME_PROVIDER=demo`. That runs a scripted harness which replies from
fixed line pools in the browser's own voice, and says so in the session UI on
every turn. It is for looking at layout and states, not for holding a
conversation — see [Why there is no scripted stand-in](#why-there-is-no-scripted-stand-in).

## Realtime voice architecture

```
browser                     our server                  OpenAI
───────                     ──────────                  ──────
Start Conversation
  │
  ├─ POST /api/realtime/session ──►  verify Supabase JWT
  │   (member's JWT)                 read OPENAI_API_KEY  (server only)
  │                                  POST /v1/realtime/client_secrets ──►
  │  ◄── { clientSecret: ek_…,  ◄──  { value, expires_at, session }  ◄──
  │        model, voice, callsUrl }
  │
  ├─ getUserMedia() ── microphone track
  ├─ RTCPeerConnection + data channel "oai-events"
  ├─ POST {callsUrl}?model=…  (SDP offer, Bearer ek_…) ──────────────────►
  │  ◄── SDP answer ─────────────────────────────────────────────────────
  └─ live: mic track ⇄ Noor's voice track, events on the data channel
```

The permanent API key exists only in `server/realtime/session.ts`. The browser
holds a client secret that expires in 120 seconds by default
(`REALTIME_SECRET_TTL_SECONDS`) and grants nothing else. There is deliberately
no `VITE_OPENAI_API_KEY`.

### Not a record-and-upload pipeline

Audio is never recorded, uploaded, transcribed, generated and re-synthesised.
The microphone track streams to the model and its voice streams back. Text
transcripts arrive alongside the audio and are used only for the transcript
view, session memory, summaries and safety screening.

### Turn-taking and interruption

Turn detection is `semantic_vad` with `eagerness: "low"`, so Noor waits
through an ordinary thinking pause ("I've been feeling… really stressed
lately") instead of jumping into the gap. `create_response` and
`interrupt_response` are both on.

When the member speaks over Noor, `performBargeIn()` in
`src/realtime/OpenAIRealtimeProvider.ts` does three things in order:

1. `output_audio_buffer.clear` — silences the audio already buffered for the
   speaker, so she stops mid-word rather than after a round trip.
2. `response.cancel` — stops the model generating the rest of the turn.
3. `conversation.item.truncate` with `audio_end_ms` set to the audio actually
   played — so the conversation history reflects **what the member heard**,
   not the full sentence Noor had generated. Without this, Noor carries on as
   though the unheard half had been said.

The transcript records an interrupted turn with a trailing em dash.

### Noor's voice

One identity, one voice: `src/realtime/noorVoice.ts` (`NOOR_VOICE`, default
`marin` — a calm adult female voice). A session's voice is fixed when the
client secret is minted and cannot change mid-conversation, so it is chosen
server-side and never sent from a component. Members see no voice selector.

Developers can compare candidates at `/app/dev/voice` (guarded by
`VITE_ENABLE_DEV_TOOLS`), which speaks identical English, Urdu and mixed lines
through each voice on its own short session.

### Why there is no scripted stand-in

Noor's replies come from the realtime model reading what the member actually
said. There is no rule-based conversation engine in the product, and none may
be substituted when realtime is unavailable.

This is a rule with a history. A scripted engine used to stand in whenever the
token endpoint reported that the deployment could not do realtime. It chose a
reply from small pre-written pools using a topic regex, so it would answer a
break-up with the line it kept for overthinking, and answer "I'm actually okay
today" as though something were wrong. It spoke through browser
`speechSynthesis`. On screen it was a single grey line of small print. Members
had that conversation believing Noor was listening to them, and what they
noticed was that she said nearly the same thing whatever they told her.

Three things now hold the rule in place:

- **One entry point.** `createRealtimeProvider()` reaches the scripted harness
  only when `VITE_REALTIME_PROVIDER=demo`. No missing credential, failed
  connection, absent Supabase, or other runtime condition can select it.
- **Not in the bundle.** The harness loads through a dynamic import that a
  default build proves dead and drops. `npm run check:no-scripted-replies`
  fails the build if a pre-written line reaches `dist/`.
- **Never silent.** A `demo` build states in the session UI, on every turn,
  that the replies are pre-written examples and not Noor.

A realtime connection that cannot be established is reported as such: *"Noor is
not available right now"*, with the reason, an explanation that it is not the
member's fault, and the rest of the product still working. An honest closed door
is better than a room with a recording in it.

### Answering the member, not the topic

Two members who mention work stress must not receive the same reply. The
instruction block in `src/noor/realtimeInstructions.ts` opens with
`# Answering what they actually said`, before style or method, and requires:

- a concrete detail from the member's own turn (the event, the person, the
  timing — "tomorrow", "three months", "after ten at night", "she");
- the whole conversation carried forward, so a pronoun still resolves four
  turns later and later turns add to earlier ones;
- at most one question per turn, and consecutive turns doing different jobs;
- taking a member at their word when they say they are fine;
- saying plainly when a turn was not understood, rather than covering the gap
  with a general question about stress.

Openings are **described, never quoted**. A sample line in a system prompt gets
spoken verbatim, and a member who returns three times to the same first
sentence has learned that this is a recording. A test asserts the prompt
contains no quoted sentence long enough to be read aloud as a line.

### Preserving context within a session

A realtime session's history lives on the server and dies with the session. A
dropout used to mint a replacement and re-greet the member as a stranger, which
looks identical to Noor ignoring everything she had been told.

`reconnect()` now marks the new session as a continuation: the recent turns are
re-seeded as conversation items before anything else is asked of the model, the
opening greeting is suppressed, and the instruction block gains a `# Continuing`
note. Bounded to the last 12 turns.

Ordering is enforced rather than assumed. A typed turn becomes a
`conversation.item.create` and a reply is requested only once the server
acknowledges it with `conversation.item.created` (with a 2s fallback, because a
member who typed something is owed an answer). Spoken turns are committed and
answered by semantic VAD itself — the client sends no `response.create` for
them, and never re-sends `session.update` between turns.

An empty message sends nothing at all, and no placeholder is ever substituted
for a turn that was not understood.

### Noor's behavioural specification

Noor is built from instructions, context and evaluation — **not** fine-tuning.
The specification lives in `src/noor/spec/`, one module per behaviour, composed
by `spec/index.ts`:

| Module | What it governs |
| --- | --- |
| `identity.ts` | Who she is, and that she is an adult female AI with no invented biography |
| `scope.ts` | What she takes on; human support |
| `contextualResponseRules.ts` | Answering the person not the topic; corrections; turn-taking |
| `conversationalStyle.ts` | Short turns, one question, no stock openers |
| `languageBehaviour.ts` | English / Urdu / mixed, and transcription language hints |
| `therapeuticMethods.ts` | Approaches, the internal progression, goals and follow-ups |
| `memoryRules.ts` | What she may claim to know |
| `safetyRules.ts` | Safety, and that it outranks personalisation |
| `prohibited.ts` | The never-say list |
| `examples.ts` | Worked contrasts — member turn plus what to engage with |
| `context.ts` | The typed bounded context package |

Section order is deliberate: `# Answering what they actually said` comes before
any style or method rule, and `# Safety` appears after `# Memory` and states
explicitly that it overrides it. A test asserts the order.

**One Noor.** Voice and text compose the same specification — nothing branches
on interaction mode, and a test pins that.

The internal progression (LISTENING → UNDERSTANDING → CLARIFYING → REFLECTING
→ OPTIONAL INTERVENTION → ACTION) is never announced, never shown as a stage,
and may legitimately stop at LISTENING for a whole conversation.

### Memory architecture

Three layers, documented in `src/memory/layers.ts` because they have different
lifetimes and different consent requirements:

1. **Active session memory** — inside the realtime session plus the provider's
   bounded turn buffer for reconnection. Dies with the session.
2. **Session summary** — `session_summaries`, one structured row per session
   (`src/session/sessionOutcome.ts`). Needs transcript **or** memory consent.
3. **Approved long-term memory** — `memory_items`, `follow_up_items`, `goals`,
   `coping_preferences`. Needs memory consent *and* per-item approval.

Nothing promotes itself. A session proposes candidates
(`src/memory/candidates.ts`), the member approves or discards them on the
summary screen, and only survivors persist.

A new session starts from a **bounded context package**
(`src/session/memoryContext.ts`) — name, last-session gist, active goals, due
follow-ups, approved memory lines, coping history, and journal lines only if
journal access was granted. Whole transcripts are never replayed: a long
history buries the current turn and hands the model far more of someone's life
than the conversation needs. Excluded on purpose: transcripts, assessment
scores, safety history, mood notes.

**Deletion is real.** Removing an item removes the row the context package is
built from, so it stops reaching Noor on the very next session. There is no
second cache to purge, and a provider contract test pins that.

**Journal privacy** is its own consent (`journal_ai_access`), off by default
and not implied by transcript or memory consent. Writing something down is not
the same as saying it.

**Rejected coping approaches** (`src/memory/copingPreferences.ts`) are a
deny-list, and are read even when long-term memory is off — "do not suggest
this again" is an instruction about Noor's behaviour, not a stored personal
fact. Re-offering something a member already dismissed is the loudest way to
tell them nobody listened.

### Noor's portrait

`src/components/brand/NoorPortraitArt.tsx` — original vector artwork of an
adult South Asian woman in a dupatta, drawn for this product. Deliberately an
illustration rather than a photoreal render: Noor is fictional, and a photoreal
face invites a member to believe there is a woman behind it. No real person is
referenced, no medical coat, no clinical setting.

It appears on Meet Noor, the session gate, the live session, the session
summary and the dashboard's Talk-to-Noor card. The orb remains only as an
audio/level indicator and on pre-auth marketing screens. **The portrait never
animates** — Stage 3 excludes fake lip sync, so the ring moves and the face
does not.

A designed raster portrait can take over: drop the files into
`public/images/noor/` and set `VITE_NOOR_PORTRAIT_ASSET=true`.

### Evaluating the conversation

`src/noor/eval/` holds **36 semantic fixtures** — 10 English, 10 Urdu, 10 mixed
Urdu-English, plus continuity, correction, interruption, memory-recall,
deleted-memory, no-memory and rejected-coping cases.

Criteria are **concepts, never wording**. A fixture says a reply must engage
with "the interview" (satisfied by *interview*, *panel*, *tomorrow's meeting*)
and must not mention "an anxiety disorder". A test asserts no concept is long
enough to be an exact-sentence assertion in disguise.

`npm test` exercises the **grader**, not Noor: hand-written good and bad
replies prove each check can actually fail. A suite whose checks cannot fail is
worse than none, because it reports green.

Whether Noor's real replies pass is a live question. See
**[docs/LIVE_REALTIME_ACCEPTANCE.md](docs/LIVE_REALTIME_ACCEPTANCE.md)** —
currently **PENDING, blocked by HTTP 429**.

### Safety during voice

Safety screening runs on the transcripts the realtime model produces, so it
works identically whether the member spoke or typed
(`screenUserTurn` in `src/session/useSessionController.ts`). A state change
pushes a `session.update` that changes Noor's instructions mid-session —
voice and model are never re-sent, because the API does not allow it.

## Environment variables

Copy `.env.example` to `.env`. Only `VITE_`-prefixed variables reach the browser.

**Server-side only — never prefixed with `VITE_`:**

| Variable                         | Purpose                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `OPENAI_API_KEY`                 | Realtime voice. Absent → endpoint returns 503 and the app says Noor is unavailable.   |
| `OPENAI_REALTIME_MODEL`          | Realtime model. Default `gpt-realtime-2.1`.                                           |
| `OPENAI_TRANSCRIPTION_MODEL`     | Input transcription. Default `gpt-transcribe`, which accepts a list of languages.     |
| `NOOR_VOICE`                     | Noor's voice; the server decides. Default `marin`.                                    |
| `REALTIME_SECRET_TTL_SECONDS`    | Client-secret lifetime, 10–7200. Default `120`.                                       |
| `SUPABASE_URL`                   | Used to verify the caller's JWT before minting a realtime credential.                 |
| `SUPABASE_ANON_KEY`              | As above.                                                                             |
| `ALLOW_UNAUTHENTICATED_REALTIME` | Preview-only. Without Supabase the endpoint refuses by default; `true` opts in.       |

**Browser (`VITE_`):**

| Variable                      | Purpose                                                                     |
| ----------------------------- | --------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`           | Supabase project URL. Blank → demo mode.                                    |
| `VITE_SUPABASE_ANON_KEY`      | Supabase anon (public) key. Blank → demo mode.                              |
| `VITE_FREE_SESSION_ALLOWANCE` | Free sessions before the upgrade placeholder (default `3`).                 |
| `VITE_FORCE_DEMO_MODE`        | `true` forces demo mode even with Supabase configured.                      |
| `VITE_PUBLIC_SITE_URL`        | Site origin for auth email redirects (defaults to window origin).           |
| `VITE_REALTIME_PROVIDER`      | `auto` (default) and `openai` both run realtime. `demo` runs the scripted interface harness — interface review only, never for members. |
| `VITE_NOOR_VOICE`             | Client-side hint only; the server value decides. No member-facing selector. |
| `VITE_NOOR_PORTRAIT_ASSET`    | `true` only when a designed raster portrait exists; otherwise the vector artwork renders. |
| `VITE_ENABLE_DEV_TOOLS`       | Voice audition + realtime diagnostics. **Must stay false in production.**   |
| `VITE_ROUTER_MODE`            | `browser` (default) or `hash` for hosts with no SPA rewrite.                |

No secrets are committed. The `service_role` key is never used anywhere, and
there is no `VITE_OPENAI_API_KEY`.

## Supabase setup

Full instructions live in [`supabase/README.md`](supabase/README.md). Summary:

1. Create a Supabase project and copy the URL + anon key into `.env`.
2. **Apply the schema — the app does not work until you do.** Run both
   migrations, in order, in the SQL editor (or `supabase db push`):
   - `20260903000001_phase1_schema.sql` — 15 tables, every RLS policy, the
     `handle_new_user` trigger, and the `start_wellbeing_session`,
     `end_wellbeing_session` and `delete_my_account` functions.
   - `20260904000002_stage3_memory.sql` — `follow_up_items`,
     `coping_preferences`, the `journal_ai_access` consent type and two new
     memory categories.

   Both are safe to run more than once, and order-independent after the first.
3. In **Authentication → URL configuration** add your site URL and the
   `/verify-email` and `/reset-password` redirect URLs (local + Netlify).

Configuring the environment variables is not the same as provisioning the
database. With the variables set but the schema missing, sign-in succeeds and
then every screen fails with `Could not find the table 'public.<name>' in the
schema cache` — that message means the API is reachable and empty, not that
the credentials are wrong.

## Cloudflare deployment

Cloudflare Pages serves the SPA and runs the realtime endpoint as a Pages
Function — no Netlify-only dependency is involved.

1. **Workers & Pages → Create → Pages → Connect to Git**, choose the repo.
2. Build settings:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: 20 or later (set `NODE_VERSION=22` if needed)
3. **Settings → Variables and Secrets** — add the server-side variables from
   the table above as **Secrets** (`OPENAI_API_KEY`, `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, and optionally `OPENAI_REALTIME_MODEL`, `NOOR_VOICE`,
   `REALTIME_SECRET_TTL_SECONDS`), and the `VITE_*` variables as plain
   variables. Add them to **both** Production and Preview if you want voice in
   preview deployments.
4. Deploy. `functions/api/realtime/session.ts` is picked up automatically and
   served at `/api/realtime/session`; `public/_redirects` keeps `/api/*` out
   of the SPA fallback so deep links still work after a refresh.

Verify the function compiles before pushing:

```bash
npx wrangler pages functions build --outdir=/tmp/fn-build
```

Local development with the function running:

```bash
npm run build && npx wrangler pages dev dist
```

## Diagnosing a deployment

`GET /api/realtime/session` returns a readiness report — booleans and variable
names only, never a value:

```bash
curl https://<your-site>/api/realtime/session
```

```json
{
  "realtimeReady": false,
  "openaiConfigured": true,
  "supabaseVerificationConfigured": false,
  "unauthenticatedPreviewOptIn": false,
  "model": "gpt-realtime-2.1",
  "voice": "marin",
  "missing": ["SUPABASE_URL", "SUPABASE_ANON_KEY"]
}
```

- `realtimeReady: true` and `missing: []` → live voice will work.
- Anything in `missing` is a variable that deploy context does not have.
- A 404 instead of JSON means the function is not deployed to that context.

**Environment variables are per deploy context.** Variables added only to
Production are *not* present in Deploy Previews, and the effect is invisible
from the outside: the site loads, sign-in works, and only the voice session
fails. On Netlify, set them for "Deploy previews" (and "Branch deploys") as
well as Production; on Cloudflare, add them to both Production and Preview.

### How failures are reported to the member

The endpoint separates the member's problem from the deployment's, because a
misconfigured server must never tell a signed-in member to sign in:

| Situation | Status | What the member sees |
| --- | --- | --- |
| No bearer token sent | `401 no_token` | “You need to be signed in to start a live session.” |
| Token rejected by Supabase | `401 token_rejected` | “Your session has expired. Please sign in again.” |
| Server has no Supabase config | `503 auth_not_configured` | “Noor is not available right now” — nothing stands in |
| Supabase unreachable | `503 auth_unreachable` | As above |
| No `OPENAI_API_KEY` | `503 openai_key_missing` | As above |
| OpenAI rate-limited / no quota | `503 upstream_rate_limited` (upstream 429) | “Noor's voice service is busy right now… This is on our side, not yours” — never “check your connection” |
| Upstream or network failure | `502` / fetch error | “We couldn't reach the voice service…” |

The 503 cases do **not** offer "Continue by text": text goes through the same
connection and would fail the same way, so offering it would be a second dead
end. `Try again`, `Return home` and `End session safely` are offered instead.

### Reading the realtime diagnostics

With `VITE_ENABLE_DEV_TOOLS=true`, a **dev · realtime** panel sits bottom-left
of the session screen. Its top block is the transport; the second block answers
one question — *is a realtime model actually producing these replies?*

| Field | What it tells you |
| --- | --- |
| `engine` | `openai_realtime_webrtc` or `scripted_demo` |
| `demoMode` | `yes` means pre-written replies. Should be `no` for any member. |
| `realtimeConnected` | Peer connection and data channel open |
| `currentUserTurnReceived` | The member's turn reached the model (audio committed, or text item created) |
| `userTranscriptAvailable` / `lastUserTranscriptChars` | A transcript arrived, and its length — never its content |
| `conversationItemCreated` | The server confirmed the turn is in the conversation |
| `responseCreatedByRealtimeModel` | Replies the model began. **Stuck at 0 while turns climb ⇒ the replies are not the model's.** |
| `conversationTurnCount` / `userTurnCount` | Completed turns; the model is being given each turn |
| `historyReseededTurns` | Turns restored after a reconnection |
| `instructionChars` | Instruction block length, so an empty or truncated prompt is visible |

No transcript content, no API key and no ephemeral secret is ever shown or
logged — credential-shaped strings are scrubbed before an entry is stored, and
the panel does not render in production.

## Verifying the conversation

Automated tests cover the mechanics (see `npm run validate`): provider
selection, event ordering, reconnection with history, the prompt's rules, and
that no pre-written line ships in a build. **Whether Noor actually responds to
content is a judgement about language, so it needs a person and a real
`OPENAI_API_KEY`** — these checks cannot be automated and have not been run in
CI.

Run each of these as a fresh session, with the diagnostics panel open. Confirm
`engine: openai_realtime_webrtc`, `demoMode: no` and a rising
`responseCreatedByRealtimeModel` throughout — otherwise you are not testing the
model.

**1. Five different openers.** Each in its own session, as the first thing you
say:

| # | Say | Her reply must |
| --- | --- | --- |
| A | “I have an important interview tomorrow and I'm worried I'll completely mess it up.” | be about the interview and its timing |
| B | “My relationship ended three months ago and I keep thinking about her every night.” | be about the ending and the nights — never an "overthinking" reply |
| C | “My manager keeps giving me work late in the evening and I'm getting exhausted.” | be about the manager and the late hours |
| D | “My best friend moved abroad and the house just feels really quiet now.” | be about the friend leaving and the quiet — not generic "relationships" |
| E | “Honestly I'm actually okay today. I just wanted somebody to talk to.” | accept that, and be company. No problem-hunting, no exercise. |

Then read the five replies together. They must be five clearly different
answers, each naming something only that member said. Any two that would swap
without anyone noticing is a failure.

**2. Accumulation over four turns.** One session:

> “I've been really stressed about work.” → “It's mostly because of my
> manager.” → “He messages me after 10 PM almost every night.” → “And then I
> can't switch my brain off when I go to bed.”

By the fourth turn she must be talking about the specific picture — the
late-night messages and the sleep — not still asking what work is like.

**3. Pronoun context.** “My sister has been going through a hard time.” →
“I don't know how to help her.” She must know who *her* is, without asking.

**4. Urdu.** Speak a few turns of ordinary Pakistani Urdu. Replies must be in
natural conversational Urdu — not literary, not a news bulletin, not a literal
translation.

**5. Mixed Urdu-English.** “Mera kaam ka pressure bohat zyada hai aur main
switch off nahi kar pata.” She must mix the same way, and must not flip to
formal Urdu because one English word appeared.

**6. Interruption keeps the corrected meaning.** Let her start answering, then
cut in with “No, wait — that's not actually what I meant.” and say what you
did mean. She must follow the correction, not finish her earlier point.

**7. Reconnection.** Mid-conversation, drop the network for a few seconds and
let it recover. She must **not** greet you again or ask what brought you here,
and must still know what you were discussing. `historyReseededTurns` should be
non-zero.

If any of 1–7 fails, capture the diagnostics panel values and the turn that
failed before changing the prompt: the mechanics are the more likely cause.

## Netlify deployment

1. Push this repository to GitHub.
2. In Netlify: **Add new site → Import an existing project → GitHub** and pick
   the repo. `netlify.toml` already sets `npm run build`, `dist`, Node 22 and
   the functions directory, so accept the detected settings.
3. Under **Site configuration → Environment variables** add the variables from
   the table above (at minimum the two `VITE_SUPABASE_*` values — or none, to
   review the site in demo mode).
4. Every pull request gets a **Deploy Preview** URL automatically; follow the
   Netlify check link on the PR. **Add the environment variables to the
   "Deploy previews" context too** — variables scoped only to Production are
   absent in previews, which makes sign-in work while the voice session
   fails. Check with `GET /api/realtime/session` (see
   [Diagnosing a deployment](#diagnosing-a-deployment)).
5. SPA routing: `netlify.toml` rewrites `/*` to `/index.html`, so refreshing
   `/app/journal` works. Security headers are also set there.

> A visible development banner appears on every page while any crisis
> resource in `src/safety/resources.ts` is unverified. **Do not promote a
> build to production until that banner is gone.**

## Scripts

| Command             | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Vite dev server                                         |
| `npm run build`     | Typecheck (`tsc`) then production build                 |
| `npm run preview`   | Serve the production build locally                      |
| `npm run typecheck` | Typecheck app + Netlify functions                       |
| `npm run lint`      | ESLint (flat config, typescript-eslint, react-hooks)    |
| `npm test`          | Vitest unit/component tests                             |
| `npm run check:no-scripted-replies` | Fails if a pre-written Noor reply reached `dist/`       |
| `npm run validate`  | typecheck + lint + test + build + no-scripted-replies   |

## Architecture

```
src/
  config/         env, product constants, screening thresholds (single source of numbers)
  i18n/           typed translation tree, English + Urdu, RTL handling
  auth/           AuthProvider contract → SupabaseAuthProvider | DemoAuthProvider
  data/           SoulEaseRepository contract → SupabaseRepository | DemoRepository
  assessments/    PHQ-9 / GAD-7 registry, locale files, pure scoring
  safety/         SafetyState machine, heuristic detector, verified-resources config
  entitlements/   free-session logic (pure)
  memory/         consent permissions (pure), memory-candidate generation
  noor/           Noor's identity + system instructions builder
  realtime/       vendor-neutral RealtimeConversationProvider
                    OpenAIRealtimeProvider — the only engine that talks to members
                    DemoRealtimeProvider — scripted interface harness, dynamic-imported,
                      reachable only with VITE_REALTIME_PROVIDER=demo
  session/        useSessionController (orchestration), summaryBuilder, topicTags
  toolkit/        exercise catalogue
  support/        practitioner placeholders (clearly labelled)
  components/     ui primitives, brand (NoorOrb), layouts, dev banner
  pages/          route-level screens
  routes/         RequireAuth / RequireOnboarded / RedirectIfAuthenticated
netlify/functions/realtime-token.ts   server-only credential minting
supabase/migrations/                  reproducible schema + RLS
```

### Key design decisions

- **Two-implementation contracts.** Auth and data are behind interfaces so the
  same UI runs against Supabase or the browser-local demo store. Demo mode is
  how the Netlify preview can be reviewed before credentials exist.
- **Safety Mode is application state.** `src/safety/machine.ts` is a pure
  transition function (NORMAL → ELEVATED_SUPPORT → SAFETY_MODE → HUMAN_HANDOFF)
  with immediate escalation and gradual de-escalation. The session controller
  owns it; the provider is only informed. Safety events are logged without
  conversation content.
- **Consent is granular.** Core use, transcript storage, long-term memory and
  assessment storage are separate consent records. Turns are written only
  with transcript consent; memory candidates are proposed at session end and
  saved only with memory consent and after the member reviews them.
- **Memory is curated, not replayed.** Sessions produce structured memory
  candidates; the next session receives a short list of approved lines (not
  historical transcripts). Members see and delete everything under
  _Settings → What Soul Ease Remembers_.
- **Entitlement is enforced server-side** in `start_wellbeing_session`, with
  the same rule mirrored in `src/entitlements` for the UI. Safety resources are
  never gated.
- **Realtime is vendor-neutral.** `RealtimeConversationProvider` exposes
  connect/listen/pause/interrupt/sendText plus a typed event stream (speech
  start/stop, transcripts, levels, insights, errors). Phase 2 implements the
  WebRTC provider behind the same contract; the token endpoint already exists.

## Safety, privacy and clinical boundaries

- Noor is always the _AI Wellbeing Guide_ — never a therapist, doctor or
  licensed professional. The system instructions in `src/noor/persona.ts`
  forbid diagnosis, medication advice and making life decisions for members.
- Screening results always carry **"This is a screening result, not a
  diagnosis."** English PHQ-9/GAD-7 wording is included with attribution;
  `useTermsVerified` must be set to `true` by the product owner after
  confirming Pfizer's use terms. **Urdu wording is intentionally absent** —
  the validated translation must be inserted verbatim, never generated.
- `src/safety/resources.ts` contains **no invented phone numbers**. Pakistani
  emergency and crisis contacts are placeholders flagged `verified: false`,
  which triggers the in-app developer warning and a console warning.
- Raw audio is never stored. Transcripts are never logged. Passwords are
  handled solely by Supabase Auth. RLS restricts every table to its owner.
- `/privacy` is a plain-language development statement and makes no
  regulatory-compliance claims.

## Phase 1 limitations & Phase 2 scope

**Known limitations**

- **Not exercised against live credentials.** No OpenAI or Supabase keys were
  available in the build environment, so the realtime path was verified
  against a simulated WebRTC stack (`OpenAIRealtimeProvider.test.ts`) and by
  compiling the Cloudflare function, not by holding a live conversation. The
  first run with a real key is where voice quality, latency and Urdu
  pronunciation must be judged.
- **Urdu voice quality is unverified.** The realtime voices are not
  Urdu-specialised. Expect an accent, and check the Urdu and mixed lines in
  the audition page (`/app/dev/voice`) before choosing the final voice.
- The safety detector is a conservative keyword heuristic for exercising the
  architecture; it is not clinically reviewed. Screening now runs on realtime
  transcripts, which arrive slightly after the words are spoken.
- Semantic VAD eagerness is set to `low` on reasoning, not on measurement.
  Tune it after listening to real conversations.
- Noor's portrait asset is not in the repository. Until it is added an
  abstract identity mark renders in its place — see
  `public/images/noor/README.md` for the brief.
- Reconnection makes two attempts with a fresh credential; a longer outage
  ends in the retry / continue-by-text / end-safely screen.
- Human-support directory shows clearly labelled placeholders; requests are
  recorded but no one is contacted.
- Payments are not implemented; the upgrade screen is a placeholder.
- Supabase auth/RLS have not been exercised against a live project; the SQL
  is written to Supabase conventions and should be smoke-tested during setup.

**Deferred to Phase 3**

- The full long-term memory engine (Phase 2 ships a bounded context payload
  and the interface it will grow from).
- Model-generated summaries and memory candidates via tool-calls
  (same `SessionInsight` shape).
- Clinically reviewed safety logic and verified Pakistani crisis resources.
- Validated Urdu PHQ-9 / GAD-7 wording.
- Verified practitioner network, referral and booking integration.
- Payment processing and plan management.
