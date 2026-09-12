-- Tulip additions — run this AFTER supabase/schema.sql in the Supabase SQL editor.

create table if not exists public.location_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'Share my location',
  time_of_day time not null,
  days_of_week int[] not null default '{1,2,3,4,5,6,0}', -- 0=Sunday .. 6=Saturday
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.location_reminders enable row level security;

create policy "Reminders are managed by owner"
  on public.location_reminders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
