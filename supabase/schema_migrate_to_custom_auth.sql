-- Run this AFTER schema_users.sql. Migrates every table's user_id foreign key from
-- Supabase Auth's auth.users to the new public.users table, since the app now manages its
-- own accounts (bcrypt + JWT) instead of Supabase Auth. Safe to run even if some of these
-- tables/constraints don't exist yet in your project.

-- Retire the Supabase-Auth-triggered profile creation — no longer relevant since signup no
-- longer goes through supabase.auth.signUp().
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

alter table public.emergency_contacts drop constraint if exists emergency_contacts_user_id_fkey;
alter table public.emergency_contacts add constraint emergency_contacts_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

alter table public.sos_alerts drop constraint if exists sos_alerts_user_id_fkey;
alter table public.sos_alerts add constraint sos_alerts_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

alter table public.sos_locations drop constraint if exists sos_locations_user_id_fkey;
alter table public.sos_locations add constraint sos_locations_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

alter table public.incidents drop constraint if exists incidents_user_id_fkey;
alter table public.incidents add constraint incidents_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

alter table public.location_reminders drop constraint if exists location_reminders_user_id_fkey;
alter table public.location_reminders add constraint location_reminders_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

-- public.profiles was tied 1:1 to Supabase Auth users (its id *is* the auth.users id) and is
-- no longer written to or read by the app now that public.users holds full_name/phone/email
-- directly. Left in place rather than dropped, in case it holds data you still want.
