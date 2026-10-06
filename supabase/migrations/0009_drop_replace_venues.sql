-- replace_venues lost its last caller when the app dropped the JSON and CSV import (#98). It
-- deleted every venue before inserting the rows it was given, and every signed-in user could run
-- it. ADR 0018 records the removal and what a new import would need.
--
-- Safe to run twice.
drop function if exists public.replace_venues(jsonb);
