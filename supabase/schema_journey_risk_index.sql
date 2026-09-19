-- Journey Risk Index + real safety-alert pipeline (Gmail SMTP + existing WhatsApp).
-- Run this in the Supabase SQL editor after deploying the matching code.
-- Follows this project's existing convention: a standalone schema_*.sql file per feature,
-- applied manually (see schema_password_resets.sql etc. for precedent) rather than a
-- migrations-runner setup.

-- 1. Trusted Contacts: add email + a per-contact alert toggle. Additive only — no existing
-- column is touched, no existing row is affected (email defaults to null, alerts_enabled
-- defaults to true so existing contacts keep behaving as "reachable" once an email is added).
alter table public.emergency_contacts
  add column if not exists email text,
  add column if not exists alerts_enabled boolean not null default true;

-- 2. Active journeys, synced server-side so the cron evaluator can see them even when the
-- user's browser is closed/offline. The client-side localStorage timer (useJourneyTimer.ts)
-- remains the source of truth for the live countdown UI; this table exists purely so a
-- server process can independently know a journey exists and where it's headed.
create table if not exists public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  origin_label text not null,
  destination_label text not null,
  origin_lat double precision,
  origin_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  started_at timestamptz not null default now(),
  eta_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'safe', 'expired_unresolved', 'cancelled')),
  missed_checkins integer not null default 0,
  last_known_latitude double precision,
  last_known_longitude double precision,
  last_known_location_at timestamptz,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists journeys_user_status_idx on public.journeys (user_id, status);

-- 3. Location points synced during an active journey — same shape as the existing
-- sos_locations table (parent-session id + lat/lng + recorded_at), reused deliberately for
-- consistency rather than inventing a different shape for a near-identical concept.
create table if not exists public.journey_locations (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  recorded_at timestamptz not null default now()
);
create index if not exists journey_locations_journey_idx on public.journey_locations (journey_id, recorded_at desc);

-- 4. One row per escalation actually sent, with a uniqueness constraint on (journey_id,
-- risk_level) as the idempotency key — a given journey only ever triggers ONE alert per risk
-- band it reaches (re-triggering at the SAME band is a no-op; reaching a HIGHER band creates a
-- new row and a new alert). This is the duplicate-alert protection required by the spec.
create table if not exists public.safety_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  journey_id uuid not null references public.journeys (id) on delete cascade,
  journey_risk_index integer not null,
  risk_level text not null check (risk_level in ('LOW', 'ATTENTION', 'CONCERN', 'CRITICAL')),
  reasons jsonb not null default '[]'::jsonb,
  last_known_latitude double precision,
  last_known_longitude double precision,
  last_known_location_at timestamptz,
  recipient text,
  email_status text not null default 'not_triggered' check (email_status in ('not_triggered', 'sending', 'sent', 'failed')),
  whatsapp_status text not null default 'not_triggered' check (whatsapp_status in ('not_triggered', 'ready', 'sent', 'failed')),
  demo_mode boolean not null default false,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (journey_id, risk_level)
);
create index if not exists safety_alerts_journey_idx on public.safety_alerts (journey_id);
