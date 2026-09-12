-- Custom auth: run this in the Supabase SQL editor (after schema.sql and schema_tulip.sql).
-- Replaces Supabase Auth's auth.users as the identity source — the app now hashes passwords
-- itself (bcrypt) and issues its own JWT session cookie instead of using Supabase Auth.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text not null unique,
  phone text,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists users_email_lower_idx on public.users (lower(email));

-- RLS is enabled with no policies: only the service-role key (used exclusively by the server,
-- never exposed to the browser) can read/write this table. All authorization for who can see
-- what is enforced in application code (each API route filters by the session's user id).
alter table public.users enable row level security;
