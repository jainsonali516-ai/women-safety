-- Forgot-password flow: run this in the Supabase SQL editor (after schema_users.sql).
-- Tokens are stored hashed (never the raw token a user actually clicks) — same reasoning as
-- storing bcrypt password hashes rather than plaintext passwords.

create table if not exists public.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_resets_user_id_idx on public.password_resets (user_id);

-- RLS is enabled with no policies: only the service-role key (used exclusively by the server)
-- can read/write this table, same pattern as every other table in this app.
alter table public.password_resets enable row level security;
