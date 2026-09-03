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

Without `OPENAI_API_KEY` the realtime endpoint answers 503, the app says so
plainly on the session screen, and a scripted demo guide stands in so the
product can still be reviewed. **Once the key is configured, live realtime
audio always takes priority** — the demo guide never speaks over a working
realtime connection.

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
| `OPENAI_API_KEY`                 | Realtime voice. Absent → endpoint returns 503 and the app runs the demo guide.        |
| `OPENAI_REALTIME_MODEL`          | Realtime model. Default `gpt-realtime-2.1`.                                           |
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
| `VITE_REALTIME_PROVIDER`      | `auto` (default), `demo` (pin demo guide), `openai` (pin realtime).         |
| `VITE_NOOR_VOICE`             | Client-side hint only; the server value decides.                            |
| `VITE_ENABLE_DEV_TOOLS`       | Voice audition + realtime diagnostics. **Must stay false in production.**   |
| `VITE_ROUTER_MODE`            | `browser` (default) or `hash` for hosts with no SPA rewrite.                |

No secrets are committed. The `service_role` key is never used anywhere, and
there is no `VITE_OPENAI_API_KEY`.

## Supabase setup

Full instructions live in [`supabase/README.md`](supabase/README.md). Summary:

1. Create a Supabase project and copy the URL + anon key into `.env`.
2. Apply `supabase/migrations/20260903000001_phase1_schema.sql` (via
   `supabase db push` or the SQL editor). It creates every table, RLS policy,
   the `handle_new_user` trigger, and the `start_wellbeing_session`,
   `end_wellbeing_session` and `delete_my_account` functions.
3. In **Authentication → URL configuration** add your site URL and the
   `/verify-email` and `/reset-password` redirect URLs (local + Netlify).

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

## Netlify deployment

1. Push this repository to GitHub.
2. In Netlify: **Add new site → Import an existing project → GitHub** and pick
   the repo. `netlify.toml` already sets `npm run build`, `dist`, Node 22 and
   the functions directory, so accept the detected settings.
3. Under **Site configuration → Environment variables** add the variables from
   the table above (at minimum the two `VITE_SUPABASE_*` values — or none, to
   review the site in demo mode).
4. Every pull request gets a **Deploy Preview** URL automatically. Open the PR
   for `claude/soul-ease-phase-1-ffxijs` and follow the Netlify check link.
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
| `npm run validate`  | typecheck + lint + test + build                         |

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
                    DemoRealtimeProvider (Phase 1) · OpenAIRealtimeProvider (Phase 2 scaffold)
  session/        useSessionController (orchestration), summaryBuilder
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
