-- The hosted project's default privileges give anon and authenticated TRUNCATE, REFERENCES,
-- TRIGGER and MAINTAIN on every table postgres creates in public (#85). TRUNCATE ignores RLS. No
-- PostgREST call reaches any of them, but a function running as the caller could, and the app needs
-- none of them. Each table now holds only the rights restated below.
--
-- revoke all rather than naming the four: MAINTAIN only exists from Postgres 17 on, and revoking it
-- by name fails on an older server.

revoke all on public.venues from anon, authenticated;
grant select on public.venues to anon;
grant select, insert, update, delete on public.venues to authenticated;

revoke all on public.venue_photos from anon, authenticated;
grant select on public.venue_photos to anon;
grant select, insert, update, delete on public.venue_photos to authenticated;

revoke all on public.association_levels from anon, authenticated;
grant select on public.association_levels to anon, authenticated;

revoke all on public.associations from anon, authenticated;
grant select on public.associations to anon, authenticated;

revoke all on public.association_home_areas from anon, authenticated;
grant select on public.association_home_areas to anon, authenticated;

-- A new table starts with no rights for either role. Whatever it grants them comes from the
-- migration that adds it.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
