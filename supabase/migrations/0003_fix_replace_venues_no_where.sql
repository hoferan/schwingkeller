-- pg_safeupdate (enabled by default on Supabase) blocks DELETE without a WHERE clause
-- (error 21000). Add WHERE true to satisfy the safety check while still deleting all rows.
--
-- SECURITY INVOKER is safe here: the "venues_auth_delete" RLS policy uses USING (true),
-- so any authenticated caller can delete all rows. TRUNCATE would require granting
-- TRUNCATE privilege to the authenticated role, which we deliberately avoid.
create or replace function public.replace_venues(rows jsonb)
returns void
language plpgsql
security invoker
as $$
begin
  delete from public.venues where true;
  if jsonb_array_length(rows) > 0 then
    insert into public.venues (name, canton, address, lat, lng, indoor, outdoor, person, phone, website, photo_url)
    select
      r->>'name',
      r->>'canton',
      coalesce(r->>'address', ''),
      (r->>'lat')::double precision,
      (r->>'lng')::double precision,
      coalesce((r->>'indoor')::boolean, false),
      coalesce((r->>'outdoor')::boolean, false),
      coalesce(r->>'person', ''),
      coalesce(r->>'phone', ''),
      coalesce(r->>'website', ''),
      r->>'photo_url'
    from jsonb_array_elements(rows) as r;
  end if;
end;
$$;

-- Repeated for idempotency: CREATE OR REPLACE preserves grants but a fresh db reset
-- replays all migrations in order, so the grant from 0002 still covers this run.
grant execute on function public.replace_venues(jsonb) to authenticated;
