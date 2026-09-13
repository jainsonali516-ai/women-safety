-- Enables phone-number login alongside email login. Run after schema_users.sql.
--
-- `phone` had no uniqueness constraint before this — fine when it was just a profile field, not
-- safe once it's also a login lookup key (two accounts sharing a phone value would make a login
-- query ambiguous). This adds a partial unique index (NULLs, i.e. no-phone-set, stay unrestricted).
--
-- If this fails on a real database with pre-existing duplicate/malformed phone values, those
-- rows need manual cleanup first — this project has too little existing user data for an
-- automated best-effort SQL normalization pass to be worth the risk of silently corrupting data.
create unique index if not exists users_phone_idx on public.users (phone) where phone is not null;
