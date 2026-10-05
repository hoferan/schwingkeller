-- The structure of the Eidgenössischer Schwingerverband (ADR 0015): the federation, its five
-- regional associations (Teilverbände) and their 29 cantonal and Gau associations. A venue
-- belongs to one of the 29; the upper levels exist for editor scopes (ADR 0016). Identifiers are
-- English, values German: the slugs end up in URLs and on printed posters, so they never change
-- once shipped.
--
-- The tree is read-only for every client. Changes to it go through migrations.
--
-- Additive and safe to run twice: the current UI keeps working against it until the verband flag
-- is switched on.

create table if not exists public.association_levels (
  id    text primary key,
  depth int  not null unique
);

insert into public.association_levels (id, depth) values
  ('federation', 0),
  ('regional', 1),
  ('cantonal', 2)
on conflict (id) do nothing;

create table if not exists public.associations (
  id          text primary key,                                    -- stable slug, used in URLs and on posters
  parent_id   text references public.associations(id),
  level       text not null references public.association_levels(id),
  name        text not null,                                       -- German name, for SQL readability; the UI uses i18n
  short       text not null,                                       -- monogram or abbreviation
  sort_order  int  not null,                                       -- order among siblings
  logo_path   text                                                 -- null: the UI draws the monogram
);

-- Names and grouping follow schlussgang.ch (Kantonal- und Gauverbände, Struktur). Parents come
-- before their children.
insert into public.associations (id, parent_id, level, name, short, sort_order) values
  ('esv', null, 'federation', 'Eidgenössischer Schwingerverband', 'ESV', 1),
  ('bksv', 'esv', 'regional', 'Berner Kantonal-Schwingerverband', 'BKSV', 1),
  ('isv', 'esv', 'regional', 'Innerschweizer Schwingerverband', 'ISV', 2),
  ('nosv', 'esv', 'regional', 'Nordostschweizer Schwingerverband', 'NOSV', 3),
  ('nwsv', 'esv', 'regional', 'Nordwestschweizer Schwingerverband', 'NWSV', 4),
  ('swsv', 'esv', 'regional', 'Südwestschweizer Schwingerverband', 'SWSV', 5),
  ('berner-jura', 'bksv', 'cantonal', 'Berner Jura', 'BJ', 1),
  ('emmental', 'bksv', 'cantonal', 'Emmental', 'EM', 2),
  ('mittelland', 'bksv', 'cantonal', 'Mittelland', 'MI', 3),
  ('oberaargau', 'bksv', 'cantonal', 'Oberaargau', 'OA', 4),
  ('oberland', 'bksv', 'cantonal', 'Oberland', 'OL', 5),
  ('seeland', 'bksv', 'cantonal', 'Seeland', 'SL', 6),
  ('luzern', 'isv', 'cantonal', 'Luzern', 'LU', 1),
  ('ob-nidwalden', 'isv', 'cantonal', 'Ob- und Nidwalden', 'UW', 2),
  ('schwyz', 'isv', 'cantonal', 'Schwyz', 'SZ', 3),
  ('tessin', 'isv', 'cantonal', 'Tessin', 'TI', 4),
  ('uri', 'isv', 'cantonal', 'Uri', 'UR', 5),
  ('zug', 'isv', 'cantonal', 'Zug', 'ZG', 6),
  ('appenzell', 'nosv', 'cantonal', 'Appenzell', 'AP', 1),
  ('glarus', 'nosv', 'cantonal', 'Glarus', 'GL', 2),
  ('graubuenden', 'nosv', 'cantonal', 'Graubünden', 'GR', 3),
  ('schaffhausen', 'nosv', 'cantonal', 'Schaffhausen', 'SH', 4),
  ('st-gallen', 'nosv', 'cantonal', 'St. Gallen', 'SG', 5),
  ('thurgau', 'nosv', 'cantonal', 'Thurgau', 'TG', 6),
  ('zuerich', 'nosv', 'cantonal', 'Zürich', 'ZH', 7),
  ('aargau', 'nwsv', 'cantonal', 'Aargau', 'AG', 1),
  ('baselland', 'nwsv', 'cantonal', 'Baselland', 'BL', 2),
  ('baselstadt', 'nwsv', 'cantonal', 'Baselstadt', 'BS', 3),
  ('solothurn', 'nwsv', 'cantonal', 'Solothurn', 'SO', 4),
  ('freiburg', 'swsv', 'cantonal', 'Freiburg', 'FR', 1),
  ('genf', 'swsv', 'cantonal', 'Genf', 'GE', 2),
  ('jura', 'swsv', 'cantonal', 'Jura', 'JU', 3),
  ('neuenburg', 'swsv', 'cantonal', 'Neuenburg', 'NE', 4),
  ('waadt', 'swsv', 'cantonal', 'Waadt', 'VD', 5),
  ('wallis', 'swsv', 'cantonal', 'Wallis', 'VS', 6)
on conflict (id) do nothing;

-- Where an association is at home: a canton, or a Verwaltungskreis inside Bern, where the canton
-- alone doesn't decide the Gau. Only used to suggest an association for a venue; the value stored
-- on the venue is the truth, so a club across a border can pick its own.
create table if not exists public.association_home_areas (
  canton         text not null,   -- 2-letter code as in venues.canton
  bern_district  text,            -- Nominatim `county` without the 'Verwaltungskreis ' prefix; BE only
  association_id text not null references public.associations(id)
);

create unique index if not exists association_home_areas_key
  on public.association_home_areas (canton, coalesce(bern_district, ''));

-- Liechtenstein has no row: the app's canton list has no FL, so no venue can be filed there.
insert into public.association_home_areas (canton, bern_district, association_id) values
  ('ZH', null, 'zuerich'),
  ('LU', null, 'luzern'),
  ('UR', null, 'uri'),
  ('SZ', null, 'schwyz'),
  ('OW', null, 'ob-nidwalden'),
  ('NW', null, 'ob-nidwalden'),
  ('GL', null, 'glarus'),
  ('ZG', null, 'zug'),
  ('FR', null, 'freiburg'),
  ('SO', null, 'solothurn'),
  ('BS', null, 'baselstadt'),
  ('BL', null, 'baselland'),
  ('SH', null, 'schaffhausen'),
  ('AR', null, 'appenzell'),
  ('AI', null, 'appenzell'),
  ('SG', null, 'st-gallen'),
  ('GR', null, 'graubuenden'),
  ('AG', null, 'aargau'),
  ('TG', null, 'thurgau'),
  ('TI', null, 'tessin'),
  ('VD', null, 'waadt'),
  ('VS', null, 'wallis'),
  ('NE', null, 'neuenburg'),
  ('GE', null, 'genf'),
  ('JU', null, 'jura'),
  ('BE', 'Berner Jura', 'berner-jura'),
  ('BE', 'Biel/Bienne', 'seeland'),
  ('BE', 'Seeland', 'seeland'),
  ('BE', 'Oberaargau', 'oberaargau'),
  ('BE', 'Emmental', 'emmental'),
  ('BE', 'Bern-Mittelland', 'mittelland'),
  ('BE', 'Thun', 'oberland'),
  ('BE', 'Frutigen-Niedersimmental', 'oberland'),
  ('BE', 'Interlaken-Oberhasli', 'oberland'),
  ('BE', 'Obersimmental-Saanen', 'oberland')
on conflict (canton, coalesce(bern_district, '')) do nothing;

-- Public read, no writes for any client.
alter table public.association_levels enable row level security;
drop policy if exists "association_levels_public_read" on public.association_levels;
create policy "association_levels_public_read" on public.association_levels
  for select using (true);
grant select on public.association_levels to anon, authenticated;

alter table public.associations enable row level security;
drop policy if exists "associations_public_read" on public.associations;
create policy "associations_public_read" on public.associations
  for select using (true);
grant select on public.associations to anon, authenticated;

alter table public.association_home_areas enable row level security;
drop policy if exists "association_home_areas_public_read" on public.association_home_areas;
create policy "association_home_areas_public_read" on public.association_home_areas
  for select using (true);
grant select on public.association_home_areas to anon, authenticated;
