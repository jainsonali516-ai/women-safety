-- Women Safety Platform — database schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

-- ============ PROFILES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are editable by owner"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ EMERGENCY CONTACTS ============
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text,
  created_at timestamptz not null default now()
);

alter table public.emergency_contacts enable row level security;

create policy "Contacts are managed by owner"
  on public.emergency_contacts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============ SOS ALERTS ============
create table if not exists public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'resolved', 'cancelled')),
  latitude double precision not null,
  longitude double precision not null,
  message text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.sos_alerts enable row level security;

create policy "SOS alerts are managed by owner"
  on public.sos_alerts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============ LIVE LOCATION PINGS (during an active SOS) ============
create table if not exists public.sos_locations (
  id uuid primary key default gen_random_uuid(),
  sos_alert_id uuid not null references public.sos_alerts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  recorded_at timestamptz not null default now()
);

alter table public.sos_locations enable row level security;

create policy "SOS locations are managed by owner"
  on public.sos_locations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists sos_locations_alert_idx on public.sos_locations (sos_alert_id, recorded_at desc);

-- ============ INCIDENT REPORTS (community layer) ============
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'other',
  latitude double precision not null,
  longitude double precision not null,
  is_public boolean not null default true,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.incidents enable row level security;

create policy "Public incidents are viewable by everyone"
  on public.incidents for select
  using (is_public = true or auth.uid() = user_id);

create policy "Incidents are insertable by owner"
  on public.incidents for insert
  with check (auth.uid() = user_id);

create policy "Incidents are editable by owner"
  on public.incidents for update
  using (auth.uid() = user_id);

create policy "Incidents are deletable by owner"
  on public.incidents for delete
  using (auth.uid() = user_id);

create index if not exists incidents_location_idx on public.incidents (latitude, longitude);

-- ============ NEARBY INCIDENTS HELPER (haversine distance, km) ============
create or replace function public.nearby_incidents(lat double precision, lng double precision, radius_km double precision default 5)
returns setof public.incidents
language sql
stable
as $$
  select *
  from public.incidents
  where is_public = true
    and (
      6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(lat)) * cos(radians(latitude)) * cos(radians(longitude) - radians(lng))
          + sin(radians(lat)) * sin(radians(latitude))
        ))
      )
    ) <= radius_km
  order by created_at desc;
$$;
