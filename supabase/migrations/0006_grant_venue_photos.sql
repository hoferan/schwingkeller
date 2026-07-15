-- Fix: PostgREST returns 42501 (insufficient_privilege) for anon on
-- `venues?select=*,venue_photos(...)` in production.
--
-- Root cause: `venue_photos` (added in 0004) has a permissive RLS SELECT policy
-- (`using (true)`), but RLS is only consulted *after* the role holds a
-- table-level SELECT privilege. The `anon`/`authenticated` roles never received
-- a GRANT on this table. `venues` works because its grant predates this table
-- (a one-time `GRANT ... ON ALL TABLES` / dashboard exposure covers only tables
-- that existed at that moment; migration-created tables are not retroactively
-- covered). Local Supabase masks this via default privileges, so it only failed
-- in prod. These grants are idempotent and safe to re-apply.
grant select on public.venue_photos to anon;
grant select, insert, update, delete on public.venue_photos to authenticated;
grant all on public.venue_photos to service_role;
