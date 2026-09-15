-- Migrates password_resets from single-use link tokens to 6-digit OTP codes.
-- Run this in the Supabase SQL editor AFTER schema_password_resets.sql.

-- The old token was a 32-byte random hex string (effectively unguessable), so a global
-- `unique` constraint on token_hash was safe. A 6-digit OTP has only 1,000,000 possible
-- values, so a global unique constraint becomes both a collision risk across concurrent
-- users and an existence oracle. Drop it — lookups are now scoped by user_id instead.
alter table public.password_resets drop constraint if exists password_resets_token_hash_key;

-- Brute-force protection: lock a code out after too many wrong attempts.
alter table public.password_resets add column if not exists attempts integer not null default 0;

-- Rename to reflect that this now stores an OTP hash, not a link-token hash.
alter table public.password_resets rename column token_hash to otp_hash;

-- Composite index for the new lookup pattern (scoped by user, not a global unique key).
create index if not exists password_resets_user_id_otp_hash_idx
  on public.password_resets (user_id, otp_hash);
