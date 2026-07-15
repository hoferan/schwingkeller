-- replace_venues now also round-trips each row's `photo_urls: string[]` into
-- venue_photos, correlated to the freshly-inserted venue via an explicitly
-- generated id (not RETURNING order, which Postgres doesn't guarantee to
-- match the SELECT's order for a plain INSERT ... SELECT).
create or replace function public.replace_venues(rows jsonb)
returns void
language plpgsql
security invoker
as $$
begin
  delete from public.venues where true;
  if jsonb_array_length(rows) > 0 then
    with input_rows as (
      select
        gen_random_uuid() as id,
        r->>'name' as name,
        r->>'canton' as canton,
        coalesce(r->>'address', '') as address,
        (r->>'lat')::double precision as lat,
        (r->>'lng')::double precision as lng,
        coalesce((r->>'indoor')::boolean, false) as indoor,
        coalesce((r->>'outdoor')::boolean, false) as outdoor,
        coalesce(r->>'person', '') as person,
        coalesce(r->>'phone', '') as phone,
        coalesce(r->>'website', '') as website,
        coalesce(r->'photo_urls', '[]'::jsonb) as photo_urls
      from jsonb_array_elements(rows) as r
    ),
    ins_venues as (
      insert into public.venues (id, name, canton, address, lat, lng, indoor, outdoor, person, phone, website)
      select id, name, canton, address, lat, lng, indoor, outdoor, person, phone, website
      from input_rows
    )
    insert into public.venue_photos (venue_id, url, position)
    select input_rows.id, photo.url, photo.ordinality - 1
    from input_rows
    cross join lateral jsonb_array_elements_text(input_rows.photo_urls) with ordinality as photo(url, ordinality)
    where jsonb_array_length(input_rows.photo_urls) > 0;
  end if;
end;
$$;

grant execute on function public.replace_venues(jsonb) to authenticated;
