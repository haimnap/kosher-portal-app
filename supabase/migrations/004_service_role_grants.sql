-- ============================================================
-- 004 — Let the portal's server read and write the tables
-- ============================================================
-- The portal's server-side code (Monday sync, expiration reminders,
-- certificate jobs) uses Supabase's "service_role". In this project
-- that role was never given permission on the tables, so those
-- features fail with "permission denied for table ...".
-- Safe to run more than once.
-- ============================================================

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Also for tables created in the future.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
