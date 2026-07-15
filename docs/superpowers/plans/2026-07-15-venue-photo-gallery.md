# Venue Photo Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `photo_url` field on a venue with a gallery of up to 6 photos, viewable as a swipeable carousel in the detail view and manageable (add/delete/reorder) in the admin edit form.

**Architecture:** A new `venue_photos` table (FK to `venues`, cascade delete, RLS mirroring `venues`, DB-enforced 6-photo cap) replaces the `photo_url` column. The client fetches photos embedded in the same `listVenues()` query, edits them as local draft state in the admin form, and persists changes via a diffing `syncVenuePhotos` call on save. The detail view renders them with an Embla carousel; the admin editor reorders them with dnd-kit.

**Tech Stack:** React 19, TypeScript, Supabase (Postgres + RLS + Storage), TanStack Query, Vitest + React Testing Library, `embla-carousel-react`, `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`.

**Spec:** `docs/superpowers/specs/2026-07-15-venue-photo-gallery-design.md`

## Global Constraints

- Max 6 photos per venue (DB trigger + UI enforcement).
- Max 5MB per photo after client-side compression (bucket `file_size_limit` + client pre-check).
- No `any` — use proper types or `unknown`.
- All new user-facing strings need DE/FR/IT keys in `src/i18n/translations.ts` (`STR.de`/`STR.fr`/`STR.it` must all gain the same keys).
- All Supabase writes go through RLS-authenticated calls — never the service-role key on the client.
- New npm dependencies: `embla-carousel-react`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (already discussed and approved in the design spec — no further discussion needed).
- Run `npm run lint` and `npm run test` before considering any task's UI/API code complete; the final task also runs `npm run typecheck` and `npm run build`.

---

## Task 1: Database migration — `venue_photos` table

**Files:**
- Create: `supabase/migrations/0004_venue_photos.sql`

**Interfaces:**
- Produces: table `public.venue_photos(id uuid, venue_id uuid, url text, position integer, created_at timestamptz)`, RLS policies on it, a `before insert` cap trigger, and a `venue-photos` Storage bucket with `file_size_limit = 5242880` (5MB). `public.venues.photo_url` no longer exists after this migration.

- [ ] **Step 1: Write the migration file**

```sql
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
```

- [ ] **Step 2: Verify locally with the docker-compose stack**

The migration's `storage.buckets` update (and 0001_init.sql's bucket insert) need the `storage` schema to already exist — that's created by the `storage` service's own bootstrap on first boot, not by the bare Postgres container. So bring up `storage` rather than just `db`; Compose resolves its dependency chain (`db`, `rest`, `imgproxy`) automatically:

Run: `docker compose up -d storage --wait` (blocks until `storage`, and everything it depends on, reports healthy).

Then apply the migration and check the schema:

```bash
docker exec -i schwingkeller-db psql -U postgres -d postgres < supabase/migrations/0001_init.sql
docker exec -i schwingkeller-db psql -U postgres -d postgres < supabase/migrations/0002_replace_venues_fn.sql
docker exec -i schwingkeller-db psql -U postgres -d postgres < supabase/migrations/0003_fix_replace_venues_no_where.sql
docker exec -i schwingkeller-db psql -U postgres -d postgres < supabase/migrations/0004_venue_photos.sql
docker exec -i schwingkeller-db psql -U postgres -d postgres -c "\d venue_photos"
docker exec -i schwingkeller-db psql -U postgres -d postgres -c "\d venues"
docker exec -i schwingkeller-db psql -U postgres -d postgres -c "select policyname from pg_policies where tablename = 'venue_photos';"
docker exec -i schwingkeller-db psql -U postgres -d postgres -c "select file_size_limit from storage.buckets where id = 'venue-photos';"
```

Expected: `\d venue_photos` shows the 5 columns and the FK to `venues`; `\d venues` no longer lists `photo_url`; the policies query lists all 4 policy names; the bucket query returns `5242880`.

- [ ] **Step 3: Verify the cap trigger and cascade delete**

```bash
docker exec -i schwingkeller-db psql -U postgres -d postgres -c "
insert into venues (name, canton) values ('Test', 'BE') returning id;
"
# copy the returned id into $VID below
docker exec -i schwingkeller-db psql -U postgres -d postgres -c "
insert into venue_photos (venue_id, url, position) select '<VID>', 'https://example.com/' || g, g from generate_series(0,5) g;
"
docker exec -i schwingkeller-db psql -U postgres -d postgres -c "
insert into venue_photos (venue_id, url, position) values ('<VID>', 'https://example.com/7', 6);
"
```

Expected: the second insert (7th photo) fails with `venue <VID> already has the maximum of 6 photos`. Then:

```bash
docker exec -i schwingkeller-db psql -U postgres -d postgres -c "delete from venues where id = '<VID>';"
docker exec -i schwingkeller-db psql -U postgres -d postgres -c "select count(*) from venue_photos where venue_id = '<VID>';"
```

Expected: count is `0` (cascade delete removed the photos).

- [ ] **Step 4: Tear down and commit**

```bash
docker compose down
git add supabase/migrations/0004_venue_photos.sql
git commit -m "feat: add venue_photos table, replacing photo_url"
```

---

## Task 2: `VenuePhoto` type and photo constants/helpers

**Files:**
- Modify: `src/features/venues/types.ts`
- Create: `src/features/venues/photos.ts`
- Test: `src/features/venues/photos.test.ts`

**Interfaces:**
- Produces: `VenuePhoto { id: string; url: string; position: number }`, `Venue.photos: VenuePhoto[]` (replacing `photo_url`), `VenueInput = Omit<Venue, 'id' | 'photos'>`, `MAX_PHOTOS = 6`, `coverPhotoUrl(venue: Venue): string | null`.

- [ ] **Step 1: Write the failing test for `coverPhotoUrl`**

```ts
// src/features/venues/photos.test.ts
import { describe, it, expect } from 'vitest';
import { coverPhotoUrl, MAX_PHOTOS } from './photos';
import type { Venue } from './types';

const baseVenue: Venue = {
  id: 'v1', name: 'Test', canton: 'BE', address: '', lat: 46.8, lng: 8.2,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [],
};

describe('coverPhotoUrl', () => {
  it('returns null when there are no photos', () => {
    expect(coverPhotoUrl(baseVenue)).toBeNull();
  });

  it('returns the position-0 photo url when photos exist', () => {
    const venue: Venue = {
      ...baseVenue,
      photos: [
        { id: 'p1', url: 'https://example.com/1.jpg', position: 0 },
        { id: 'p2', url: 'https://example.com/2.jpg', position: 1 },
      ],
    };
    expect(coverPhotoUrl(venue)).toBe('https://example.com/1.jpg');
  });
});

describe('MAX_PHOTOS', () => {
  it('is 6', () => {
    expect(MAX_PHOTOS).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/venues/photos.test.ts`
Expected: FAIL — `Cannot find module './photos'`.

- [ ] **Step 3: Update the `Venue`/`VenueInput` types**

```ts
// src/features/venues/types.ts
export interface VenuePhoto {
  id: string;
  url: string;
  position: number;
}

export interface Venue {
  id: string;
  name: string;
  canton: string;
  address: string;
  lat: number;
  lng: number;
  indoor: boolean;
  outdoor: boolean;
  person: string;
  phone: string;
  website: string;
  photos: VenuePhoto[];
}

export type VenueInput = Omit<Venue, 'id' | 'photos'>;
```

- [ ] **Step 4: Write `photos.ts`**

```ts
// src/features/venues/photos.ts
import type { Venue } from './types';

export const MAX_PHOTOS = 6;

export const coverPhotoUrl = (venue: Venue): string | null =>
  venue.photos.find((p) => p.position === 0)?.url ?? venue.photos[0]?.url ?? null;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/venues/photos.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/venues/types.ts src/features/venues/photos.ts src/features/venues/photos.test.ts
git commit -m "feat: add VenuePhoto type and cover-photo helper"
```

*(Other files referencing `venue.photo_url` will fail to typecheck until later tasks update them — expected mid-plan; the final task's full `npm run typecheck` confirms everything lines up.)*

---

## Task 3: `api.ts` — gallery-aware reads/writes

**Files:**
- Modify: `src/features/venues/api.ts`
- Modify: `src/features/venues/api.test.ts`

**Interfaces:**
- Consumes: `VenuePhoto`, `Venue`, `VenueInput` from `./types` (Task 2).
- Produces: `listVenues(): Promise<Venue[]>` (now includes `photos`), `createVenue`/`updateVenue` (unchanged signatures, return `photos: []`), `insertVenuePhoto(venueId: string, url: string, position: number): Promise<VenuePhoto>`, `deleteVenuePhoto(id: string): Promise<void>`, `updateVenuePhotoPosition(id: string, position: number): Promise<void>`, `syncVenuePhotos(venueId: string, original: VenuePhoto[], draft: VenuePhoto[]): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

```ts
// Add to src/features/venues/api.test.ts, replacing the existing `order.mockResolvedValue`
// call in the first `listVenues` test and the `SAMPLE_VENUE` fixture (both shown in full below),
// and appending the new `describe` blocks.

// Replace the existing mock setup at the top of the file with one that also
// supports insert/delete/eq/update chains used by the new photo functions:
const { order, from, rpc, insert, update, del, eq, single } = vi.hoisted(() => {
  const single = vi.fn();
  const eq = vi.fn(() => ({ select, single }));
  const order = vi.fn();
  const select = vi.fn(() => ({ order, single, eq }));
  const insert = vi.fn(() => ({ select, eq }));
  const update = vi.fn(() => ({ eq }));
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select, insert, update, delete: del }));
  const rpc = vi.fn();
  return { order, from, rpc, insert, update, del, eq, single };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc } }));

import {
  listVenues, replaceAllVenues, insertVenuePhoto, deleteVenuePhoto,
  updateVenuePhotoPosition, syncVenuePhotos,
} from './api';
import type { VenueInput, VenuePhoto } from './types';

beforeEach(() => { vi.clearAllMocks(); });

describe('listVenues', () => {
  it('selects venues with embedded venue_photos, ordered by name', async () => {
    order.mockResolvedValue({
      data: [{
        id: '1', name: 'A',
        venue_photos: [
          { id: 'p2', url: 'u2', position: 1 },
          { id: 'p1', url: 'u1', position: 0 },
        ],
      }],
      error: null,
    });
    const result = await listVenues();
    expect(from).toHaveBeenCalledWith('venues');
    expect(select).toHaveBeenCalledWith('*, venue_photos(id,url,position)');
    expect(order).toHaveBeenCalledWith('name');
    expect(result).toEqual([{
      id: '1', name: 'A',
      photos: [{ id: 'p1', url: 'u1', position: 0 }, { id: 'p2', url: 'u2', position: 1 }],
    }]);
  });

  it('throws with error code prefix when Supabase returns an error', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'relation not found', code: '42P01' } });
    await expect(listVenues()).rejects.toThrow('[42P01] relation not found');
  });
});

describe('venue_photos CRUD', () => {
  it('insertVenuePhoto inserts a row and returns it', async () => {
    single.mockResolvedValue({ data: { id: 'p1', url: 'u1', position: 0 }, error: null });
    const result = await insertVenuePhoto('v1', 'u1', 0);
    expect(from).toHaveBeenCalledWith('venue_photos');
    expect(insert).toHaveBeenCalledWith({ venue_id: 'v1', url: 'u1', position: 0 });
    expect(result).toEqual({ id: 'p1', url: 'u1', position: 0 });
  });

  it('deleteVenuePhoto deletes by id', async () => {
    eq.mockResolvedValueOnce({ error: null });
    await deleteVenuePhoto('p1');
    expect(from).toHaveBeenCalledWith('venue_photos');
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 'p1');
  });

  it('updateVenuePhotoPosition updates position by id', async () => {
    eq.mockResolvedValueOnce({ error: null });
    await updateVenuePhotoPosition('p1', 2);
    expect(update).toHaveBeenCalledWith({ position: 2 });
    expect(eq).toHaveBeenCalledWith('id', 'p1');
  });
});

describe('syncVenuePhotos', () => {
  const original: VenuePhoto[] = [
    { id: 'p1', url: 'u1', position: 0 },
    { id: 'p2', url: 'u2', position: 1 },
  ];

  it('deletes photos removed from the draft', async () => {
    eq.mockResolvedValue({ error: null });
    await syncVenuePhotos('v1', original, [original[0]]);
    expect(del).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith('id', 'p2');
  });

  it('inserts new photos (no matching id in original) at their draft index', async () => {
    single.mockResolvedValue({ data: {}, error: null });
    eq.mockResolvedValue({ error: null });
    const draft: VenuePhoto[] = [...original, { id: 'new-1', url: 'u3', position: 0 }];
    await syncVenuePhotos('v1', original, draft);
    expect(insert).toHaveBeenCalledWith({ venue_id: 'v1', url: 'u3', position: 2 });
  });

  it('updates position only for existing photos whose index changed', async () => {
    eq.mockResolvedValue({ error: null });
    const reordered: VenuePhoto[] = [original[1], original[0]];
    await syncVenuePhotos('v1', original, reordered);
    expect(update).toHaveBeenCalledWith({ position: 0 });
    expect(update).toHaveBeenCalledWith({ position: 1 });
  });

  it('does nothing when the draft matches the original', async () => {
    await syncVenuePhotos('v1', original, original);
    expect(del).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
```

Also update the pre-existing `SAMPLE_VENUE` fixture in the same file (used by the `replaceAllVenues` tests) to drop `photo_url`:

```ts
const SAMPLE_VENUE: VenueInput = {
  name: 'Testkeller', canton: 'BE', address: 'Musterweg 1', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '',
};
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/venues/api.test.ts`
Expected: FAIL — `insertVenuePhoto`/`deleteVenuePhoto`/`updateVenuePhotoPosition`/`syncVenuePhotos` are not exported yet, and `listVenues`'s `select` assertion doesn't match the current call.

- [ ] **Step 3: Update `api.ts`**

```ts
import { supabase } from '../../lib/supabase';
import type { Venue, VenueInput, VenuePhoto } from './types';

const toError = (e: { message: string; code?: string; hint?: string; details?: string }): Error => {
  const err = new Error(e.code ? `[${e.code}] ${e.message}` : e.message);
  err.cause = e;
  return err;
};

interface VenueRow {
  id: string;
  name: string;
  canton: string;
  address: string;
  lat: number;
  lng: number;
  indoor: boolean;
  outdoor: boolean;
  person: string;
  phone: string;
  website: string;
  venue_photos: VenuePhoto[];
}

const toVenue = (row: VenueRow): Venue => {
  const { venue_photos, ...rest } = row;
  return { ...rest, photos: [...venue_photos].sort((a, b) => a.position - b.position) };
};

export const listVenues = async (): Promise<Venue[]> => {
  const { data, error } = await supabase
    .from('venues')
    .select('*, venue_photos(id,url,position)')
    .order('name');
  if (error) throw toError(error);
  return ((data ?? []) as unknown as VenueRow[]).map(toVenue);
};

export const createVenue = async (input: VenueInput): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').insert(input).select().single();
  if (error) throw toError(error);
  return { ...(data as Omit<Venue, 'photos'>), photos: [] };
};

export const updateVenue = async (id: string, input: Partial<VenueInput>): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').update(input).eq('id', id).select().single();
  if (error) throw toError(error);
  return { ...(data as Omit<Venue, 'photos'>), photos: [] };
};

export const removeVenue = async (id: string): Promise<void> => {
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) throw toError(error);
};

export const replaceAllVenues = async (venues: VenueInput[]): Promise<void> => {
  const { error } = await supabase.rpc('replace_venues', { rows: venues });
  if (error) throw toError(error);
};

export const insertVenuePhoto = async (venueId: string, url: string, position: number): Promise<VenuePhoto> => {
  const { data, error } = await supabase
    .from('venue_photos')
    .insert({ venue_id: venueId, url, position })
    .select()
    .single();
  if (error) throw toError(error);
  return data as VenuePhoto;
};

export const deleteVenuePhoto = async (id: string): Promise<void> => {
  const { error } = await supabase.from('venue_photos').delete().eq('id', id);
  if (error) throw toError(error);
};

export const updateVenuePhotoPosition = async (id: string, position: number): Promise<void> => {
  const { error } = await supabase.from('venue_photos').update({ position }).eq('id', id);
  if (error) throw toError(error);
};

export const syncVenuePhotos = async (
  venueId: string,
  original: VenuePhoto[],
  draft: VenuePhoto[],
): Promise<void> => {
  const draftIds = new Set(draft.map((p) => p.id));
  const removed = original.filter((p) => !draftIds.has(p.id));
  for (const p of removed) await deleteVenuePhoto(p.id);

  const originalById = new Map(original.map((p) => [p.id, p]));
  for (let i = 0; i < draft.length; i++) {
    const p = draft[i];
    const existing = originalById.get(p.id);
    if (existing) {
      if (existing.position !== i) await updateVenuePhotoPosition(p.id, i);
    } else {
      await insertVenuePhoto(venueId, p.url, i);
    }
  }
};
```

*(The `uploadPhoto` function stays for now — it's rewritten in Task 4.)*

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/venues/api.test.ts`
Expected: PASS (all tests, including the pre-existing `replaceAllVenues` ones which are unaffected by this task's changes since the mock chain is backward-compatible).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/api.ts src/features/venues/api.test.ts
git commit -m "feat: read/write venue photo galleries via venue_photos table"
```

---

## Task 4: Client-side image compression before upload

**Files:**
- Create: `src/features/venues/imageCompression.ts`
- Test: `src/features/venues/imageCompression.test.ts`
- Modify: `src/features/venues/api.ts` (the `uploadPhoto` function)
- Modify: `src/features/venues/api.test.ts` (add `uploadPhoto` tests)

**Interfaces:**
- Produces: `PhotoTooLargeError` (class extending `Error`), `compressImageIfNeeded(file: File): Promise<File>`.
- Consumes (Task 3): none directly; `api.ts`'s `uploadPhoto` calls `compressImageIfNeeded` and re-exports `PhotoTooLargeError`.

- [ ] **Step 1: Write the failing test for `compressImageIfNeeded`**

```ts
// src/features/venues/imageCompression.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImageIfNeeded } from './imageCompression';

const makeFile = (size: number, name = 'photo.jpg', type = 'image/jpeg') =>
  new File([new Uint8Array(size)], name, { type });

describe('compressImageIfNeeded', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).createImageBitmap;
  });

  it('returns the original file unchanged when already under the threshold', async () => {
    const file = makeFile(1024);
    const result = await compressImageIfNeeded(file);
    expect(result).toBe(file);
  });

  it('downscales and re-encodes a file over the threshold', async () => {
    const file = makeFile(6 * 1024 * 1024);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(function (this: HTMLCanvasElement, cb: BlobCallback) {
        cb(new Blob(['x'], { type: 'image/jpeg' }));
      });

    const result = await compressImageIfNeeded(file);

    expect(drawImage).toHaveBeenCalled();
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('photo.jpg');
    expect(result.size).toBeLessThan(file.size);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/venues/imageCompression.test.ts`
Expected: FAIL — `Cannot find module './imageCompression'`.

- [ ] **Step 3: Write `imageCompression.ts`**

```ts
// src/features/venues/imageCompression.ts
const COMPRESS_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5MB — matches the Storage bucket cap
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

export class PhotoTooLargeError extends Error {
  constructor() {
    super('Photo exceeds the 5MB limit even after compression.');
    this.name = 'PhotoTooLargeError';
  }
}

export const compressImageIfNeeded = async (file: File): Promise<File> => {
  if (file.size <= COMPRESS_THRESHOLD_BYTES) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  bitmap.close();
  if (!ctx) return file;
  ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) return file;

  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/venues/imageCompression.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing `uploadPhoto` tests**

Add to `src/features/venues/api.test.ts`:

```ts
vi.mock('./imageCompression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./imageCompression')>();
  return { ...actual, compressImageIfNeeded: vi.fn(async (f: File) => f) };
});

import { uploadPhoto } from './api';
import { compressImageIfNeeded, PhotoTooLargeError } from './imageCompression';

describe('uploadPhoto', () => {
  const upload = vi.fn();
  const getPublicUrl = vi.fn();
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).storage = { from: vi.fn(() => ({ upload, getPublicUrl })) };
    upload.mockResolvedValue({ error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/x.jpg' } });
  });

  it('compresses, uploads, and returns the public URL', async () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const url = await uploadPhoto(file);
    expect(compressImageIfNeeded).toHaveBeenCalledWith(file);
    expect(upload).toHaveBeenCalled();
    expect(url).toBe('https://cdn.example.com/x.jpg');
  });

  it('throws PhotoTooLargeError when the compressed file is still over 5MB', async () => {
    vi.mocked(compressImageIfNeeded).mockResolvedValueOnce(
      new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' }),
    );
    const file = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
    await expect(uploadPhoto(file)).rejects.toBeInstanceOf(PhotoTooLargeError);
    expect(upload).not.toHaveBeenCalled();
  });
});
```

This test file needs `supabase` imported directly (for the `storage` stub above) — add `import { supabase } from '../../lib/supabase';` near the top of the test file if not already present (it's mocked via `vi.mock('../../lib/supabase', ...)` already, so this import resolves to the mock).

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run src/features/venues/api.test.ts`
Expected: FAIL — `uploadPhoto` doesn't call `compressImageIfNeeded` yet, and `PhotoTooLargeError` isn't exported from `./imageCompression` usage in `api.ts`.

- [ ] **Step 7: Update `uploadPhoto` in `api.ts`**

```ts
import { compressImageIfNeeded, PhotoTooLargeError } from './imageCompression';

export { PhotoTooLargeError };

export const uploadPhoto = async (file: File): Promise<string> => {
  const processed = await compressImageIfNeeded(file);
  if (processed.size > 5 * 1024 * 1024) throw new PhotoTooLargeError();
  const ext = processed.name.split('.').pop() || 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('venue-photos').upload(path, processed, { upsert: false });
  if (error) throw toError(error);
  const { data } = supabase.storage.from('venue-photos').getPublicUrl(path);
  return data.publicUrl;
};
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/features/venues/api.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 9: Commit**

```bash
git add src/features/venues/imageCompression.ts src/features/venues/imageCompression.test.ts src/features/venues/api.ts src/features/venues/api.test.ts
git commit -m "feat: compress oversized photos client-side before upload"
```

---

## Task 5: `PhotoGallery` component + `DetailModal` integration

**Files:**
- Create: `src/features/venue-detail/PhotoGallery.tsx`
- Test: `src/features/venue-detail/PhotoGallery.test.tsx`
- Modify: `src/features/venue-detail/DetailModal.tsx`
- Modify: `src/features/venue-detail/DetailModal.test.tsx`
- Modify: `package.json` / `package-lock.json` (new dependency)

**Interfaces:**
- Consumes: `VenuePhoto` from `../venues/types` (Task 2).
- Produces: `PhotoGallery({ photos: VenuePhoto[]; venueName: string })` — a React component.

- [ ] **Step 1: Install the carousel dependency**

Run: `npm install embla-carousel-react`
Expected: `package.json` gains `embla-carousel-react` under `dependencies`.

- [ ] **Step 2: Write the failing `PhotoGallery` tests**

```tsx
// src/features/venue-detail/PhotoGallery.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhotoGallery } from './PhotoGallery';
import type { VenuePhoto } from '../venues/types';

const { scrollNext, scrollPrev, scrollTo } = vi.hoisted(() => ({
  scrollNext: vi.fn(),
  scrollPrev: vi.fn(),
  scrollTo: vi.fn(),
}));

vi.mock('embla-carousel-react', () => ({
  default: () => [
    vi.fn(),
    {
      scrollNext, scrollPrev, scrollTo,
      selectedScrollSnap: () => 0,
      on: vi.fn(),
      off: vi.fn(),
    },
  ],
}));

describe('PhotoGallery', () => {
  it('shows the placeholder when there are no photos', () => {
    render(<PhotoGallery photos={[]} venueName="Bern" />);
    expect(screen.getByText('FOTO · Bern')).toBeInTheDocument();
  });

  it('renders a single photo with no navigation controls', () => {
    const photos: VenuePhoto[] = [{ id: 'p1', url: 'https://example.com/1.jpg', position: 0 }];
    render(<PhotoGallery photos={photos} venueName="Bern" />);
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
  });

  it('renders navigation controls for 2+ photos and wires them to the embla API', () => {
    const photos: VenuePhoto[] = [
      { id: 'p1', url: 'https://example.com/1.jpg', position: 0 },
      { id: 'p2', url: 'https://example.com/2.jpg', position: 1 },
    ];
    render(<PhotoGallery photos={photos} venueName="Bern" />);
    screen.getByRole('button', { name: /next/i }).click();
    expect(scrollNext).toHaveBeenCalledTimes(1);
    screen.getByRole('button', { name: /previous/i }).click();
    expect(scrollPrev).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/features/venue-detail/PhotoGallery.test.tsx`
Expected: FAIL — `Cannot find module './PhotoGallery'`.

- [ ] **Step 4: Write `PhotoGallery.tsx`**

```tsx
// src/features/venue-detail/PhotoGallery.tsx
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { VenuePhoto } from '../venues/types';
import { theme } from '../../theme';

interface PhotoGalleryProps {
  photos: VenuePhoto[];
  venueName: string;
}

const fillStyle: CSSProperties = { position: 'absolute', inset: 0 };

const arrowStyle = (side: 'left' | 'right'): CSSProperties => ({
  position: 'absolute', top: '50%', [side]: '8px', transform: 'translateY(-50%)',
  width: '28px', height: '28px', borderRadius: '50%', border: 'none',
  background: 'rgba(17,17,17,.55)', color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

const dotStyle = (active: boolean): CSSProperties => ({
  width: '7px', height: '7px', borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
  background: active ? theme.color.bg : 'rgba(255,255,255,.5)',
});

export function PhotoGallery({ photos, venueName }: PhotoGalleryProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (emblaApi) setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => emblaApi.off('select', onSelect);
  }, [emblaApi, onSelect]);

  if (photos.length === 0) {
    return (
      <div
        style={{
          ...fillStyle,
          background: 'repeating-linear-gradient(45deg,#e5e5e5 0 12px,#d4d4d4 12px 24px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'monospace', fontSize: '11px', letterSpacing: '.12em', color: theme.color.ink,
            background: theme.color.bg, border: '1px solid ' + theme.color.line, padding: '6px 11px',
          }}
        >
          FOTO · {venueName}
        </span>
      </div>
    );
  }

  return (
    <div style={{ ...fillStyle, overflow: 'hidden' }} ref={emblaRef}>
      <div style={{ display: 'flex', height: '100%' }}>
        {photos.map((photo) => (
          <div key={photo.id} style={{ position: 'relative', flex: '0 0 100%', height: '100%' }}>
            <img
              src={photo.url}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" aria-label="previous" style={arrowStyle('left')} onClick={() => emblaApi?.scrollPrev()}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" aria-label="next" style={arrowStyle('right')} onClick={() => emblaApi?.scrollNext()}>
            <ChevronRight size={16} />
          </button>
          <div style={{ position: 'absolute', bottom: '8px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '5px' }}>
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                aria-label={`photo ${i + 1}`}
                style={dotStyle(i === selected)}
                onClick={() => emblaApi?.scrollTo(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/venue-detail/PhotoGallery.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Wire `PhotoGallery` into `DetailModal`**

In `src/features/venue-detail/DetailModal.tsx`, replace the conditional photo block (the `{venue.photo_url ? (...) : (...)}` JSX, lines 51-74 in the current file — everything between the opening wrapper `<div style={{ position: 'relative', height: '194px', ... }}>` and the Wappen `<img>`) with:

```tsx
import { PhotoGallery } from './PhotoGallery';
// ...
      <div
        style={{
          position: 'relative', height: '194px', background: theme.color.paper,
          overflow: 'hidden',
        }}
      >
        <PhotoGallery photos={venue.photos} venueName={venue.name} />
        {wappen && (
          // ...unchanged
```

- [ ] **Step 7: Update `DetailModal.test.tsx`'s fixture**

Change the `venue` fixture's `photo_url: null` line to `photos: []`.

- [ ] **Step 8: Run the DetailModal tests to verify they still pass**

Run: `npx vitest run src/features/venue-detail/DetailModal.test.tsx`
Expected: PASS (all 4 existing tests, now exercising `PhotoGallery`'s empty-state path).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/features/venue-detail/PhotoGallery.tsx src/features/venue-detail/PhotoGallery.test.tsx src/features/venue-detail/DetailModal.tsx src/features/venue-detail/DetailModal.test.tsx
git commit -m "feat: swipeable photo gallery in the venue detail view"
```

---

## Task 6: i18n keys for the gallery editor

**Files:**
- Modify: `src/i18n/translations.ts`

**Interfaces:**
- Produces: `t.photoResizeHint`, `t.galleryCapReached` (containing a literal `{n}` placeholder, replaced via `.replace('{n}', ...)` at the call site — matching how this codebase has no existing interpolation helper), `t.galleryFull`, `t.photoTooLarge` — added to `STR.de`, `STR.fr`, `STR.it`.

- [ ] **Step 1: Add the keys to all three locales**

In `STR.de`, after `uploadError: 'Foto-Upload fehlgeschlagen',`:

```ts
    photoResizeHint: 'Grosse Fotos werden automatisch verkleinert.',
    galleryCapReached: 'Nur noch {n} weitere(s) Foto(s) möglich.',
    galleryFull: 'Maximal 6 Fotos erreicht.',
    photoTooLarge: 'Foto ist auch nach der Komprimierung zu gross (max. 5 MB).',
```

In `STR.fr`, after `uploadError: 'Échec du téléchargement de la photo',`:

```ts
    photoResizeHint: 'Les photos volumineuses sont automatiquement redimensionnées.',
    galleryCapReached: 'Encore {n} photo(s) possible(s).',
    galleryFull: 'Maximum de 6 photos atteint.',
    photoTooLarge: 'La photo est trop grande même après compression (max. 5 Mo).',
```

In `STR.it`, after `uploadError: 'Caricamento foto fallito',`:

```ts
    photoResizeHint: 'Le foto di grandi dimensioni vengono ridimensionate automaticamente.',
    galleryCapReached: 'Ancora {n} foto possibili.',
    galleryFull: 'Massimo di 6 foto raggiunto.',
    photoTooLarge: 'La foto è troppo grande anche dopo la compressione (max. 5 MB).',
```

- [ ] **Step 2: Verify the keys are structurally identical across locales**

Run: `npx tsc -b --noEmit`
Expected: no new type errors — `STR.de`/`STR.fr`/`STR.it` are plain object literals inferred structurally, so a missing key in one locale would only surface as a runtime gap, not a type error; visually confirm by re-reading the three added blocks that all four keys appear in all three locales.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat: add i18n keys for the photo gallery editor"
```

---

## Task 7: `PhotoGalleryEditor` component

**Files:**
- Create: `src/features/venue-edit/PhotoGalleryEditor.tsx`
- Test: `src/features/venue-edit/PhotoGalleryEditor.test.tsx`
- Modify: `package.json` / `package-lock.json` (new dependencies)

**Interfaces:**
- Consumes: `VenuePhoto` from `../venues/types` (Task 2), `MAX_PHOTOS` from `../venues/photos` (Task 2), `uploadPhoto`, `PhotoTooLargeError` from `../venues/api` (Tasks 3-4), `t.photoResizeHint`/`t.galleryCapReached`/`t.galleryFull`/`t.photoTooLarge`/`t.uploadError`/`t.upload` from i18n (Task 6).
- Produces: `PhotoGalleryEditor({ photos: VenuePhoto[]; onChange: (photos: VenuePhoto[]) => void; onError?: (msg: string) => void })`.

- [ ] **Step 1: Install the drag-and-drop dependencies**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
Expected: all three appear under `dependencies` in `package.json`.

- [ ] **Step 2: Write the failing tests**

```tsx
// src/features/venue-edit/PhotoGalleryEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { PhotoGalleryEditor } from './PhotoGalleryEditor';
import type { VenuePhoto } from '../venues/types';

vi.mock('../venues/api', () => ({
  uploadPhoto: vi.fn(),
  PhotoTooLargeError: class PhotoTooLargeError extends Error {},
}));
vi.mock('../../lib/sentry', () => ({ captureAndFormat: vi.fn((_e: unknown, fallback: string) => fallback) }));

import { uploadPhoto, PhotoTooLargeError } from '../venues/api';

const renderEditor = (photos: VenuePhoto[], onChange = vi.fn(), onError = vi.fn()) => {
  render(
    <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
      <PhotoGalleryEditor photos={photos} onChange={onChange} onError={onError} />
    </I18nContext.Provider>,
  );
  return { onChange, onError };
};

const fileInput = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => { vi.clearAllMocks(); });

describe('PhotoGalleryEditor', () => {
  it('uploads a selected file and appends it to the draft', async () => {
    vi.mocked(uploadPhoto).mockResolvedValue('https://cdn.example.com/new.jpg');
    const onChange = vi.fn();
    const { container } = render(
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <PhotoGalleryEditor photos={[]} onChange={onChange} onError={vi.fn()} />
      </I18nContext.Provider>,
    );
    const input = fileInput(container);
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const result = onChange.mock.calls[0][0] as VenuePhoto[];
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://cdn.example.com/new.jpg');
  });

  it('removes a photo when its delete button is clicked', () => {
    const photos: VenuePhoto[] = [{ id: 'p1', url: 'https://example.com/1.jpg', position: 0 }];
    const { onChange } = renderEditor(photos);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('ignores files beyond the remaining slots and reports the cap', async () => {
    const photos: VenuePhoto[] = Array.from({ length: 5 }, (_, i) => (
      { id: `p${i}`, url: `https://example.com/${i}.jpg`, position: i }
    ));
    vi.mocked(uploadPhoto).mockResolvedValue('https://cdn.example.com/new.jpg');
    const onError = vi.fn();
    const { container } = render(
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <PhotoGalleryEditor photos={photos} onChange={vi.fn()} onError={onError} />
      </I18nContext.Provider>,
    );
    const input = fileInput(container);
    const files = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')];
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    fireEvent.change(input);

    await waitFor(() => expect(uploadPhoto).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith(STR.de.galleryCapReached.replace('{n}', '1'));
  });

  it('shows the resize hint and hides the add tile at 6/6', () => {
    const photos: VenuePhoto[] = Array.from({ length: 6 }, (_, i) => (
      { id: `p${i}`, url: `https://example.com/${i}.jpg`, position: i }
    ));
    const { container } = render(
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <PhotoGalleryEditor photos={photos} onChange={vi.fn()} onError={vi.fn()} />
      </I18nContext.Provider>,
    );
    expect(screen.getByText(STR.de.photoResizeHint)).toBeInTheDocument();
    expect(screen.getByText(STR.de.galleryFull)).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });

  it('reports photoTooLarge without going through the generic upload error', async () => {
    vi.mocked(uploadPhoto).mockRejectedValue(new PhotoTooLargeError());
    const onError = vi.fn();
    const { container } = render(
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <PhotoGalleryEditor photos={[]} onChange={vi.fn()} onError={onError} />
      </I18nContext.Provider>,
    );
    const input = fileInput(container);
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => expect(onError).toHaveBeenCalledWith(STR.de.photoTooLarge));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/features/venue-edit/PhotoGalleryEditor.test.tsx`
Expected: FAIL — `Cannot find module './PhotoGalleryEditor'`.

- [ ] **Step 4: Write `PhotoGalleryEditor.tsx`**

```tsx
// src/features/venue-edit/PhotoGalleryEditor.tsx
import { useState, type CSSProperties } from 'react';
import { X, Plus } from 'lucide-react';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { uploadPhoto, PhotoTooLargeError } from '../venues/api';
import { MAX_PHOTOS } from '../venues/photos';
import type { VenuePhoto } from '../venues/types';
import { useTranslation } from '../../i18n/useTranslation';
import { captureAndFormat } from '../../lib/sentry';
import { theme } from '../../theme';

interface PhotoGalleryEditorProps {
  photos: VenuePhoto[];
  onChange: (photos: VenuePhoto[]) => void;
  onError?: (msg: string) => void;
}

const thumbStyle: CSSProperties = {
  position: 'relative', width: '84px', height: '84px', borderRadius: theme.radius.sm,
  overflow: 'hidden', border: '1px solid ' + theme.color.line, flex: 'none', cursor: 'grab',
};
const deleteBtnStyle: CSSProperties = {
  position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%',
  border: 'none', background: 'rgba(17,17,17,.7)', color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
};
const addTileStyle: CSSProperties = {
  width: '84px', height: '84px', borderRadius: theme.radius.sm, border: '1.5px dashed ' + theme.color.line,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
  cursor: 'pointer', color: theme.color.ink, flex: 'none', background: 'none',
};
const hintStyle: CSSProperties = { fontSize: '11px', color: theme.color.muted, marginTop: '6px' };

function SortableThumb({ photo, onDelete, deleteLabel }: {
  photo: VenuePhoto; onDelete: () => void; deleteLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: photo.id });
  const style: CSSProperties = { ...thumbStyle, transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label={deleteLabel}
        style={deleteBtnStyle}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function PhotoGalleryEditor({ photos, onChange, onError }: PhotoGalleryEditorProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const remaining = MAX_PHOTOS - photos.length;

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (files.length > remaining) {
      onError?.(t.galleryCapReached.replace('{n}', String(remaining)));
    }
    const toUpload = files.slice(0, remaining);
    setUploading(true);
    try {
      let next = photos;
      for (const file of toUpload) {
        try {
          const url = await uploadPhoto(file);
          next = [...next, { id: crypto.randomUUID(), url, position: next.length }];
        } catch (err) {
          if (err instanceof PhotoTooLargeError) onError?.(t.photoTooLarge);
          else onError?.(captureAndFormat(err, t.uploadError));
        }
      }
      if (next !== photos) onChange(next);
    } finally {
      setUploading(false);
    }
  };

  const onDelete = (id: string) => onChange(photos.filter((p) => p.id !== id));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = photos.findIndex((p) => p.id === active.id);
    const newIndex = photos.findIndex((p) => p.id === over.id);
    onChange(arrayMove(photos, oldIndex, newIndex));
  };

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {photos.map((photo) => (
              <SortableThumb key={photo.id} photo={photo} onDelete={() => onDelete(photo.id)} deleteLabel={t.delete} />
            ))}
            {remaining > 0 && (
              <label style={addTileStyle}>
                <Plus size={18} />
                <span style={{ fontSize: '11px', fontWeight: 600 }}>{photos.length}/{MAX_PHOTOS}</span>
                <input
                  type="file" accept="image/*" multiple aria-label={t.upload}
                  onChange={(e) => { void onFiles(e); }} style={{ display: 'none' }} disabled={uploading}
                />
              </label>
            )}
          </div>
        </SortableContext>
      </DndContext>
      {remaining === 0 && <div style={hintStyle}>{t.galleryFull}</div>}
      <div style={hintStyle}>{t.photoResizeHint}</div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/venue-edit/PhotoGalleryEditor.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/features/venue-edit/PhotoGalleryEditor.tsx src/features/venue-edit/PhotoGalleryEditor.test.tsx
git commit -m "feat: add drag-reorderable photo gallery editor for admins"
```

---

## Task 8: Integrate `PhotoGalleryEditor` into `EditForm`

**Files:**
- Modify: `src/features/venue-edit/EditForm.tsx`
- Modify: `src/features/venue-edit/EditForm.test.tsx`

**Interfaces:**
- Consumes: `PhotoGalleryEditor` (Task 7), `syncVenuePhotos` from `../venues/api` (Task 3).

- [ ] **Step 1: Update `EditForm.test.tsx`'s upload test to match the new component**

Add `screen` to the existing `@testing-library/react` import: `import { render, fireEvent, waitFor, screen } from '@testing-library/react';`.

The existing test (`'calls onError with uploadError message when photo upload fails'`) drives a bare `input[type="file"]` inside `EditForm` — after this task that input lives inside `PhotoGalleryEditor`, still with `accept="image/*"`, so the query still finds it; no change needed there.

Change the `single` mock inside the `from: vi.fn().mockReturnValue({ ... })` block from `single: vi.fn().mockResolvedValue({ data: null, error: null })` to:

```ts
single: vi.fn().mockResolvedValue({ data: { id: 'v1', name: 'Testkeller' }, error: null }),
```

Add a mock for `syncVenuePhotos` and a new test:

```tsx
vi.mock('../venues/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../venues/api')>();
  return { ...actual, syncVenuePhotos: vi.fn().mockResolvedValue(undefined) };
});

import { syncVenuePhotos } from '../venues/api';

it('calls syncVenuePhotos with the venue id and the current photo draft after save', async () => {
  renderForm();
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Testkeller' } });
  fireEvent.click(screen.getByText(STR.de.saveClose));

  await waitFor(() => expect(syncVenuePhotos).toHaveBeenCalledWith('v1', [], []));
});
```

`screen.getAllByRole('textbox')[0]` is the name field — the only other input in the form at this point is the `PhotoGalleryEditor`'s `type="file"` control, which isn't a `textbox`, so it's the first text input in DOM order.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/venue-edit/EditForm.test.tsx`
Expected: FAIL — `syncVenuePhotos` is never called yet.

- [ ] **Step 3: Update `EditForm.tsx`**

Replace the `photo_url: null` line in `blankDraft()` with `photos: []`.

Replace the photo upload import and remove the old `onUpload` handler:

```ts
// remove: import { uploadPhoto } from '../venues/api';
import { syncVenuePhotos } from '../venues/api';
import { PhotoGalleryEditor } from './PhotoGalleryEditor';
```

Remove the `onUpload` function (lines 122-134 in the current file) entirely — `PhotoGalleryEditor` owns upload handling now.

Update `buildInput` to drop the photo field (it never belonged in `VenueInput` after Task 2, but the object literal in the current code still has `photo_url: draft.photo_url,` — delete that line).

Replace the photo section JSX (current lines 190-219, from `{/* photo */}` through the closing `</label>` of the upload box) with:

```tsx
{/* photo */}
<label style={{ ...labelStyle, marginBottom: '7px' }}>{t.photo}</label>
<div style={{ marginBottom: '16px' }}>
  <PhotoGalleryEditor
    photos={draft.photos}
    onChange={(photos) => setDraft((d) => ({ ...d, photos }))}
    onError={onError}
  />
</div>
```

Update `save()` to sync photos after the venue row is saved:

```ts
const save = async (andNew: boolean) => {
  if (!draft.name.trim()) return;
  try {
    const input = buildInput();
    const saved = initial
      ? await update.mutateAsync({ id: initial.id, input })
      : await create.mutateAsync(input);
    await syncVenuePhotos(saved.id, initial?.photos ?? [], draft.photos);
    onSaved(saved, andNew);
  } catch (err) {
    onError?.(captureAndFormat(err, t.saveError));
  }
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/venue-edit/EditForm.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venue-edit/EditForm.tsx src/features/venue-edit/EditForm.test.tsx
git commit -m "feat: wire the photo gallery editor into the venue edit form"
```

---

## Task 9: Update `MarkerPopup` to use the cover photo

**Files:**
- Modify: `src/features/map/MarkerPopup.tsx`
- Modify: `src/features/map/MarkerPopup.test.tsx`
- Modify: `src/features/map/markers.test.ts`

**Interfaces:**
- Consumes: `coverPhotoUrl` from `../venues/photos` (Task 2).

- [ ] **Step 1: Update the fixtures in both test files**

In `MarkerPopup.test.tsx` and `markers.test.ts`, replace any `photo_url: ...` fixture field with `photos: []` (or, where a photo is expected to show, `photos: [{ id: 'p1', url: '...', position: 0 }]`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/map/MarkerPopup.test.tsx src/features/map/markers.test.ts`
Expected: FAIL — `venue.photo_url` is `undefined` on the new fixture shape (TypeScript would also flag this at build time; jsdom/vitest still runs but the assertions relying on the photo background diverge).

- [ ] **Step 3: Update `MarkerPopup.tsx`**

```tsx
import { coverPhotoUrl } from '../venues/photos';
// ...
export function MarkerPopup({ venue, t }: MarkerPopupProps) {
  const c = cantonByCode(venue.canton);
  const photo = coverPhotoUrl(venue);
  return (
    <div style={wrapStyle}>
      {photo ? (
        <div style={photoStyle(photo)} />
      ) : (
        <div style={photoPlaceholderStyle}>
          <span style={fotoLabelStyle}>FOTO</span>
        </div>
      )}
      {/* ...rest unchanged */}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/map/MarkerPopup.test.tsx src/features/map/markers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/MarkerPopup.tsx src/features/map/MarkerPopup.test.tsx src/features/map/markers.test.ts
git commit -m "feat: show the cover photo in map marker popups"
```

---

## Task 10: Bulk JSON import/export carries full galleries

**Files:**
- Modify: `src/features/venues/importExport.ts`
- Modify: `src/features/venues/importExport.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Venue`, `VenuePhoto` from `./types` (Task 2).
- Produces: `normalizeVenue` returns `Venue` with a populated `photos` array; `toJSON` serializes `photos` as a plain `string[]` of URLs; `toInput` (in `App.tsx`) produces `VenueInput & { photo_urls: string[] }` for `replaceAllVenues`.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/venues/importExport.test.ts`:

```ts
describe('normalizeVenue photos', () => {
  it('parses a photos: string[] field into VenuePhoto[]', () => {
    const n = normalizeVenue({ name: 'X', photos: ['https://a', 'https://b'] }, 0);
    expect(n.photos).toEqual([
      { id: 'import_0_0', url: 'https://a', position: 0 },
      { id: 'import_0_1', url: 'https://b', position: 1 },
    ]);
  });

  it('falls back to a legacy single photo_url field', () => {
    const n = normalizeVenue({ name: 'X', photo_url: 'https://legacy' }, 2);
    expect(n.photos).toEqual([{ id: 'import_2_0', url: 'https://legacy', position: 0 }]);
  });

  it('defaults to an empty gallery when no photo field is present', () => {
    const n = normalizeVenue({ name: 'X' }, 0);
    expect(n.photos).toEqual([]);
  });
});

describe('toJSON', () => {
  it('serializes photos as a plain array of URLs', () => {
    const venue = normalizeVenue({ name: 'X', photos: ['https://a'] }, 0);
    const json = JSON.parse(toJSON([venue]));
    expect(json[0].photos).toEqual(['https://a']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/venues/importExport.test.ts`
Expected: FAIL — `normalizeVenue` still sets `photo_url` instead of `photos`.

- [ ] **Step 3: Update `importExport.ts`**

```ts
import type { Venue, VenuePhoto } from './types';

const truthy = (v: unknown) =>
  v === true || /^(true|1|ja|yes|x)$/i.test(String(v ?? ''));

const parsePhotoUrls = (v: Record<string, unknown>): string[] => {
  if (Array.isArray(v.photos)) return v.photos.filter((u): u is string => typeof u === 'string');
  const legacy = (v.photo_url as string) || (v.photo as string) || '';
  return legacy ? [legacy] : [];
};

export const normalizeVenue = (v: Record<string, unknown>, i: number): Venue => {
  const photos: VenuePhoto[] = parsePhotoUrls(v).map((url, idx) => (
    { id: `import_${i}_${idx}`, url, position: idx }
  ));
  return {
    id: (v.id != null && v.id !== '' ? String(v.id) : '') || `import_${i}`,
    name: String(v.name ?? ''),
    canton: String(v.canton ?? 'BE').toUpperCase(),
    address: String(v.address ?? ''),
    lat: parseFloat(String(v.lat)) || 46.8,
    lng: parseFloat(String(v.lng)) || 8.2,
    indoor: truthy(v.indoor),
    outdoor: truthy(v.outdoor),
    person: String(v.person ?? ''),
    phone: String(v.phone ?? ''),
    website: String(v.website ?? ''),
    photos,
  };
};

const CSV_COLS: (keyof Omit<Venue, 'photos'>)[] = [
  'id', 'name', 'canton', 'address', 'lat', 'lng',
  'indoor', 'outdoor', 'person', 'phone', 'website',
];

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCSV = (venues: Venue[]): string => {
  const rows = [CSV_COLS.join(',')].concat(
    venues.map((v) => CSV_COLS.map((c) => esc(v[c])).join(',')),
  );
  return '﻿' + rows.join('\n');
};

export const toJSON = (venues: Venue[]): string =>
  JSON.stringify(
    venues.map((v) => ({ ...v, photos: v.photos.map((p) => p.url) })),
    null,
    2,
  );

// ...splitLine/parseCSV unchanged
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/venues/importExport.test.ts`
Expected: PASS (all tests, including the pre-existing CSV ones, since `CSV_COLS` still excludes photos).

- [ ] **Step 5: Update `App.tsx`'s `toInput` for the bulk-import RPC shape**

```ts
const toInput = (v: Venue): VenueInput & { photo_urls: string[] } => {
  const { id: _id, photos, ...rest } = v;
  void _id;
  return { ...rest, photo_urls: photos.map((p) => p.url) };
};
```

Update the `pendingImport` state type from `VenueInput[]` to `(VenueInput & { photo_urls: string[] })[]`:

```ts
const [pendingImport, setPendingImport] = useState<
  { count: number; inputs: (VenueInput & { photo_urls: string[] })[] } | null
>(null);
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors related to `toInput` or `pendingImport` — `replaceAllVenues` still types its parameter as plain `VenueInput[]` until Task 11, but passing the wider `VenueInput & { photo_urls: string[] }` array to it type-checks fine (a value with extra properties is assignable wherever the narrower type is expected); `photo_urls` already travels through at runtime since `useVenueMutations`/`replaceAllVenues` just forward whatever object they're given to the RPC call untouched.

- [ ] **Step 7: Commit**

```bash
git add src/features/venues/importExport.ts src/features/venues/importExport.test.ts src/App.tsx
git commit -m "feat: round-trip full photo galleries through JSON import/export"
```

---

## Task 11: `replace_venues` RPC round-trips galleries

**Files:**
- Create: `supabase/migrations/0005_replace_venues_photos.sql`
- Modify: `src/features/venues/api.test.ts`

**Interfaces:**
- Produces: an updated `public.replace_venues(rows jsonb)` that also inserts `venue_photos` rows for each input row's `photo_urls` array, position = array index.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0005_replace_venues_photos.sql
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
```

- [ ] **Step 2: Update `replaceAllVenues`'s signature in `api.ts`**

```ts
export const replaceAllVenues = async (venues: (VenueInput & { photo_urls: string[] })[]): Promise<void> => {
  const { error } = await supabase.rpc('replace_venues', { rows: venues });
  if (error) throw toError(error);
};
```

- [ ] **Step 3: Update `api.test.ts`'s `replaceAllVenues` tests to include `photo_urls`**

```ts
const SAMPLE_VENUE: VenueInput & { photo_urls: string[] } = {
  name: 'Testkeller', canton: 'BE', address: 'Musterweg 1', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photo_urls: ['https://example.com/1.jpg'],
};
```

(The rest of the `replaceAllVenues` describe block is unchanged — it already asserts the RPC is called with whatever rows it's given.)

- [ ] **Step 4: Run the test to verify it still passes**

Run: `npx vitest run src/features/venues/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the RPC against the local docker-compose stack**

```bash
docker compose up -d storage --wait
for f in supabase/migrations/*.sql; do docker exec -i schwingkeller-db psql -U postgres -d postgres < "$f"; done
docker exec -i schwingkeller-db psql -U postgres -d postgres -c "
select replace_venues('[{\"name\":\"A\",\"canton\":\"BE\",\"photo_urls\":[\"https://x/1\",\"https://x/2\"]},{\"name\":\"B\",\"canton\":\"ZH\",\"photo_urls\":[]}]'::jsonb);
"
docker exec -i schwingkeller-db psql -U postgres -d postgres -c "
select v.name, vp.url, vp.position from venues v join venue_photos vp on vp.venue_id = v.id order by v.name, vp.position;
"
docker compose down
```

Expected: the second query returns two rows for venue `A` (`https://x/1` at position 0, `https://x/2` at position 1) and none for venue `B`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0005_replace_venues_photos.sql src/features/venues/api.ts src/features/venues/api.test.ts
git commit -m "feat: round-trip photo galleries through the replace_venues RPC"
```

---

## Task 12: Full verification and cleanup

**Files:** none (verification only).

- [ ] **Step 1: Full lint, typecheck, test, and coverage**

```bash
npm run lint
npm run typecheck
npm run test
```

Expected: all three exit 0. If lint or typecheck surfaces a leftover `photo_url` reference anywhere (e.g. a stray fixture in a test file not covered by earlier tasks), fix it in place.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: exits 0 — confirms the new dependencies (`embla-carousel-react`, `@dnd-kit/*`) bundle cleanly.

- [ ] **Step 3: Manual smoke test**

```bash
docker compose up
```

Open `http://localhost:5173`, log in as admin, open an existing venue's edit form, add 2-3 photos, reorder them by dragging, save, and confirm the detail view shows them as a swipeable gallery in the saved order. Delete one photo and confirm it disappears from both the editor and the detail view after saving. Try uploading a 7th photo and confirm the UI blocks it with the cap message.

- [ ] **Step 4: Final commit (if Step 1 required fixes)**

```bash
git add -A
git commit -m "chore: fix remaining photo_url references after gallery migration"
```

*(Skip this commit if Step 1 passed clean on the first try — nothing to commit.)*
