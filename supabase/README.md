# Supabase setup

Soul Ease uses Supabase for authentication and PostgreSQL storage. All
member-owned tables are protected by Row Level Security.

## 1. Create the project

1. Sign in at https://supabase.com and create a new project (choose a region
   close to Pakistan, e.g. Mumbai/Singapore, for lower latency).
2. Wait for provisioning, then open **Project Settings → API** and copy:
   - Project URL → `VITE_SUPABASE_URL` (and `SUPABASE_URL` for functions)
   - `anon` public key → `VITE_SUPABASE_ANON_KEY` (and `SUPABASE_ANON_KEY`)

Never copy the `service_role` key into any frontend or Netlify build variable.

## 2. Apply the schema

**The application will not work until this is done.** Until the tables exist,
signing in succeeds and then every screen fails with
`Could not find the table 'public.<name>' in the schema cache` — the API is
reachable, there is simply nothing behind it.

Easiest route (no tooling to install):

1. Supabase dashboard → **SQL Editor** → **New query**
2. Paste the entire contents of
   **`supabase/migrations/20260903000001_phase1_schema.sql`**
3. **Run**

It is safe to run more than once — every object is created only if missing, and
policies and triggers are replaced rather than duplicated. If a run fails part
way through, fix the cause and run the whole file again.

Or with the CLI:

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Confirm afterwards — all 15 tables should be listed with `rls_enabled = t`:

```sql
select tablename, rowsecurity as rls_enabled
  from pg_tables where schemaname = 'public' order by tablename;
```

| Expected tables | |
| --- | --- |
| `profiles` | `consent_records` |
| `sessions` | `session_turns` |
| `session_summaries` | `assessment_runs` |
| `memory_items` | `goals` |
| `journal_entries` | `mood_checkins` |
| `saved_coping_tools` | `safety_events` |
| `usage_entitlements` | `human_support_requests` |
| `practitioners` (ships empty) | |

## 3. Configure Auth

Under **Authentication → URL configuration**:

- Site URL: your Netlify URL (e.g. `https://soul-ease.netlify.app`)
- Redirect URLs: add
  - `https://<site>/verify-email`
  - `https://<site>/reset-password`
  - `http://localhost:5173/verify-email`
  - `http://localhost:5173/reset-password`
  - the Netlify deploy-preview wildcard, e.g. `https://*--soul-ease.netlify.app/**`

Under **Authentication → Providers → Email**, keep "Confirm email" enabled.
Customise the email templates if desired — the app links to `/verify-email`
and `/reset-password`.

## 4. Verify RLS

Row Level Security is the only thing standing between one member's journal and
another member's browser, so it is worth confirming rather than assuming. In
the SQL editor, as an authenticated test user, `select * from journal_entries`
must return only that user's rows.

The migration was verified against a real PostgreSQL 16 instance before being
committed: with two members' data present, the second member saw 0 rows in
every sensitive table, could not update or delete the first member's rows,
could not insert a row carrying the first member's `user_id`, and a signed-out
visitor saw nothing anywhere.

`start_wellbeing_session` / `end_wellbeing_session` enforce the free session
allowance server-side (verified: the fourth session raises
`ENTITLEMENT_EXHAUSTED`), so the limit cannot be side-stepped from the browser.
`delete_my_account` removes the auth user and cascades through every table.

## Notes

- `default_free_session_allowance()` is the single place to change the free
  allowance in the database. Keep it in step with
  `VITE_FREE_SESSION_ALLOWANCE`.
- Transcripts are written to `session_turns` only when the member has granted
  `transcript_storage` consent; long-term memory only with `long_term_memory`
  consent. Raw audio is never stored.
- `safety_events` stores state transitions only — never conversation content.
- `practitioners` ships empty. Do not insert people who have not been verified.
- The `on_auth_user_created` trigger creates a profile and entitlement row for
  each new sign-up. The migration also backfills anyone who signed up *before*
  the schema was applied, so an account created against an empty database is
  repaired rather than left half-provisioned.
- The migration ends with `notify pgrst, 'reload schema'`. Supabase's API layer
  caches the table list, and without the reload a freshly created table can
  still answer "not found in the schema cache".
- Nothing here needs the `service_role` key. The browser uses the anon key and
  RLS decides what it can see.
