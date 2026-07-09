# End-user enhancement backlog

## Context

This is not a single-feature spec. It's a curated backlog of independent, end-user-value
enhancements identified by exploring the current app (map browsing, canton grouping/search,
venue detail, admin CRUD, DE/FR/IT i18n) against what it doesn't yet do. Each item below is
scoped to become its own standalone GitHub issue, filed in the "problem + proposed solution"
style already used by issue #8 (Improve UI/UX). None of these are implemented as code in this
session — this document is the record of what gets filed and why.

Existing open issue #8 covers visual polish (favicon, zoom-button border, mobile drag handle,
tablet sidebar layout, admin-pill visibility). The items below were chosen to be complementary,
not overlapping, with #8.

## Issues to file

### 1. Shareable venue permalinks

**Problem:** There's no way to link directly to a specific venue. Every shared link lands on the
default map view; the recipient has to re-search.

**Proposed solution:** Support a `?venue=<id>` URL query param. On load, if present and the id
matches a venue, open that venue's `DetailModal` and select it on the map, same as clicking it
from the sidebar. Update the URL (without a full navigation) when a venue is opened/closed so the
address bar stays shareable.

**Alternatives considered:** Hash-based routing (`#/venue/<id>`) — rejected, no other routes exist
yet and a query param is simpler for a single deep-linkable id.

### 2. Canton-centered permalinks

**Problem:** Similarly, there's no way to link to "the map centered on Fribourg" — useful for
sharing a canton-specific view (e.g. a club sharing "all our canton's cellars").

**Proposed solution:** Support a `?ctn=<code>` URL query param (e.g. `?ctn=FR`). On load, if
present and valid, center/fit the map on that canton's venues and expand that canton's group in
the sidebar. Mutually exclusive with `?venue=` (venue permalink takes precedence if both are
present, since it's more specific).

**Alternatives considered:** Reusing `?venue=` and inferring the canton from a venue id — rejected,
doesn't cover the case of wanting the canton overview with no single venue selected.

### 3. "Nearest to me" geolocation sort

**Problem:** Users physically near several venues (e.g. traveling for a wrestling event) have no
way to find the closest one; they must recognize town names in a canton-grouped list.

**Proposed solution:** Add an opt-in "Use my location" control in the sidebar. On permission grant,
compute distance from the browser geolocation position to each venue (haversine) and show a
distance badge per row; combine with the sort control from item #10 to offer "sort by distance."
Fails gracefully (control hidden/disabled) if geolocation is denied or unsupported.

**Alternatives considered:** IP-based geolocation — rejected, far less accurate and adds a
third-party dependency for something the browser API already provides for free.

### 4. PWA installability + basic offline shell

**Problem:** Schwingkeller cellars are often basements with poor cell reception. The app has no
offline behavior — a dead connection means a blank map.

**Proposed solution:** Add a web app manifest (name, icons, theme color) and a minimal service
worker that precaches the app shell and the last successfully fetched venue list, so the app opens
and shows previously-loaded data offline, with a clear "offline — showing cached data" indicator.
Supports "Add to Home Screen" on mobile.

**Alternatives considered:** Full offline map tile caching — rejected as a first step; tile storage
is large and Leaflet offline tile strategies are a bigger effort. Venue data + shell caching is the
high-value, low-effort slice.

### 5. Indoor/Outdoor quick-filter

**Problem:** The `indoor`/`outdoor` boolean fields already exist on every venue and are shown as
tags in the detail view, but there's no way to filter the list by them — a user looking
specifically for an outdoor Schwinget can't narrow the list.

**Proposed solution:** Add two toggle chips (⌂ Indoor / ⛰ Outdoor) near the search box in the
sidebar. Selecting one or both narrows `filterVenues` results client-side; combine with existing
text search (AND logic).

**Alternatives considered:** A generic multi-facet filter framework — rejected as overkill for two
boolean fields; a simple chip toggle matches the existing UI vocabulary (see canton badges).

### 6. Multiple photos per venue (gallery)

**Problem:** `photo_url` is a single field — admins can only show one photo per cellar, which is
thin for a venue-discovery app where a photo is often the deciding factor.

**Proposed solution:** Extend venue photo storage to support multiple images (new
`venue_photos` table or a `photo_urls: string[]` column backed by the existing Storage bucket).
Detail view becomes a swipeable/paginated gallery instead of a single `<img>`. Admin edit form
gains multi-file upload with reordering and delete-per-photo.

**Alternatives considered:** Keep single photo, just allow re-upload — rejected, doesn't add value;
the point is letting a visitor see the cellar from more than one angle before visiting.

### 7. "Suggest an edit" for anonymous visitors

**Problem:** Only authenticated admins can fix outdated info. A visitor who notices a wrong phone
number or moved address has no way to report it short of contacting an admin out-of-band.

**Proposed solution:** Add a "Suggest an edit" action in the detail view, open to anonymous users.
Opens a lightweight form (subset of the existing edit form fields) that writes to a new
`venue_suggestions` table (RLS: public insert, admin-only read/update) instead of the `venues`
table directly. Admins see a pending-suggestions badge/queue to accept or dismiss.

**Alternatives considered:** A `mailto:` link to the maintainer — rejected, no structured tracking
and doesn't scale past one maintainer.

### 8. Browser-language auto-detect on first visit

**Problem:** `loadLang()` (`src/i18n/useTranslation.ts`) always defaults to `'de'` when no stored
preference exists, even for a French- or Italian-speaking visitor's first visit.

**Proposed solution:** On first visit (no `schwing_lang` in localStorage), initialize from
`navigator.language`/`navigator.languages`, mapping to `'fr'`/`'it'`/`'de'` (falling back to `'de'`
for anything else, matching current behavior). Once the user picks a language via the switcher (or
this auto-detect runs once), it's persisted and never re-detected.

**Alternatives considered:** Server-side `Accept-Language` detection — not applicable, this is a
static SPA with no server to inspect the request.

### 9. Keyboard & screen-reader accessibility pass

**Problem:** Modals (`Modal.tsx`, `DetailModal`, `EditForm`, `LoginModal`) have no focus trapping
or focus-return, there's no skip-to-content link, and the map/canton-group/search controls lack
ARIA labeling — the app is difficult or impossible to use with a keyboard or screen reader. This is
distinct from issue #8, which is visual/layout polish, not semantics.

**Proposed solution:** Add focus trap + return-focus-on-close to the shared `Modal` component
(covers all modals that use it), add a skip-to-map/skip-to-sidebar link, add `aria-label`/`role`
attributes to the search input, canton group headers (expand/collapse state via `aria-expanded`),
and map marker interactions.

**Alternatives considered:** A full WCAG audit with a third-party tool — deferred; this issue
covers the highest-impact, concretely actionable gaps found by inspection, not an exhaustive audit.

### 10. Sidebar sort options

**Problem:** The venue list is only ever grouped by canton in a fixed order; there's no way to sort
alphabetically by name or (once #3 lands) by distance.

**Proposed solution:** Add a sort control (name / distance, distance only enabled when geolocation
from #3 is active) above the canton list. Sorting applies within each canton group and does not
change the grouping itself.

**Alternatives considered:** Flatten the list entirely when sorting (drop canton grouping) —
rejected, canton grouping is a core piece of the app's identity and should stay even when sorted.

## Non-goals

- No code is implemented in this session; the deliverable is the filed GitHub issues themselves.
- No overlap with existing issue #8's visual-polish items.
- No new npm dependencies are proposed without separate discussion, per project CLAUDE.md.
