-- Atomic venue replacement: DELETE + INSERT run in a single transaction.
-- If the INSERT fails the DELETE is rolled back automatically by Postgres.
-- Runs as SECURITY INVOKER so existing RLS policies still apply.
create or replace function public.replace_venues(rows jsonb)
returns void
language plpgsql
as $$
begin
  delete from public.venues;
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
