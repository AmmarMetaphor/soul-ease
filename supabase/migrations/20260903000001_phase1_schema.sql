-- ============================================================================
-- Soul Ease — database schema
--
-- HOW TO APPLY
--   Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
--   (Or, with the CLI: `supabase db push`.)
--
-- This file is SAFE TO RUN MORE THAN ONCE. Every object is created only if it
-- is missing, and every policy and trigger is replaced rather than duplicated.
-- If a previous run failed halfway through, just run the whole file again.
--
-- Every member-owned table has Row Level Security enabled with policies that
-- compare `user_id` (or `id` for profiles) to auth.uid(). The browser only ever
-- holds the anon key; nothing here grants the anon role access to other people's
-- data. Service-role credentials are never used by the frontend.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerations
--
-- Each value list matches a TypeScript union in the application exactly. A
-- mismatch here surfaces as a runtime insert failure, not a type error, so
-- these are kept deliberately in step with:
--   ui_locale/interaction_mode/memory_category/goal_status → src/data/types.ts
--   consent_type            → src/memory/permissions.ts
--   assessment_instrument   → src/assessments/types.ts
--   severity_band           → src/config/thresholds.ts
--   safety_state, safety_trigger_source → src/safety/types.ts
-- ---------------------------------------------------------------------------
do $$
begin
  begin create type public.ui_locale as enum ('en', 'ur');
  exception when duplicate_object then null; end;

  begin create type public.interaction_mode as enum ('audio', 'text');
  exception when duplicate_object then null; end;

  begin create type public.consent_type as enum (
    'core_terms_and_ai_disclosure',
    'transcript_storage',
    'long_term_memory',
    'assessment_storage'
  );
  exception when duplicate_object then null; end;

  begin create type public.assessment_instrument as enum ('phq9', 'gad7');
  exception when duplicate_object then null; end;

  begin create type public.severity_band as enum ('minimal', 'mild', 'moderate', 'moderately_severe', 'severe');
  exception when duplicate_object then null; end;

  begin create type public.session_status as enum ('active', 'ended', 'abandoned');
  exception when duplicate_object then null; end;

  begin create type public.turn_role as enum ('user', 'noor', 'system');
  exception when duplicate_object then null; end;

  begin create type public.memory_category as enum (
    'stressor', 'relationship', 'goal', 'coping_preference', 'topic_to_revisit', 'agreed_action', 'context'
  );
  exception when duplicate_object then null; end;

  begin create type public.goal_status as enum ('active', 'completed', 'let_go');
  exception when duplicate_object then null; end;

  begin create type public.safety_state as enum ('NORMAL', 'ELEVATED_SUPPORT', 'SAFETY_MODE', 'HUMAN_HANDOFF');
  exception when duplicate_object then null; end;

  begin create type public.safety_trigger_source as enum ('assessment_item', 'conversation', 'user_request', 'system');
  exception when duplicate_object then null; end;

  begin create type public.plan_tier as enum ('free', 'supporter');
  exception when duplicate_object then null; end;

  begin create type public.support_request_type as enum ('talk_to_professional', 'referral', 'booking', 'urgent');
  exception when duplicate_object then null; end;

  begin create type public.support_request_status as enum ('submitted', 'reviewing', 'matched', 'closed');
  exception when duplicate_object then null; end;

  begin create type public.contact_preference as enum ('email', 'phone', 'in_app');
  exception when duplicate_object then null; end;

  begin create type public.language_preference as enum ('en', 'ur', 'mixed');
  exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Change the free allowance in ONE place. Mirrors VITE_FREE_SESSION_ALLOWANCE.
create or replace function public.default_free_session_allowance()
returns integer language sql immutable as $$ select 3 $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  display_name            text check (display_name is null or char_length(display_name) <= 80),
  preferred_language      public.ui_locale not null default 'en',
  preferred_mode          public.interaction_mode not null default 'audio',
  age_confirmed_at        timestamptz,
  onboarding_completed_at timestamptz,
  primary_concerns        text[] not null default '{}',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- consent_records (append-only history; latest row per type wins)
--
-- Consent is never inferred and never defaulted to granted: the application
-- reads this table and treats an absent row as "not consented".
-- ---------------------------------------------------------------------------
create table if not exists public.consent_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  consent_type public.consent_type not null,
  granted      boolean not null,
  version      text not null,
  recorded_at  timestamptz not null default now()
);
create index if not exists consent_records_user_idx on public.consent_records (user_id, recorded_at);

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users (id) on delete cascade,
  mode                       public.interaction_mode not null,
  status                     public.session_status not null default 'active',
  title                      text check (title is null or char_length(title) <= 120),
  started_at                 timestamptz not null default now(),
  ended_at                   timestamptz,
  duration_seconds           integer check (duration_seconds is null or duration_seconds >= 0),
  topic_tags                 text[] not null default '{}',
  language_detected          text,
  max_safety_state           public.safety_state not null default 'NORMAL',
  counted_towards_allowance  boolean not null default false
);
create index if not exists sessions_user_started_idx on public.sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- assessment_runs
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_runs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  instrument          public.assessment_instrument not null,
  locale              public.ui_locale not null,
  responses           smallint[] not null,
  total_score         smallint not null check (total_score >= 0),
  severity_band       public.severity_band not null,
  flagged_safety_item boolean not null default false,
  completed_at        timestamptz not null default now(),
  session_id          uuid references public.sessions (id) on delete set null
);
create index if not exists assessment_runs_user_idx on public.assessment_runs (user_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- session_turns (only written when the member consented to transcript storage)
-- ---------------------------------------------------------------------------
create table if not exists public.session_turns (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  turn_index integer not null check (turn_index >= 0),
  role       public.turn_role not null,
  content    text not null,
  language   text,
  created_at timestamptz not null default now(),
  unique (session_id, turn_index)
);
create index if not exists session_turns_session_idx on public.session_turns (session_id, turn_index);

-- ---------------------------------------------------------------------------
-- session_summaries
-- ---------------------------------------------------------------------------
create table if not exists public.session_summaries (
  id                        uuid primary key default gen_random_uuid(),
  session_id                uuid not null unique references public.sessions (id) on delete cascade,
  user_id                   uuid not null references auth.users (id) on delete cascade,
  what_we_talked_about      text not null,
  most_important            text not null,
  agreed_actions            text[] not null default '{}',
  recommended_exercise_slug text,
  goal_before_next          text,
  created_at                timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- memory_items (long-term memory; member can see and delete every row)
-- ---------------------------------------------------------------------------
create table if not exists public.memory_items (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  category           public.memory_category not null,
  content            text not null check (char_length(content) <= 500),
  source_session_id  uuid references public.sessions (id) on delete set null,
  created_at         timestamptz not null default now(),
  last_referenced_at timestamptz
);
create index if not exists memory_items_user_idx on public.memory_items (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  description  text,
  status       public.goal_status not null default 'active',
  target_date  date,
  session_id   uuid references public.sessions (id) on delete set null,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists goals_user_idx on public.goals (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- journal_entries
-- ---------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text check (title is null or char_length(title) <= 200),
  body       text not null,
  mood       smallint check (mood is null or mood between 1 and 5),
  session_id uuid references public.sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists journal_entries_user_idx on public.journal_entries (user_id, updated_at desc);
drop trigger if exists journal_entries_updated_at on public.journal_entries;
create trigger journal_entries_updated_at before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- mood_checkins
-- ---------------------------------------------------------------------------
create table if not exists public.mood_checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  mood       smallint not null check (mood between 1 and 5),
  note       text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists mood_checkins_user_idx on public.mood_checkins (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- saved_coping_tools
-- ---------------------------------------------------------------------------
create table if not exists public.saved_coping_tools (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  tool_slug text not null,
  note      text,
  saved_at  timestamptz not null default now(),
  unique (user_id, tool_slug)
);

-- ---------------------------------------------------------------------------
-- safety_events — deliberately stores NO conversation content
-- ---------------------------------------------------------------------------
create table if not exists public.safety_events (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  session_id            uuid references public.sessions (id) on delete set null,
  from_state            public.safety_state not null,
  to_state              public.safety_state not null,
  trigger_source        public.safety_trigger_source not null,
  resources_shown       boolean not null default false,
  human_support_offered boolean not null default false,
  created_at            timestamptz not null default now()
);
create index if not exists safety_events_user_idx on public.safety_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- usage_entitlements
-- ---------------------------------------------------------------------------
create table if not exists public.usage_entitlements (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  plan                   public.plan_tier not null default 'free',
  free_session_allowance integer not null default public.default_free_session_allowance(),
  sessions_used          integer not null default 0 check (sessions_used >= 0),
  updated_at             timestamptz not null default now()
);
drop trigger if exists usage_entitlements_updated_at on public.usage_entitlements;
create trigger usage_entitlements_updated_at before update on public.usage_entitlements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- human_support_requests
-- ---------------------------------------------------------------------------
create table if not exists public.human_support_requests (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  request_type       public.support_request_type not null,
  preferred_contact  public.contact_preference not null default 'in_app',
  preferred_language public.language_preference not null default 'mixed',
  note               text check (note is null or char_length(note) <= 1000),
  status             public.support_request_status not null default 'submitted',
  created_at         timestamptz not null default now()
);
create index if not exists human_support_requests_user_idx on public.human_support_requests (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- practitioners — directory of verified human professionals
-- No rows are seeded. Never insert people who have not consented and been
-- verified: this table is the one place the product names real humans.
-- ---------------------------------------------------------------------------
create table if not exists public.practitioners (
  id             uuid primary key default gen_random_uuid(),
  display_name   text not null,
  role_title     text not null,
  languages      text[] not null default '{}',
  focus_areas    text[] not null default '{}',
  location       text,
  is_placeholder boolean not null default true,
  is_verified    boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auto-provision profile + entitlement when a user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.usage_entitlements (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up BEFORE this schema existed. The trigger above
-- only fires on new sign-ups, so without this an account created against an
-- empty database would have no profile and no entitlement row.
insert into public.profiles (id)
  select id from auth.users on conflict do nothing;
insert into public.usage_entitlements (user_id)
  select id from auth.users on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RPC: start_wellbeing_session — entitlement check + insert in one transaction
-- ---------------------------------------------------------------------------
create or replace function public.start_wellbeing_session(p_mode public.interaction_mode)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ent  public.usage_entitlements;
  v_row  public.sessions;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  insert into public.usage_entitlements (user_id) values (v_user) on conflict do nothing;
  select * into v_ent from public.usage_entitlements where user_id = v_user for update;

  if v_ent.plan = 'free' and v_ent.sessions_used >= v_ent.free_session_allowance then
    raise exception 'ENTITLEMENT_EXHAUSTED';
  end if;

  insert into public.sessions (user_id, mode) values (v_user, p_mode) returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: end_wellbeing_session — finalise and (optionally) consume allowance
-- ---------------------------------------------------------------------------
create or replace function public.end_wellbeing_session(
  p_session_id uuid,
  p_duration_seconds integer,
  p_topic_tags text[],
  p_language_detected text,
  p_max_safety_state public.safety_state,
  p_count_towards_allowance boolean
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row  public.sessions;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_row from public.sessions where id = p_session_id and user_id = v_user for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if p_count_towards_allowance and not v_row.counted_towards_allowance then
    update public.usage_entitlements
       set sessions_used = sessions_used + 1
     where user_id = v_user;
  end if;

  update public.sessions
     set status = 'ended',
         ended_at = now(),
         duration_seconds = p_duration_seconds,
         topic_tags = coalesce(p_topic_tags, '{}'),
         language_detected = p_language_detected,
         max_safety_state = p_max_safety_state,
         counted_towards_allowance = counted_towards_allowance or p_count_towards_allowance
   where id = p_session_id
   returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: delete_my_account — cascades through every table via FKs
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.start_wellbeing_session(public.interaction_mode) from public;
revoke all on function public.end_wellbeing_session(uuid, integer, text[], text, public.safety_state, boolean) from public;
revoke all on function public.delete_my_account() from public;
grant execute on function public.start_wellbeing_session(public.interaction_mode) to authenticated;
grant execute on function public.end_wellbeing_session(uuid, integer, text[], text, public.safety_state, boolean) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Enabled on every table. With RLS on and no matching policy, the default is
-- deny — so a table added later without a policy fails closed, not open.
-- For the anon role auth.uid() is null, and `null = user_id` is null, which is
-- not true: a signed-out visitor matches no row anywhere.
-- ---------------------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.consent_records        enable row level security;
alter table public.assessment_runs        enable row level security;
alter table public.sessions               enable row level security;
alter table public.session_turns          enable row level security;
alter table public.session_summaries      enable row level security;
alter table public.memory_items           enable row level security;
alter table public.goals                  enable row level security;
alter table public.journal_entries        enable row level security;
alter table public.mood_checkins          enable row level security;
alter table public.saved_coping_tools     enable row level security;
alter table public.safety_events          enable row level security;
alter table public.usage_entitlements     enable row level security;
alter table public.human_support_requests enable row level security;
alter table public.practitioners          enable row level security;

-- profiles: keyed by id
drop policy if exists "profiles: own read"   on public.profiles;
drop policy if exists "profiles: own insert" on public.profiles;
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Generic owner policies for user_id-keyed tables
drop policy if exists "consent_records: own all" on public.consent_records;
create policy "consent_records: own all" on public.consent_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "assessment_runs: own all" on public.assessment_runs;
create policy "assessment_runs: own all" on public.assessment_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sessions: own read"   on public.sessions;
drop policy if exists "sessions: own update" on public.sessions;
drop policy if exists "sessions: own delete" on public.sessions;
create policy "sessions: own read"   on public.sessions for select using (auth.uid() = user_id);
create policy "sessions: own update" on public.sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions: own delete" on public.sessions for delete using (auth.uid() = user_id);
-- No insert policy: sessions are created only through start_wellbeing_session(),
-- so the free-session allowance cannot be side-stepped from the browser.

drop policy if exists "session_turns: own all" on public.session_turns;
create policy "session_turns: own all" on public.session_turns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "session_summaries: own all" on public.session_summaries;
create policy "session_summaries: own all" on public.session_summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "memory_items: own all" on public.memory_items;
create policy "memory_items: own all" on public.memory_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals: own all" on public.goals;
create policy "goals: own all" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "journal_entries: own all" on public.journal_entries;
create policy "journal_entries: own all" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "mood_checkins: own all" on public.mood_checkins;
create policy "mood_checkins: own all" on public.mood_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_coping_tools: own all" on public.saved_coping_tools;
create policy "saved_coping_tools: own all" on public.saved_coping_tools
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- safety events: members may write and read their own; never update/delete from
-- the client, so a safety history cannot be quietly rewritten.
drop policy if exists "safety_events: own read"   on public.safety_events;
drop policy if exists "safety_events: own insert" on public.safety_events;
create policy "safety_events: own read"   on public.safety_events for select using (auth.uid() = user_id);
create policy "safety_events: own insert" on public.safety_events for insert with check (auth.uid() = user_id);

-- entitlements: read own; create own default row; counters change only via RPC
drop policy if exists "usage_entitlements: own read"   on public.usage_entitlements;
drop policy if exists "usage_entitlements: own insert" on public.usage_entitlements;
create policy "usage_entitlements: own read"   on public.usage_entitlements for select using (auth.uid() = user_id);
create policy "usage_entitlements: own insert" on public.usage_entitlements for insert with check (auth.uid() = user_id);

drop policy if exists "human_support_requests: own read"   on public.human_support_requests;
drop policy if exists "human_support_requests: own insert" on public.human_support_requests;
create policy "human_support_requests: own read"   on public.human_support_requests for select using (auth.uid() = user_id);
create policy "human_support_requests: own insert" on public.human_support_requests for insert with check (auth.uid() = user_id);

-- practitioners: any signed-in member may read VERIFIED listings only
drop policy if exists "practitioners: read verified" on public.practitioners;
create policy "practitioners: read verified" on public.practitioners
  for select to authenticated using (is_verified = true);

-- ---------------------------------------------------------------------------
-- Tell PostgREST to re-read the schema.
--
-- Supabase's API layer caches the table list. Until it reloads, a brand-new
-- table answers requests with:
--   "Could not find the table 'public.consent_records' in the schema cache"
-- which reads like a missing table even after this migration has run.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ============================================================================
-- Verify (optional) — run this afterwards to confirm all 15 tables exist with
-- RLS enabled. Every row should show rls_enabled = true.
--
--   select tablename, rowsecurity as rls_enabled
--     from pg_tables
--    where schemaname = 'public'
--    order by tablename;
-- ============================================================================
