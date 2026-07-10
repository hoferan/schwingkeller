# Venue Permalinks (?venue=) + Share Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support `?venue=<id>` deep links that open a venue's `DetailModal` on load, keep the URL synced whenever a venue is opened/closed, and add a Share button that copies/shares that permalink.

**Architecture:** Two new pure functions in `src/lib/permalink.ts` (`parseVenueParam`, `withVenueParam`) handle URL parsing/building. `AppShell` (`src/App.tsx`) wires them into two effects: a one-shot effect that matches `?venue=<id>` against the loaded venue list and opens it, and a sync effect that keeps `history.replaceState`'d URL in step with `detailId`. `DetailModal` gains a Share button that reads `window.location.href` (already correct by the time the modal is open) and either hands it to `navigator.share` or copies it to the clipboard.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Query (`useVenues`), Vitest + React Testing Library, lucide-react icons.

## Global Constraints

- Run `npm run test` and `npm run lint` before calling any task done.
- Keep i18n keys in sync across DE/FR/IT (`src/i18n/translations.ts`) — there is an existing test (`src/i18n/translations.test.ts`) that asserts the three locales have identical key sets.
- No `any` — use proper types or `unknown`.
- No new npm dependencies (lucide-react and the Web Share/Clipboard browser APIs are already available).
- Conventional Commits format for commit messages.
- Commit on the current feature branch; do not push directly to `main`.

---

### Task 1: `parseVenueParam` and `withVenueParam` in `src/lib/permalink.ts`

**Files:**
- Modify: `src/lib/permalink.ts`
- Test: `src/lib/permalink.test.ts`

**Interfaces:**
- Produces: `parseVenueParam(search: string): string | null` and `withVenueParam(url: string, id: string | null): string`, both exported from `src/lib/permalink.ts`. `withVenueParam` expects `url` to be a `pathname[?search]` string (e.g. `window.location.pathname + window.location.search`) and returns the same shape.

- [ ] **Step 1: Write the failing tests for `parseVenueParam`**

Add to the bottom of `src/lib/permalink.test.ts` (keep the existing `import` and `parseCantonParam` describe block as-is):

```ts
import { parseCantonParam, parseVenueParam, withVenueParam } from './permalink';
```

Replace the existing `import { parseCantonParam } from './permalink';` line with the one above, then append:

```ts
describe('parseVenueParam', () => {
  it('returns the id verbatim', () => {
    expect(parseVenueParam('?venue=abc-123')).toBe('abc-123');
  });

  it('returns null when the param is missing', () => {
    expect(parseVenueParam('?foo=bar')).toBeNull();
  });

  it('returns null for an empty search string', () => {
    expect(parseVenueParam('')).toBeNull();
  });

  it('reads venue from among other query params', () => {
    expect(parseVenueParam('?foo=bar&venue=v1&baz=1')).toBe('v1');
  });

  it('returns null for an empty venue value', () => {
    expect(parseVenueParam('?venue=')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/permalink.test.ts`
Expected: FAIL — `parseVenueParam` is not exported from `./permalink`.

- [ ] **Step 3: Implement `parseVenueParam`**

In `src/lib/permalink.ts`, replace the stale comment above `parseCantonParam` (it currently says `?venue=` is a future feature, which is no longer true) and add `parseVenueParam`:

```ts
import { cantonByCode } from '../data/cantons';

// ?venue= takes precedence over ?ctn= when both are present — see
// parseVenueParam below and
// docs/superpowers/specs/2026-07-10-venue-permalink-share-design.md.
export const parseCantonParam = (search: string): string | null => {
  const raw = new URLSearchParams(search).get('ctn');
  if (!raw) return null;
  const code = raw.toUpperCase();
  return cantonByCode(code) ? code : null;
};

// Existence of the id against real venues can only be checked once the
// (async) venue list has loaded — this just extracts the raw id.
export const parseVenueParam = (search: string): string | null => {
  const raw = new URLSearchParams(search).get('venue');
  return raw ? raw : null;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/permalink.test.ts`
Expected: PASS (all `parseVenueParam` and `parseCantonParam` tests green).

- [ ] **Step 5: Write the failing tests for `withVenueParam`**

Append to `src/lib/permalink.test.ts`:

```ts
describe('withVenueParam', () => {
  it('sets venue on a bare path', () => {
    expect(withVenueParam('/', 'v1')).toBe('/?venue=v1');
  });

  it('sets venue alongside other existing params', () => {
    expect(withVenueParam('/?foo=bar', 'v1')).toBe('/?foo=bar&venue=v1');
  });

  it('clears venue when id is null', () => {
    expect(withVenueParam('/?venue=v1', null)).toBe('/');
  });

  it('clears venue but preserves other params', () => {
    expect(withVenueParam('/?foo=bar&venue=v1', null)).toBe('/?foo=bar');
  });

  it('strips an existing ctn param when setting venue', () => {
    expect(withVenueParam('/?ctn=FR', 'v1')).toBe('/?venue=v1');
  });

  it('strips an existing ctn param when clearing venue', () => {
    expect(withVenueParam('/?ctn=FR&venue=v1', null)).toBe('/');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/lib/permalink.test.ts`
Expected: FAIL — `withVenueParam` is not exported from `./permalink`.

- [ ] **Step 7: Implement `withVenueParam`**

Append to `src/lib/permalink.ts`:

```ts
// Builds the next pathname+search for history.replaceState. Always drops
// `ctn` since a venue permalink supersedes a canton one once the app is
// being interacted with; sets or clears `venue` based on `id`.
export const withVenueParam = (url: string, id: string | null): string => {
  const [path, search = ''] = url.split('?');
  const params = new URLSearchParams(search);
  params.delete('ctn');
  if (id) {
    params.set('venue', id);
  } else {
    params.delete('venue');
  }
  const next = params.toString();
  return next ? path + '?' + next : path;
};
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/lib/permalink.test.ts`
Expected: PASS — all tests in the file green.

- [ ] **Step 9: Commit**

```bash
git add src/lib/permalink.ts src/lib/permalink.test.ts
git commit -m "feat: add parseVenueParam and withVenueParam for venue permalinks"
```

---

### Task 2: i18n keys for the Share button (`share`, `linkCopied`, `shareFailed`)

**Files:**
- Modify: `src/i18n/translations.ts`

**Interfaces:**
- Produces: `t.share`, `t.linkCopied`, `t.shareFailed` (available on `STR.de`, `STR.fr`, `STR.it`, and therefore on `TKey`).

- [ ] **Step 1: Add the three keys to all three locales**

In `src/i18n/translations.ts`, in the `de` block, after the line `uploadError: 'Foto-Upload fehlgeschlagen',` add:

```ts
    share: 'Teilen',
    linkCopied: 'Link kopiert',
    shareFailed: 'Teilen fehlgeschlagen',
```

In the `fr` block, after the line `uploadError: 'Échec du téléchargement de la photo',` add:

```ts
    share: 'Partager',
    linkCopied: 'Lien copié',
    shareFailed: 'Échec du partage',
```

In the `it` block, after the line `uploadError: 'Caricamento foto fallito',` add:

```ts
    share: 'Condividi',
    linkCopied: 'Link copiato',
    shareFailed: 'Condivisione non riuscita',
```

- [ ] **Step 2: Run the existing i18n parity test**

Run: `npx vitest run src/i18n/translations.test.ts`
Expected: PASS — `Object.keys(STR.de)` still equals `Object.keys(STR.fr)` and `Object.keys(STR.it)` (all three gained the same three keys).

- [ ] **Step 3: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat: add share/linkCopied/shareFailed translations"
```

---

### Task 3: Venue permalink wiring in `AppShell` (`src/App.tsx`)

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `parseVenueParam(search: string): string | null` and `withVenueParam(url: string, id: string | null): string` from `./lib/permalink` (Task 1); `parseCantonParam` (already imported); `useVenues()` from `./features/venues/useVenues` (a TanStack Query result — `isSuccess: boolean` is a standard field on it, no changes needed to `useVenues` itself).
- Produces: whenever `detailId` is non-null, `window.location.href` includes `?venue=<detailId>` and does not include `ctn=`; whenever `detailId` is null, it includes neither. Task 4's Share handler relies on this.

- [ ] **Step 1: Update the import from `./lib/permalink`**

In `src/App.tsx`, change:

```ts
import { parseCantonParam } from './lib/permalink';
```

to:

```ts
import { parseCantonParam, parseVenueParam, withVenueParam } from './lib/permalink';
```

- [ ] **Step 2: Parse `venueParam` and gate `ctnParam` on it**

Replace:

```ts
  // Cross-cutting UI state.
  // Parsed once at startup — this is not a live two-way URL sync (see
  // docs/superpowers/specs/2026-07-10-canton-permalinks-design.md).
  const [ctnParam] = useState<string | null>(() => parseCantonParam(window.location.search));
```

with:

```ts
  // Cross-cutting UI state.
  // Parsed once at startup. ?venue= takes precedence over ?ctn= — see
  // docs/superpowers/specs/2026-07-10-venue-permalink-share-design.md.
  const [venueParam] = useState<string | null>(() => parseVenueParam(window.location.search));
  const [ctnParam] = useState<string | null>(() =>
    venueParam ? null : parseCantonParam(window.location.search),
  );
```

- [ ] **Step 3: Destructure `isSuccess` from `useVenues()`**

Replace:

```ts
  const { data: venues = [] } = useVenues();
```

with:

```ts
  const { data: venues = [], isSuccess: venuesLoaded } = useVenues();
```

- [ ] **Step 4: Add the permalink-match effect and the URL-sync effect**

Directly below the existing line `const closeDetail = () => setDetailId(null);`, add:

```ts

  // Resolve a ?venue= permalink once the venues query settles. Runs at
  // most once — background refetches must not re-trigger it.
  const appliedVenueParamRef = useRef(false);
  useEffect(() => {
    if (!venueParam || appliedVenueParamRef.current || !venuesLoaded) return;
    appliedVenueParamRef.current = true;
    const match = venues.find((v) => v.id === venueParam);
    if (match) {
      openDetail(match.id);
      setExpanded((e) => ({ ...e, [match.canton]: true }));
    }
  }, [venueParam, venues, venuesLoaded]);

  // Keep the URL's ?venue= in sync with the open/closed DetailModal so the
  // address bar stays shareable. Skips its first run so it never strips a
  // permalink's ?venue= before the effect above has applied it.
  const mountedUrlSyncRef = useRef(false);
  useEffect(() => {
    if (!mountedUrlSyncRef.current) {
      mountedUrlSyncRef.current = true;
      return;
    }
    const next = withVenueParam(window.location.pathname + window.location.search, detailId);
    window.history.replaceState(null, '', next);
  }, [detailId]);
```

(`useEffect` and `useRef` are already imported at the top of `src/App.tsx`; no import changes needed for this step.)

- [ ] **Step 5: Verify the build, lint, and full test suite**

Run: `npm run build`
Expected: succeeds with no type errors (confirms `isSuccess`/`venuesLoaded`, the new effects, and the `permalink.ts` imports all type-check).

Run: `npm run lint`
Expected: no errors (in particular, no `noUnusedLocals`/`noUnusedParameters` violations — `venueParam`, `appliedVenueParamRef`, and `mountedUrlSyncRef` are all read inside the effects above).

Run: `npm run test`
Expected: all existing tests still pass (this task intentionally adds no new automated test — see the design doc's Testing section: this class of App-level stateful wiring isn't unit-tested in this codebase, matching the precedent set by the `?ctn=` permalink).

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`, open the app in a browser, pick any venue's id from the sidebar (open its detail via a normal click first, note the `?venue=` value now in the address bar from Task 4's wiring — or query Supabase directly for an id), then load `http://localhost:5173/?venue=<that-id>` directly.
Expected: the app loads with that venue's `DetailModal` already open, the map focused on it, and its canton group expanded in the sidebar. Loading with a nonexistent id (e.g. `?venue=does-not-exist`) loads the normal default view with no error.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: resolve and sync ?venue= permalinks in AppShell"
```

---

### Task 4: Share button in `DetailModal`

**Files:**
- Modify: `src/features/venue-detail/DetailModal.tsx`
- Modify: `src/App.tsx`
- Test: `src/features/venue-detail/DetailModal.test.tsx`

**Interfaces:**
- Consumes: `t.share`, `t.linkCopied`, `t.shareFailed` (Task 2); the guarantee from Task 3 that `window.location.href` reflects the open venue's permalink; `captureAndFormat(err: unknown, fallback: string): string` and `showFlash(kind: 'ok' | 'err', text: string): void` (already defined in `src/App.tsx`).
- Produces: `DetailModalProps.onShare: () => void`, wired in `AppShell` to a new `shareVenue` handler.

- [ ] **Step 1: Write the failing tests**

In `src/features/venue-detail/DetailModal.test.tsx`, add `fireEvent` to the existing import:

```ts
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
```

Replace the `renderModal` helper:

```ts
const renderModal = () =>
  render(
    <AuthProvider>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <DetailModal
          venue={venue}
          onClose={noop}
          onNavigate={noop}
          onEdit={noop}
          onDelete={noop}
        />
      </I18nContext.Provider>
    </AuthProvider>,
  );
```

with a version that accepts prop overrides so the new tests can pass in mocks without changing the two existing tests' call sites:

```ts
const renderModal = (overrides: Partial<React.ComponentProps<typeof DetailModal>> = {}) =>
  render(
    <AuthProvider>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <DetailModal
          venue={venue}
          onClose={noop}
          onNavigate={noop}
          onShare={noop}
          onEdit={noop}
          onDelete={noop}
          {...overrides}
        />
      </I18nContext.Provider>
    </AuthProvider>,
  );
```

Then append two new tests at the end of the `describe('DetailModal', ...)` block:

```ts
  it('calls onShare when the Share button is clicked, not onNavigate', async () => {
    const onNavigate = vi.fn();
    const onShare = vi.fn();
    renderModal({ onNavigate, onShare });
    await screen.findByText(venue.name);
    fireEvent.click(screen.getByRole('button', { name: STR.de.share }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('calls onNavigate when the Navigate button is clicked, not onShare', async () => {
    const onNavigate = vi.fn();
    const onShare = vi.fn();
    renderModal({ onNavigate, onShare });
    await screen.findByText(venue.name);
    fireEvent.click(screen.getByRole('button', { name: STR.de.navigate }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onShare).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/venue-detail/DetailModal.test.tsx`
Expected: FAIL — `onShare` is missing from `DetailModalProps` / not accepted by `<DetailModal>`, and there is no button with accessible name `STR.de.share`.

- [ ] **Step 3: Implement the Share button in `DetailModal`**

In `src/features/venue-detail/DetailModal.tsx`, update the icon import:

```ts
import { X, MapPin, Home, Mountain, User, Phone, Globe, ExternalLink, Share2 } from 'lucide-react';
```

Add `onShare` to the props interface:

```ts
interface DetailModalProps {
  venue: Venue;
  onClose: () => void;
  onNavigate: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}
```

Update the component signature:

```ts
export const DetailModal = ({ venue, onClose, onNavigate, onShare, onEdit, onDelete }: DetailModalProps) => {
```

Replace the single full-width Navigate button:

```tsx
        <button
          onClick={onNavigate}
          style={{
            marginTop: '16px', width: '100%', border: 'none', cursor: 'pointer',
            background: theme.color.accent, color: theme.color.accentInk, fontWeight: 600, fontSize: '14px',
            padding: '13px', borderRadius: theme.radius.sm, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '8px',
          }}
        >
          {t.navigate} <ExternalLink size={15} />
        </button>
```

with a two-button row:

```tsx
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button
            onClick={onNavigate}
            style={{
              flex: 2, border: 'none', cursor: 'pointer',
              background: theme.color.accent, color: theme.color.accentInk, fontWeight: 600, fontSize: '14px',
              padding: '13px', borderRadius: theme.radius.sm, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '8px',
            }}
          >
            {t.navigate} <ExternalLink size={15} />
          </button>
          <button
            onClick={onShare}
            style={{
              flex: 1, border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.ink,
              fontWeight: 600, fontSize: '14px', padding: '13px', borderRadius: theme.radius.sm, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {t.share} <Share2 size={15} />
          </button>
        </div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/venue-detail/DetailModal.test.tsx`
Expected: PASS — all four tests in the file green.

- [ ] **Step 5: Wire the `shareVenue` handler in `AppShell` and pass it down**

In `src/App.tsx`, directly below the existing `navigate` handler:

```ts
  const navigate = () => {
    if (detailVenue) {
      window.open(
        'https://www.google.com/maps/dir/?api=1&destination=' + detailVenue.lat + ',' + detailVenue.lng,
        '_blank',
      );
    }
  };
```

add:

```ts

  const shareVenue = async () => {
    if (!detailVenue) return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: detailVenue.name, url });
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

Then update the `<DetailModal>` usage to pass the new prop:

```tsx
      {detailVenue && (
        <DetailModal
          venue={detailVenue}
          onClose={closeDetail}
          onNavigate={navigate}
          onShare={() => { void shareVenue(); }}
          onEdit={openEdit}
          onDelete={askDelete}
        />
      )}
```

- [ ] **Step 6: Verify build, lint, and full test suite**

Run: `npm run build`
Expected: succeeds with no type errors.

Run: `npm run lint`
Expected: no errors.

Run: `npm run test`
Expected: all tests pass, including the two new `DetailModal` tests from Step 1.

- [ ] **Step 7: Manual smoke test**

With `npm run dev` running, open any venue's detail, click Share:
- On a browser/OS with the Web Share API (most mobile browsers): the native share sheet should open with the venue name and current URL.
- On a browser without it (most desktops): the URL should be copied to the clipboard and a "Link kopiert" (or locale equivalent) toast should appear briefly.

- [ ] **Step 8: Commit**

```bash
git add src/features/venue-detail/DetailModal.tsx src/features/venue-detail/DetailModal.test.tsx src/App.tsx
git commit -m "feat: add Share button to venue detail modal"
```

---

## Self-Review Notes

- **Spec coverage:** `?venue=` parsing (Task 1, 3), precedence over `?ctn=` (Task 1's `withVenueParam` ctn-stripping + Task 3's gated `ctnParam`), URL sync on open/close (Task 3), sidebar canton expand on permalink match (Task 3 Step 4), Share button UI + behavior + i18n (Tasks 2, 4), error handling for `AbortError`/clipboard failure (Task 4) — all covered.
- **Placeholder scan:** none found; every step has literal code.
- **Type consistency:** `parseVenueParam`/`withVenueParam` signatures match between Task 1's implementation and Task 3's usage; `DetailModalProps.onShare: () => void` matches both the test mocks (Task 4 Step 1) and the `AppShell` wiring (`() => { void shareVenue(); }`, Task 4 Step 5); `t.share`/`t.linkCopied`/`t.shareFailed` keys added in Task 2 are the exact keys referenced in Task 4.
