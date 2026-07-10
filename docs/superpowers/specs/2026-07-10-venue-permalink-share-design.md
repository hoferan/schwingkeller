# Shareable venue permalinks (?venue=<id>) + share button — design

## Problem

There's no way to link directly to a specific venue. Every shared link
lands on the default map view; the recipient has to re-search for the
venue themselves. See issue #9.

## Scope

- Support a `?venue=<id>` URL query param.
- On load, if the id matches a venue (once the venues query resolves),
  open that venue's `DetailModal`, select it on the map (fly to it, same
  visual result as clicking it in the sidebar), and expand its canton
  group in the sidebar.
- Whenever a venue's `DetailModal` opens or closes (permalink load,
  sidebar click, or map marker click), update the URL via
  `history.replaceState` — no new browser-history entries, no full
  navigation, so the address bar always reflects the current venue and
  stays shareable.
- Add a Share button to `DetailModal` so a user can copy/share the
  current permalink without hand-editing the URL.
- `?venue=` takes precedence over `?ctn=` (see
  `docs/superpowers/specs/2026-07-10-canton-permalinks-design.md`, which
  named this app's `parseCantonParam` as the seam for this check): if a
  `venue` param is present at all, the canton-permalink's load-time
  sidebar-expand/map-fly behavior is suppressed outright for that load,
  regardless of whether the venue id turns out valid.

### Out of scope

- Falling back to `?ctn=` behavior if the `?venue=` id turns out invalid
  once the query resolves. Keeps load-time behavior simple (one outcome:
  either the venue permalink applies, or the default view does) and
  avoids a jarring double fly-to animation (canton bounds, then venue
  point) if both were honored in sequence.
- Two-way sync for anything other than `detailId` (e.g. still no `?ctn=`
  sync while panning/selecting cantons) — unchanged from the canton
  permalink's read-only scope.
- Native share-target metadata (Open Graph tags, per-venue previews) —
  the Share button shares a plain URL; richer link previews are a
  separate concern.

## Approach

### Why this differs from the `?ctn=` permalink

Canton codes are validated against a static, synchronously-available
list (`src/data/cantons.ts`), so `parseCantonParam` can resolve to a
final answer immediately at startup. A venue id can only be validated
against the live Supabase-backed venue list, which loads asynchronously
via `useVenues()` (TanStack Query). This means matching a `?venue=` id
to a real venue is inherently a one-shot *effect* (runs once the query
settles), not a synchronous computation like `parseCantonParam` — and
the sidebar-expand / map-fly-to that follows a successful match has to
happen from that same effect, not from `useState` initializers.

### New code (`src/lib/permalink.ts`)

- `parseVenueParam(search: string): string | null` — reads `venue` from
  a `URLSearchParams`-parseable string, returns it verbatim if
  non-empty, else `null`. Deliberately does no existence validation
  (that requires the async venue list); mirrors `parseCantonParam`'s
  signature but not its validation step.
- `withVenueParam(url: string, id: string | null): string` — pure
  function. Parses `url` (expected to be `pathname + search`, e.g.
  `window.location.pathname + window.location.search`) into a
  `URLSearchParams`-backed structure, always deletes `ctn` (venue
  supersedes canton once the app is being interacted with), sets
  `venue=<id>` when `id` is non-null or deletes `venue` when `id` is
  null, and returns the resulting `pathname?search` string ready to pass
  to `history.replaceState`.

### App wiring (`AppShell` in `src/App.tsx`)

- `const [venueParam] = useState(() => parseVenueParam(window.location.search));`
  — parsed once at startup, same lazy-`useState` pattern as `ctnParam`.
- `ctnParam`'s parse becomes gated on `venueParam`:
  `useState(() => (venueParam ? null : parseCantonParam(window.location.search)))`.
  This is the precedence rule from Scope: a present `venue` param blocks
  `ctnParam` from ever being set, so none of the existing `ctnParam`
  seeding of `expanded`/`initialFocusBounds` runs.
- `useVenues()` is destructured with `isSuccess` in addition to `data`,
  so the matching effect (below) can tell "query hasn't settled yet"
  apart from "settled, and this id isn't in the result" — checking
  `venues.length === 0` alone would hang forever against a genuinely
  empty table.
- A one-shot, ref-guarded effect:
  ```ts
  const appliedVenueParamRef = useRef(false);
  useEffect(() => {
    if (!venueParam || appliedVenueParamRef.current || !isSuccess) return;
    appliedVenueParamRef.current = true;
    const match = venues.find((v) => v.id === venueParam);
    if (match) {
      openDetail(match.id);
      setExpanded((e) => ({ ...e, [match.canton]: true }));
    }
  }, [venueParam, venues, isSuccess]);
  ```
  Marks itself applied whether or not a match is found, so it can never
  re-fire on a later background refetch (e.g. after an edit elsewhere
  changes the `venues` array reference).
- A separate effect syncs `detailId → URL`:
  ```ts
  const mountedUrlSyncRef = useRef(false);
  useEffect(() => {
    if (!mountedUrlSyncRef.current) { mountedUrlSyncRef.current = true; return; }
    const next = withVenueParam(window.location.pathname + window.location.search, detailId);
    window.history.replaceState(null, '', next);
  }, [detailId]);
  ```
  Skipping the first run means this effect never strips a permalink's
  `?venue=` before the matching effect above has had a chance to apply
  it (both effects run post-mount; the matching effect's `setDetailId`
  triggers a second pass of this one, which then writes the same
  `venue=<id>` back — idempotent, no visible flicker).

### Share button (`DetailModal`)

- `DetailModal`'s current full-width `onNavigate` button becomes a
  two-button row: `Navigate` (primary, wider — unchanged style) and
  `Share` (secondary, reusing the existing Edit/Delete button style),
  both visible to every user regardless of `isAdmin`.
- New `onShare` prop, handled in `AppShell` alongside `onNavigate`:
  ```ts
  const onShare = async (venue: Venue) => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: venue.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showFlash('ok', t.linkCopied);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showFlash('err', captureAndFormat(err, t.shareFailed));
    }
  };
  ```
  Reads `window.location.href` directly rather than rebuilding it — by
  the time the modal is showing, the URL-sync effect above has already
  written `?venue=<id>` into the address bar, so there's no separate
  URL-construction step to keep in sync.
  - `navigator.share` (mobile / supporting desktop browsers): hands off
    to the OS share sheet; a user-cancelled sheet throws `AbortError`,
    which is swallowed silently (not a real failure, no toast).
  - No `navigator.share`: falls back to
    `navigator.clipboard.writeText`, then the existing `showFlash('ok', ...)`
    toast mechanism confirms the copy.
  - Any other rejection (e.g. clipboard denied, non-secure context) →
    `showFlash('err', captureAndFormat(err, t.shareFailed))`, matching
    the existing delete/import error-reporting pattern (Sentry capture
    + user-facing message).
- New icon: `Share2` from `lucide-react` (already a project dependency,
  no new package).
- New i18n keys added to all three locales (DE/FR/IT) in
  `src/i18n/translations.ts`: `share`, `linkCopied`, `shareFailed`.

## Error handling / edge cases

- Missing/malformed `venue` param → `parseVenueParam` returns `null` →
  no-op, default view (unchanged from today).
- Syntactically valid but nonexistent venue id → matching effect finds
  no match, marks itself applied, default view — no error shown.
- Both `?venue=` and `?ctn=` present → only venue logic runs at load
  (see precedence rule); `ctn` is stripped from the URL as soon as the
  URL-sync effect first fires (on mount it's skipped, so this happens
  on the first real `detailId` change — including the permalink's own
  match, if any).
- Deleting the currently open/permalinked venue (existing
  `confirmDelete` flow) already clears `detailId` on success → URL-sync
  effect strips `?venue=` automatically; no special-casing needed.
- Share clicked with no `navigator.share` and no `navigator.clipboard`
  (very old browser or insecure context) → `writeText` throws/rejects →
  falls into the `shareFailed` toast path, no crash.

## Testing

- `src/lib/permalink.test.ts` (extend existing file):
  - `parseVenueParam`: present, missing, empty string, mixed with other
    query params (mirrors the existing `parseCantonParam` test shape).
  - `withVenueParam`: sets `venue=<id>` on a bare path, clears `venue`
    when passed `null`, strips an existing `ctn` param in both cases,
    preserves unrelated query params.
- `src/features/venue-detail/DetailModal.test.tsx` (extend): Share
  button renders for both admin and non-admin, clicking it calls
  `onShare` (not `onNavigate`), clicking Navigate calls `onNavigate` (not
  `onShare`).
- No new `App.test.tsx` for the URL-sync/permalink-matching wiring —
  consistent with this codebase's existing convention of not
  unit-testing this class of stateful App-level wiring directly (the
  same call was made for `?ctn=`); the pure `permalink.ts` functions
  carry the test coverage instead.
