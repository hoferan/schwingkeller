# Venue Photo Gallery — Design

GitHub issue: [#14 — Multiple photos per venue (gallery)](https://github.com/hoferan/schwingkeller/issues/14)

## Problem

`venues.photo_url` is a single field, so admins can only attach one photo per
Schwingkeller. For a venue-discovery app, a photo is often the deciding
factor before a visitor commits to going — one angle isn't enough.

## Goals

- Support up to **6 photos per venue**, in admin-chosen order.
- Detail view shows a swipeable/paginated gallery instead of a single image.
- Admin edit form supports multi-file upload, drag-reorder, and per-photo
  delete.
- Existing single-photo data is migrated automatically, no manual admin work.
- Bulk import/export (`replace_venues` RPC, JSON import/export) round-trips
  full galleries, not just a cover image.

## Non-goals

- Per-photo captions/alt text (no requirement for this today).
- CSV import/export of photos (CSV already excludes `photo_url` today and
  stays that way).
- Server-side (Storage-function) image processing — compression happens
  client-side before upload.

## Data model

New table, replacing the `photo_url` column on `venues`:

```sql
create table public.venue_photos (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.venue_photos enable row level security;
-- RLS mirrors venues: public read, authenticated write/update/delete,
-- same `using (true)` pattern already in place for venues.
```

A trigger enforces the 6-photo-per-venue cap on insert into `venue_photos`,
so the limit holds even against direct API calls, not just the UI.

**Migration (single migration file):**
1. Create `venue_photos` + RLS policies + cap trigger.
2. Backfill: for every venue with a non-null `photo_url`, insert one
   `venue_photos` row (`position = 0`).
3. Drop the `photo_url` column from `venues`.

## Storage

Same `venue-photos` bucket and existing RLS policies (public read,
authenticated write/update/delete) — no bucket restructuring, just more
objects per venue.

- The bucket's `file_size_limit` is set to 5MB as a server-side backstop.
- Client-side, before upload: if a file is already small (reasonable
  dimensions, well under 5MB), it uploads as-is. Otherwise it's drawn to an
  offscreen `<canvas>` (native browser API, no new dependency), downscaled so
  the longest edge is ~1920px, and re-encoded as JPEG at ~0.82 quality. This
  covers the common case (an unedited phone photo, often 4000px+/8-12MB)
  shrinking comfortably under 5MB.
- In the rare case a file is still over 5MB after compression, the upload is
  rejected with the existing translated error.
- `PhotoGalleryEditor` (see below) shows a hint near the add-photo control
  explaining that large photos are automatically resized, so admins aren't
  surprised by a slightly different result after upload.

## Types & client API

```ts
export interface VenuePhoto { id: string; url: string; position: number; }

export interface Venue {
  id: string; name: string; canton: string; address: string;
  lat: number; lng: number; indoor: boolean; outdoor: boolean;
  person: string; phone: string; website: string;
  photos: VenuePhoto[]; // replaces photo_url
}

export type VenueInput = Omit<Venue, 'id' | 'photos'>;
```

`photo_url` is removed everywhere. Call sites needing a thumbnail (map
markers, sidebar list) use the first photo (`photos[0]?.url ?? null`) via a
small `coverPhotoUrl(venue)` helper.

- **`listVenues()`**: one query using a PostgREST embedded resource —
  `supabase.from('venues').select('*, venue_photos(id,url,position)').order('name')`
  — mapping each row's `venue_photos`, sorted by `position`, into `photos`.
  Still a single round trip; no lazy-loading complexity.
- **`createVenue`/`updateVenue`**: unchanged in shape, just no longer carry
  any photo field — venue row saves and gallery changes are independent
  operations.
- **`syncVenuePhotos(venueId, original: VenuePhoto[], draft: VenuePhoto[])`**
  (new, in `api.ts`): diffs the original and draft photo lists and issues the
  minimal inserts (new photos), deletes (removed photos), and position
  updates (reordered photos) needed to bring the DB in line with the draft.
- **`uploadPhoto(file)`**: existing Storage-upload-then-public-URL primitive,
  unchanged in signature; internally gains the compression/size-check step
  described above. Called once per added file instead of once per venue.

## Detail view: `PhotoGallery`

New component, `src/features/venue-detail/PhotoGallery.tsx`, replacing
`DetailModal`'s static 194px image header. Props: `photos: VenuePhoto[]`,
`venueName: string` (for the placeholder label).

- **0 photos:** same striped placeholder + "FOTO · {name}" label as today —
  unchanged behavior, no carousel mounted.
- **1+ photos:** an [Embla](https://www.embla-carousel.com/) carousel
  (`embla-carousel-react`) renders the photo(s) — one code path regardless of
  count, since Embla handles a single slide natively (no special-casing
  needed for it not to error). Dot indicators and left/right arrow buttons
  are rendered only when `photos.length > 1` — with exactly one photo, no
  navigation chrome shows, matching today's appearance.
- The Wappen badge and close button remain absolutely-positioned overlays on
  top, unaffected by the carousel underneath.

`DetailModal` itself just renders
`<PhotoGallery photos={venue.photos} venueName={venue.name} />` in place of
the old image block; everything below (name, address, tags, contact,
actions) is untouched.

## Admin edit form: `PhotoGalleryEditor`

New component, `src/features/venue-edit/PhotoGalleryEditor.tsx`, replacing
the single upload box in `EditForm`. Holds the draft's `photos: VenuePhoto[]`
(`id: null` for not-yet-persisted photos) and reports changes via an
`onChange` callback, plugged into `draft.photos` like any other form field.

- **Thumbnail grid**: one tile per current photo, each with a small delete
  (×) overlay button.
- **Reordering**: drag-and-drop via `@dnd-kit/sortable`, enabled only when
  2+ photos are present.
- **Add tile**: an "add photo" control accepting multiple files at once.
  Each selected file goes through `uploadPhoto()` immediately (same
  immediate-upload-on-select UX as today) and is appended to the draft list.
  If more files are selected than remaining slots (cap 6 total), the excess
  are ignored with a translated inline message ("only N more photos
  allowed").
- At 6/6, the add tile is replaced by a disabled "6/6" counter state.
- A hint line near the add control explains automatic resizing of large
  photos (see Storage section).
- Per-photo delete just removes the photo from the local draft array;
  `position` is recomputed from array order at save time.

**Persistence on Save**: `EditForm.save()` creates/updates the venue row
first (now with no photo field), then calls `syncVenuePhotos(venueId,
originalPhotos, draft.photos)` to apply the diff. **Cancel** discards the
draft entirely, including any newly uploaded-but-unsaved photos (their
Storage objects may be orphaned — the same accepted tradeoff that exists
today for a cancelled single-photo upload).

**New i18n keys** (DE/FR/IT, per project convention): add-photo label,
"N/6 photos" counter, cap-reached message, oversized-file/compression hint
text. Existing `t.photo`/`t.upload`/`t.uploadError` keys are reused where
still applicable.

## Bulk import/export

- **CSV**: unchanged. `CSV_COLS` never included `photo_url` and continues to
  exclude photos entirely.
- **JSON import/export** (`importExport.ts`): `toJSON`/`normalizeVenue`
  carry a `photos` array (ordered list of URLs) per venue instead of the
  single `photo_url`/`photo` fallback. On import, `normalizeVenue` maps
  whatever `photos`/`photo_urls` key is present into an ordered URL list (no
  `id`s — these are re-created on insert).
- **`replace_venues` RPC**: today it does a flat `delete` + `insert ...
  select` from the incoming JSONB array. Since `venue_photos` cascades on
  `venues` delete, wiping all venues already wipes their photos — the RPC
  needs to also re-insert `venue_photos` rows for the freshly-inserted
  venues, correlated back to each input row's `photos` array in order. The
  implementation inserts venues via a CTE using `returning id` correlated to
  input order (`with ordinality`), then inserts `venue_photos` by joining
  each returned venue `id` back to its row's `photos` array (also `with
  ordinality` for position) via `jsonb_array_elements_text`. Stays a single
  atomic function call, same `security invoker` RLS-backed safety as today.
  Full galleries must round-trip on bulk replace, not just a cover image.

## Testing

- **`PhotoGallery`**: 0 photos (placeholder unchanged), 1 photo (no
  dots/arrows), 2+ photos (dots/arrows render, clicking a dot or arrow
  advances the active slide).
- **`PhotoGalleryEditor`**: add photo, delete photo, reorder via drag, cap
  enforcement (6/6 blocks further adds; excess selections show the message),
  oversized-file compression path (mocked), and the rare still-too-large-
  after-compression reject path.
- **`api.test.ts`**: `syncVenuePhotos` diffing (insert-only, delete-only,
  reorder-only, and mixed cases); `listVenues` mapping `venue_photos` into
  sorted `photos`.
- **`importExport.ts`**: JSON round-trip carries `photos` arrays correctly.
- **Migration/RPC verification**: not unit-testable via Vitest. Before
  shipping, manually verify via `supabase db reset` locally — exercise
  `replace_venues` with a multi-photo payload, confirm galleries round-trip,
  and confirm RLS still restricts `venue_photos` writes to authenticated
  users.

## New dependencies

- `embla-carousel-react` — swipeable detail-view gallery.
- `@dnd-kit/core` + `@dnd-kit/sortable` — accessible drag-reorder in the
  admin editor.

Both are small, actively maintained, and each scoped to one job (carousel vs.
sortable list) rather than one all-in-one library covering both loosely.

## Summary of changes

- New `venue_photos` table (RLS-mirrored, cascade delete, 6-photo cap
  trigger) replacing `photo_url`, with an auto-migrating backfill.
- `venue-photos` Storage bucket unchanged, plus a 5MB bucket-level limit and
  client-side image compression before upload.
- `Venue.photos: VenuePhoto[]` replaces `photo_url`; `listVenues` fetches
  everything in one query; a new `syncVenuePhotos` diff function persists
  gallery changes on save.
- New `PhotoGallery` (Embla carousel) for the detail view and new
  `PhotoGalleryEditor` (dnd-kit drag-reorder) for the admin form.
- `replace_venues` RPC and JSON import/export extended to round-trip full
  galleries; CSV stays untouched.
