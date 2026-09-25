---
status: accepted
date: 2026-07-15
decision-makers: André Hofer
---

# Store photo galleries in their own table and compress on the client

## Context and problem statement

A venue had a single `photo_url` column, so it could show one photo. Galleries needed ordering, a
limit, and uploads that don't send full-size phone pictures to storage.

## Considered options

* A child table ordered by position
* Process images on the server with a storage function
* Compress in the browser before upload

## Decision outcome

Chosen option: a `venue_photos` child table, with compression in the browser.

* Rows are ordered by `position` and removed with their venue (`on delete cascade`).
* A trigger enforces at most 6 photos per venue, so the limit holds against direct API calls as well
  as the UI.
* The storage bucket rejects files over 5 MB.
* The browser scales images down to 1920 px and re-encodes them as JPEG at quality 0.82 before
  uploading. Server-side processing in a storage function was ruled out.
* Venues and their photos load in one embedded PostgREST query.
* CSV import and export never carry photos.
* The carousel uses Embla and the sorting uses dnd-kit. An all-in-one gallery library was rejected.

### Consequences

* Good, because the limit and the ordering are enforced by the database, not by the form.
* Bad, because a photo uploaded and then abandoned before saving leaves an orphaned object in
  storage. This was accepted over adding cleanup machinery.

## More information

`supabase/migrations/0004_venue_photos.sql`, `src/features/venues/imageCompression.ts`, `src/features/venues/api.ts`
