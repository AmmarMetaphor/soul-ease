-- ============================================================================
-- Soul Ease — Stage 3: continuity layer
--
-- HOW TO APPLY
--   Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
--   Run 20260903000001_phase1_schema.sql FIRST if you have not already.
--   (Or, with the CLI: `supabase db push`.)
--
-- Safe to run more than once.
--
-- Adds what Stage 3 needs and nothing else:
--   follow_up_items      — things the member asked Noor to check back on
--   coping_preferences   — which approaches helped, so none is re-suggested
--   consent_type         — 'journal_ai_access', so the journal stays private
--                          unless the member opens it deliberately
--   memory_category      — 'communication_preference' and 'follow_up'
--
-- Everything is member-owned, RLS-protected, and cascades on account deletion.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- New enum values
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block in older
-- PostgreSQL, and IF NOT EXISTS makes a re-run a no-op. The Supabase SQL
-- editor runs statements outside an explicit transaction, so these are safe
-- here; `supabase db push` wraps migrations, which is why each is its own
-- statement rather than part of a DO block.
-- ---------------------------------------------------------------------------
alter type public.consent_type add value if not exists 'journal_ai_access';
alter type public.memory_category add value if not exists 'communication_preference';
alter type public.memory_category add value if not exists 'follow_up';

do $$
begin
  begin create type public.follow_up_status as enum ('open', 'raised', 'closed');
  exception when duplicate_object then null; end;

  -- 'unknown' is the honest default: suggested but never reported back on.
  begin create type public.coping_outcome as enum ('suggested', 'tried_helpful', 'tried_unhelpful', 'not_tried', 'unknown');
  exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------------------
-- follow_up_items
--
-- Created only when the member agrees to it ("ask me next time how the
-- conversation with my partner went"). Noor may raise one, once, warmly —
-- `raised_at` exists so she does not ask twice, and so nothing accumulates
-- into a list of things the member owes her.
-- ---------------------------------------------------------------------------
create table if not exists public.follow_up_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  prompt            text not null check (char_length(prompt) between 1 and 300),
  status            public.follow_up_status not null default 'open',
  source_session_id uuid references public.sessions (id) on delete set null,
  due_after         timestamptz,
  raised_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists follow_up_items_user_idx
  on public.follow_up_items (user_id, status, created_at desc);
drop trigger if exists follow_up_items_updated_at on public.follow_up_items;
create trigger follow_up_items_updated_at before update on public.follow_up_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- coping_preferences
--
-- One row per approach per member. Exists so Noor never suggests something a
-- member has already said did not help them — the clearest possible signal
-- that nobody was listening the first time.
-- ---------------------------------------------------------------------------
create table if not exists public.coping_preferences (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  tool_slug         text not null check (char_length(tool_slug) between 1 and 120),
  outcome           public.coping_outcome not null default 'suggested',
  note              text check (note is null or char_length(note) <= 300),
  source_session_id uuid references public.sessions (id) on delete set null,
  suggested_at      timestamptz not null default now(),
  reported_at       timestamptz,
  updated_at        timestamptz not null default now(),
  unique (user_id, tool_slug)
);
create index if not exists coping_preferences_user_idx
  on public.coping_preferences (user_id, outcome);
drop trigger if exists coping_preferences_updated_at on public.coping_preferences;
create trigger coping_preferences_updated_at before update on public.coping_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — same rule as every other member-owned table
-- ---------------------------------------------------------------------------
alter table public.follow_up_items    enable row level security;
alter table public.coping_preferences enable row level security;

drop policy if exists "follow_up_items: own all" on public.follow_up_items;
create policy "follow_up_items: own all" on public.follow_up_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "coping_preferences: own all" on public.coping_preferences;
create policy "coping_preferences: own all" on public.coping_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Tell PostgREST to re-read the schema, or the new tables answer requests with
-- "Could not find the table ... in the schema cache".
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ============================================================================
-- Verify (optional) — 17 tables, all with rls_enabled = true.
--
--   select tablename, rowsecurity as rls_enabled
--     from pg_tables where schemaname = 'public' order by tablename;
-- ============================================================================
