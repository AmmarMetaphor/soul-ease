# Soul Ease — Your AI-Guided Mental Wellbeing Companion

_A private space to talk, reflect and find your next step._

Soul Ease is a voice-first AI wellbeing companion for adults (18+) in Pakistan.
Members talk with **Noor**, the _Soul Ease AI Wellbeing Guide_, in English, Urdu
or naturally mixed Urdu-English about anxiety, low mood, stress, overthinking,
grief and relationship strain.

> **Soul Ease is not a medical product.** It does not diagnose, treat or
> prescribe, and Noor is never described as licensed, accredited or clinically
> qualified. It is not for emergencies. See `/safety` in the app.

This repository is **Phase 1**: the product foundation — onboarding, consent,
authentication, database schema, dashboard, the audio-first session interface
(in demo mode), session summaries, history, journal, goals, toolkit, memory
management, Safety Mode architecture, human-support scaffolding and a
free-session entitlement. Live realtime voice is Phase 2.

---

## Contents

- [Stack](#stack)
- [Quick start (demo mode)](#quick-start-demo-mode)
- [Environment variables](#environment-variables)
- [Supabase setup](#supabase-setup)
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
| Auth      | Supabase Auth (email/password, verification, reset) with a local demo fallback |
| Database  | Supabase PostgreSQL with Row Level Security (`supabase/migrations`)            |
| Server    | Netlify Functions (`netlify/functions/realtime-token.ts`)                      |
| Tests     | Vitest + Testing Library (79 tests)                                            |
| Hosting   | Netlify (SPA redirects + security headers in `netlify.toml`)                   |

## Quick start (demo mode)

```bash
npm install
npm run dev
```

Open http://localhost:5173. With no Supabase variables set the app runs in
**DEMO MODE**: accounts and all wellbeing data live only in your browser's
localStorage and nothing leaves the device. Use **"Continue as demo member"** on
the sign-in page for an instant account, then walk through onboarding.

The demo conversation engine uses in-browser speech recognition (Chromium) and
speech synthesis where available, falling back to typed conversation elsewhere.

## Environment variables

Copy `.env.example` to `.env`. Only `VITE_`-prefixed variables reach the browser.

| Variable                       | Where          | Purpose                                                          |
| ------------------------------ | -------------- | ---------------------------------------------------------------- |
| `VITE_SUPABASE_URL`            | browser        | Supabase project URL. Blank → demo mode.                         |
| `VITE_SUPABASE_ANON_KEY`       | browser        | Supabase anon (public) key. Blank → demo mode.                   |
| `VITE_FREE_SESSION_ALLOWANCE`  | browser        | Free sessions before the upgrade placeholder (default `3`).      |
| `VITE_FORCE_DEMO_MODE`         | browser        | `true` forces demo mode even with Supabase configured.           |
| `VITE_PUBLIC_SITE_URL`         | browser        | Site origin for auth email redirects (defaults to window origin). |
| `VITE_REALTIME_PROVIDER`       | browser        | `demo` (default) or `openai` (Phase 2 scaffold, falls back).     |
| `SUPABASE_URL`                 | functions only | Used by the token function to verify the caller's JWT.           |
| `SUPABASE_ANON_KEY`            | functions only | As above.                                                        |
| `OPENAI_API_KEY`               | functions only | **Never** prefixed with `VITE_`. Absent → token endpoint returns 503. |
| `OPENAI_REALTIME_MODEL`        | functions only | Optional model override for Phase 2.                             |

No secrets are committed. The `service_role` key is never used anywhere.

## Supabase setup

Full instructions live in [`supabase/README.md`](supabase/README.md). Summary:

1. Create a Supabase project and copy the URL + anon key into `.env`.
2. Apply `supabase/migrations/20260903000001_phase1_schema.sql` (via
   `supabase db push` or the SQL editor). It creates every table, RLS policy,
   the `handle_new_user` trigger, and the `start_wellbeing_session`,
   `end_wellbeing_session` and `delete_my_account` functions.
3. In **Authentication → URL configuration** add your site URL and the
   `/verify-email` and `/reset-password` redirect URLs (local + Netlify).

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

- The conversation engine is a scripted demo (`noorDemoScript.ts`). It follows
  Noor's framework and mirrors language register, but it is not a model.
- In-browser speech recognition depends on the browser (Chromium); recognition
  language is fixed per utterance stream, so true mid-sentence code-switching
  is approximated. Barge-in in demo mode is tap-to-interrupt.
- The safety detector is a conservative keyword heuristic for exercising the
  architecture; it is not clinically reviewed.
- The Netlify token function is implemented against the documented ephemeral
  session endpoint but has not been exercised against a live account.
- Human-support directory shows clearly labelled placeholders; requests are
  recorded but no one is contacted.
- Payments are not implemented; the upgrade screen is a placeholder.
- Supabase auth/RLS have not been exercised against a live project in this
  environment (no credentials available); the SQL is written to Supabase
  conventions and should be applied and smoke-tested during setup.

**Deferred to Phase 2**

- OpenAI Realtime WebRTC provider with server VAD, live transcription and
  genuine barge-in; reconnection and device switching.
- Model-generated summaries and memory candidates via tool-calls
  (same `SessionInsight` shape).
- Clinically reviewed safety logic and verified Pakistani crisis resources.
- Validated Urdu PHQ-9 / GAD-7 wording.
- Verified practitioner network, referral and booking integration.
- Payment processing and plan management.
