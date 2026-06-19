-- venues table
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  canton text not null,
  address text default '',
  lat double precision,
  lng double precision,
  indoor boolean not null default false,
  outdoor boolean not null default false,
  person text default '',
  phone text default '',
  website text default '',
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_venues_updated_at on public.venues;
create trigger trg_venues_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

-- Row Level Security: public read, authenticated write
alter table public.venues enable row level security;

create policy "venues_public_read" on public.venues
  for select using (true);

create policy "venues_auth_insert" on public.venues
  for insert to authenticated with check (true);

create policy "venues_auth_update" on public.venues
  for update to authenticated using (true) with check (true);

create policy "venues_auth_delete" on public.venues
  for delete to authenticated using (true);

-- Storage bucket for venue photos
insert into storage.buckets (id, name, public)
values ('venue-photos', 'venue-photos', true)
on conflict (id) do nothing;

create policy "venue_photos_public_read" on storage.objects
  for select using (bucket_id = 'venue-photos');

create policy "venue_photos_auth_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'venue-photos');

create policy "venue_photos_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'venue-photos');

create policy "venue_photos_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'venue-photos');
