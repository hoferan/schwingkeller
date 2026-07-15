-- venue_photos: one row per photo, ordered by `position` within a venue.
create table public.venue_photos (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index venue_photos_venue_id_idx on public.venue_photos(venue_id);

-- Row Level Security: same public-read / authenticated-write shape as `venues`.
alter table public.venue_photos enable row level security;

-- Note: these policy names intentionally match the pre-existing storage.objects
-- policies from 0001_init.sql (which guard the `venue-photos` Storage bucket) —
-- they live on a different table/schema, so there's no naming conflict, but
-- don't confuse the two when reading `pg_policies`.
drop policy if exists "venue_photos_public_read" on public.venue_photos;
create policy "venue_photos_public_read" on public.venue_photos
  for select using (true);

drop policy if exists "venue_photos_auth_insert" on public.venue_photos;
create policy "venue_photos_auth_insert" on public.venue_photos
  for insert to authenticated with check (true);

drop policy if exists "venue_photos_auth_update" on public.venue_photos;
create policy "venue_photos_auth_update" on public.venue_photos
  for update to authenticated using (true) with check (true);

drop policy if exists "venue_photos_auth_delete" on public.venue_photos;
create policy "venue_photos_auth_delete" on public.venue_photos
  for delete to authenticated using (true);

-- Enforce the 6-photos-per-venue cap at the database level (belt-and-suspenders
-- alongside the UI limit), so it holds even against direct API calls.
create or replace function public.enforce_venue_photo_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.venue_photos where venue_id = new.venue_id) >= 6 then
    raise exception 'venue % already has the maximum of 6 photos', new.venue_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_venue_photos_limit on public.venue_photos;
create trigger trg_venue_photos_limit
  before insert on public.venue_photos
  for each row execute function public.enforce_venue_photo_limit();

-- Backfill: copy each venue's existing single photo into the new gallery as
-- photo #1, before the old column is dropped.
insert into public.venue_photos (venue_id, url, position)
select id, photo_url, 0
from public.venues
where photo_url is not null;

alter table public.venues drop column photo_url;

-- 5MB per-photo cap at the Storage bucket level (client also compresses/rejects
-- before upload; this is the server-side backstop).
update storage.buckets set file_size_limit = 5242880 where id = 'venue-photos';
