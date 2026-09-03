-- ============================================================================
-- Soul Ease — Phase 1 schema
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.
-- Every member-owned table has Row Level Security enabled with policies that
-- compare `user_id` (or `id` for profiles) to auth.uid(). The browser only ever
-- holds the anon key; nothing here grants the anon role access to other people's
-- data. Service-role credentials are never used by the frontend.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type public.ui_locale as enum ('en', 'ur');
create type public.interaction_mode as enum ('audio', 'text');
create type public.consent_type as enum (
  'core_terms_and_ai_disclosure',
  'transcript_storage',
  'long_term_memory',
  'assessment_storage'
);
create type public.assessment_instrument as enum ('phq9', 'gad7');
create type public.severity_band as enum ('minimal', 'mild', 'moderate', 'moderately_severe', 'severe');
create type public.session_status as enum ('active', 'ended', 'abandoned');
create type public.turn_role as enum ('user', 'noor', 'system');
create type public.memory_category as enum (
  'stressor', 'relationship', 'goal', 'coping_preference', 'topic_to_revisit', 'agreed_action', 'context'
);
create type public.goal_status as enum ('active', 'completed', 'let_go');
create type public.safety_state as enum ('NORMAL', 'ELEVATED_SUPPORT', 'SAFETY_MODE', 'HUMAN_HANDOFF');
create type public.safety_trigger_source as enum ('assessment_item', 'conversation', 'user_request', 'system');
create type public.plan_tier as enum ('free', 'supporter');
create type public.support_request_type as enum ('talk_to_professional', 'referral', 'booking', 'urgent');
create type public.support_request_status as enum ('submitted', 'reviewing', 'matched', 'closed');
create type public.contact_preference as enum ('email', 'phone', 'in_app');
create type public.language_preference as enum ('en', 'ur', 'mixed');

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
create table public.profiles (
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
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- consent_records (append-only history; latest row per type wins)
-- ---------------------------------------------------------------------------
create table public.consent_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  consent_type public.consent_type not null,
  granted      boolean not null,
  version      text not null,
  recorded_at  timestamptz not null default now()
);
create index consent_records_user_idx on public.consent_records (user_id, recorded_at);

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table public.sessions (
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
create index sessions_user_started_idx on public.sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- assessment_runs
-- ---------------------------------------------------------------------------
create table public.assessment_runs (
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
create index assessment_runs_user_idx on public.assessment_runs (user_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- session_turns (only written when the member consented to transcript storage)
-- ---------------------------------------------------------------------------
create table public.session_turns (
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
create index session_turns_session_idx on public.session_turns (session_id, turn_index);

-- ---------------------------------------------------------------------------
-- session_summaries
-- ---------------------------------------------------------------------------
create table public.session_summaries (
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
create table public.memory_items (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  category           public.memory_category not null,
  content            text not null check (char_length(content) <= 500),
  source_session_id  uuid references public.sessions (id) on delete set null,
  created_at         timestamptz not null default now(),
  last_referenced_at timestamptz
);
create index memory_items_user_idx on public.memory_items (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
create table public.goals (
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
create index goals_user_idx on public.goals (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- journal_entries
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text check (title is null or char_length(title) <= 200),
  body       text not null,
  mood       smallint check (mood is null or mood between 1 and 5),
  session_id uuid references public.sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journal_entries_user_idx on public.journal_entries (user_id, updated_at desc);
create trigger journal_entries_updated_at before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- mood_checkins
-- ---------------------------------------------------------------------------
create table public.mood_checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  mood       smallint not null check (mood between 1 and 5),
  note       text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index mood_checkins_user_idx on public.mood_checkins (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- saved_coping_tools
-- ---------------------------------------------------------------------------
create table public.saved_coping_tools (
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
create table public.safety_events (
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
create index safety_events_user_idx on public.safety_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- usage_entitlements
-- ---------------------------------------------------------------------------
create table public.usage_entitlements (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  plan                   public.plan_tier not null default 'free',
  free_session_allowance integer not null default public.default_free_session_allowance(),
  sessions_used          integer not null default 0 check (sessions_used >= 0),
  updated_at             timestamptz not null default now()
);
create trigger usage_entitlements_updated_at before update on public.usage_entitlements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- human_support_requests
-- ---------------------------------------------------------------------------
create table public.human_support_requests (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  request_type       public.support_request_type not null,
  preferred_contact  public.contact_preference not null default 'in_app',
  preferred_language public.language_preference not null default 'mixed',
  note               text check (note is null or char_length(note) <= 1000),
  status             public.support_request_status not null default 'submitted',
  created_at         timestamptz not null default now()
);
create index human_support_requests_user_idx on public.human_support_requests (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- practitioners — directory of verified human professionals (Phase 2 fills it)
-- No rows are seeded. Never insert unverified people.
-- ---------------------------------------------------------------------------
create table public.practitioners (
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
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Generic owner policies for user_id-keyed tables
create policy "consent_records: own all" on public.consent_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "assessment_runs: own all" on public.assessment_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sessions: own read"   on public.sessions for select using (auth.uid() = user_id);
create policy "sessions: own update" on public.sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions: own delete" on public.sessions for delete using (auth.uid() = user_id);
-- inserts happen only through start_wellbeing_session()

create policy "session_turns: own all" on public.session_turns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "session_summaries: own all" on public.session_summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "memory_items: own all" on public.memory_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "goals: own all" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "journal_entries: own all" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "mood_checkins: own all" on public.mood_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "saved_coping_tools: own all" on public.saved_coping_tools
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- safety events: members may write and read their own; never update/delete from the client
create policy "safety_events: own read"   on public.safety_events for select using (auth.uid() = user_id);
create policy "safety_events: own insert" on public.safety_events for insert with check (auth.uid() = user_id);

-- entitlements: read own; create own default row; counters change only via RPC
create policy "usage_entitlements: own read"   on public.usage_entitlements for select using (auth.uid() = user_id);
create policy "usage_entitlements: own insert" on public.usage_entitlements for insert with check (auth.uid() = user_id);

create policy "human_support_requests: own read"   on public.human_support_requests for select using (auth.uid() = user_id);
create policy "human_support_requests: own insert" on public.human_support_requests for insert with check (auth.uid() = user_id);

-- practitioners: any signed-in member may read VERIFIED listings only
create policy "practitioners: read verified" on public.practitioners
  for select to authenticated using (is_verified = true);
