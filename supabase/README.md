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

Either:

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

or open **SQL Editor** in the dashboard and run
`supabase/migrations/20260903000001_phase1_schema.sql` in full.

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

In the SQL editor, run as an authenticated test user that
`select * from sessions` returns only that user's rows. The
`start_wellbeing_session` / `end_wellbeing_session` functions enforce the free
session allowance server-side; `delete_my_account` removes the auth user and
cascades through every table.

## Notes

- `default_free_session_allowance()` is the single place to change the free
  allowance in the database. Keep it in step with
  `VITE_FREE_SESSION_ALLOWANCE`.
- Transcripts are written to `session_turns` only when the member has granted
  `transcript_storage` consent; long-term memory only with `long_term_memory`
  consent. Raw audio is never stored.
- `safety_events` stores state transitions only — never conversation content.
- `practitioners` ships empty. Do not insert people who have not been verified.
