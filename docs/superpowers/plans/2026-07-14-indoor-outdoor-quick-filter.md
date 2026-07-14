# Indoor/Outdoor quick-filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two toggle chips (Indoor / Outdoor) to the sidebar that narrow the venue list client-side, combined with the existing text search.

**Architecture:** Extend the pure `filterVenues` function with an optional facet argument (text AND facet; the two chips OR with each other). The Sidebar holds the chip on/off state locally and renders a toggle-chip row below the search box. Nothing outside the sidebar changes — the map is untouched.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library, lucide-react icons, inline-style theme tokens (`theme.color.*`).

## Global Constraints

- No `any` in TypeScript — use proper types or `unknown`.
- No new npm dependencies.
- i18n keys must stay in sync across DE/FR/IT — but this feature adds **no new keys** (`indoor` / `outdoor` already exist in all three languages).
- Run `npm run test` and `npm run lint` before considering the work complete.
- Commit on the feature branch `claude/new-session-eeiygh` using Conventional Commits.
- Spec: `docs/superpowers/specs/2026-07-14-indoor-outdoor-quick-filter-design.md`.

---

## File Structure

- `src/features/venues/grouping.ts` — add `Facets` interface; extend `filterVenues` signature and body.
- `src/features/venues/grouping.test.ts` — add facet-filtering test cases.
- `src/features/sidebar/Sidebar.tsx` — add chip state, the chip-row UI, and generalize the "a filter is active" logic.
- `src/features/sidebar/Sidebar.test.tsx` — add chip-interaction tests.

---

## Task 1: Facet filtering in `filterVenues`

**Files:**
- Modify: `src/features/venues/grouping.ts:6-13`
- Test: `src/features/venues/grouping.test.ts:16-24` (extend the existing `describe('filterVenues')`)

**Interfaces:**
- Consumes: `Venue` (from `./types`), `cantonByCode` (from `../../data/cantons`) — both already imported.
- Produces:
  - `export interface Facets { indoor: boolean; outdoor: boolean }`
  - `filterVenues(venues: Venue[], search: string, facets?: Facets): Venue[]` — text query and facet filter combine with AND; the two facet flags OR with each other; when no query and no facet flag is set, returns the input array unchanged.

- [ ] **Step 1: Write the failing tests**

Add these cases inside the existing `describe('filterVenues', () => { ... })` block in `src/features/venues/grouping.test.ts` (after the last existing `it(...)`, before the block's closing `});`). The `v(...)` factory already exists at the top of the file.

```ts
  const mixed = [
    v({ id: '1', name: 'IndoorOnly', indoor: true, outdoor: false }),
    v({ id: '2', name: 'OutdoorOnly', indoor: false, outdoor: true }),
    v({ id: '3', name: 'Both', indoor: true, outdoor: true }),
    v({ id: '4', name: 'Neither', indoor: false, outdoor: false }),
  ];

  it('returns all when no facet flag is set', () => {
    expect(filterVenues(mixed, '', { indoor: false, outdoor: false }).map((x) => x.id))
      .toEqual(['1', '2', '3', '4']);
  });
  it('returns all when facets is omitted', () => {
    expect(filterVenues(mixed, '')).toHaveLength(4);
  });
  it('indoor chip keeps only indoor venues', () => {
    expect(filterVenues(mixed, '', { indoor: true, outdoor: false }).map((x) => x.id))
      .toEqual(['1', '3']);
  });
  it('outdoor chip keeps only outdoor venues', () => {
    expect(filterVenues(mixed, '', { indoor: false, outdoor: true }).map((x) => x.id))
      .toEqual(['2', '3']);
  });
  it('both chips keep the union (indoor OR outdoor), excluding neither', () => {
    expect(filterVenues(mixed, '', { indoor: true, outdoor: true }).map((x) => x.id))
      .toEqual(['1', '2', '3']);
  });
  it('combines text query and facet with AND', () => {
    // "o" matches OutdoorOnly, Both, and IndoorOnly by name; outdoor chip narrows to outdoor ones.
    expect(filterVenues(mixed, 'only', { indoor: false, outdoor: true }).map((x) => x.id))
      .toEqual(['2']);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/venues/grouping.test.ts`
Expected: FAIL — the new cases error/mismatch because `filterVenues` does not yet accept a third argument (the omitted/`false` cases pass, but the facet cases return all 4 rows).

- [ ] **Step 3: Implement the facet filter**

In `src/features/venues/grouping.ts`, replace the current `filterVenues` (lines 6-13):

```ts
export const filterVenues = (venues: Venue[], search: string): Venue[] => {
  const q = search.trim().toLowerCase();
  if (!q) return venues;
  return venues.filter((v) => {
    const c = cantonByCode(v.canton);
    return `${v.name} ${v.address} ${c ? c.name : ''} ${v.person ?? ''}`.toLowerCase().includes(q);
  });
};
```

with:

```ts
export interface Facets {
  indoor: boolean;
  outdoor: boolean;
}

export const filterVenues = (venues: Venue[], search: string, facets?: Facets): Venue[] => {
  const q = search.trim().toLowerCase();
  const anyFacet = !!facets && (facets.indoor || facets.outdoor);
  if (!q && !anyFacet) return venues;
  return venues.filter((v) => {
    const c = cantonByCode(v.canton);
    const textOk =
      !q ||
      `${v.name} ${v.address} ${c ? c.name : ''} ${v.person ?? ''}`.toLowerCase().includes(q);
    const facetOk =
      !anyFacet || (facets!.indoor && v.indoor) || (facets!.outdoor && v.outdoor);
    return textOk && facetOk;
  });
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/features/venues/grouping.test.ts`
Expected: PASS — all `filterVenues`, `groupByCanton`, and `flatSorted` cases green.

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/grouping.ts src/features/venues/grouping.test.ts
git commit -m "feat: facet filter in filterVenues (#13)"
```

---

## Task 2: Indoor/Outdoor chip row in the Sidebar

**Files:**
- Modify: `src/features/sidebar/Sidebar.tsx` (import line 2, import line 4, add state after line 147, derived vars lines 329-333, chip row after line 491, expand flag line 611)
- Test: `src/features/sidebar/Sidebar.test.tsx` (add cases inside the existing `describe('Sidebar')`)

**Interfaces:**
- Consumes: `Facets` and `filterVenues(venues, search, facets)` from Task 1; `Home`, `Mountain` from `lucide-react`; `t.indoor` / `t.outdoor` from i18n; `theme.color.*` / `theme.radius.*` tokens.
- Produces: no new exported symbols. Two `<button aria-pressed>` toggles named by `t.indoor` (`"Innen"`) / `t.outdoor` (`"Aussen"`) that filter the rendered list.

- [ ] **Step 1: Write the failing tests**

Add these cases inside the existing `describe('Sidebar', () => { ... })` in `src/features/sidebar/Sidebar.test.tsx` (after the existing `it('filters venues as the user types ...')`, using the harness's `venuesData` prop). The `v(...)` factory already exists at the top of the file.

```ts
  it('filters the list to outdoor venues when the Outdoor chip is toggled', async () => {
    const user = userEvent.setup();
    const mixed = [
      v({ id: '1', name: 'InnenKeller', canton: 'BE', indoor: true, outdoor: false }),
      v({ id: '2', name: 'AussenPlatz', canton: 'LU', indoor: false, outdoor: true }),
    ];
    renderSidebar({ venuesData: mixed });
    const outdoor = await screen.findByRole('button', { name: STR.de.outdoor });
    expect(outdoor).toHaveAttribute('aria-pressed', 'false');

    await user.click(outdoor);

    expect(outdoor).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getByText('AussenPlatz')).toBeInTheDocument());
    expect(screen.queryByText('InnenKeller')).not.toBeInTheDocument();
  });

  it('shows the union when both chips are active', async () => {
    const user = userEvent.setup();
    const mixed = [
      v({ id: '1', name: 'InnenKeller', canton: 'BE', indoor: true, outdoor: false }),
      v({ id: '2', name: 'AussenPlatz', canton: 'LU', indoor: false, outdoor: true }),
      v({ id: '3', name: 'Nirgends', canton: 'ZH', indoor: false, outdoor: false }),
    ];
    renderSidebar({ venuesData: mixed });

    await user.click(await screen.findByRole('button', { name: STR.de.indoor }));
    await user.click(await screen.findByRole('button', { name: STR.de.outdoor }));

    await waitFor(() => expect(screen.getByText('InnenKeller')).toBeInTheDocument());
    expect(screen.getByText('AussenPlatz')).toBeInTheDocument();
    expect(screen.queryByText('Nirgends')).not.toBeInTheDocument();
  });

  it('clears the facet when an active chip is toggled off again', async () => {
    const user = userEvent.setup();
    const mixed = [
      v({ id: '1', name: 'InnenKeller', canton: 'BE', indoor: true, outdoor: false }),
      v({ id: '2', name: 'AussenPlatz', canton: 'LU', indoor: false, outdoor: true }),
    ];
    renderSidebar({ venuesData: mixed });
    const outdoor = await screen.findByRole('button', { name: STR.de.outdoor });

    await user.click(outdoor); // on
    await user.click(outdoor); // off

    expect(outdoor).toHaveAttribute('aria-pressed', 'false');
    // Idle again: groups collapse, so no venue rows are visible and no no-results banner shows.
    expect(screen.queryByText(STR.de.noResults)).not.toBeInTheDocument();
  });

  it('shows the no-results banner when a facet matches nothing', async () => {
    const user = userEvent.setup();
    const indoorOnly = [
      v({ id: '1', name: 'InnenKeller', canton: 'BE', indoor: true, outdoor: false }),
    ];
    renderSidebar({ venuesData: indoorOnly });

    await user.click(await screen.findByRole('button', { name: STR.de.outdoor }));

    await waitFor(() => expect(screen.getByText(STR.de.noResults)).toBeInTheDocument());
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/sidebar/Sidebar.test.tsx`
Expected: FAIL — `findByRole('button', { name: 'Innen' })` / `'Aussen'` throws because the chips do not exist yet.

- [ ] **Step 3: Add the icon imports**

In `src/features/sidebar/Sidebar.tsx`, change line 2:

```ts
import { Search, X, ChevronRight, ChevronLeft, Plus, Download, Upload } from 'lucide-react';
```

to:

```ts
import { Search, X, ChevronRight, ChevronLeft, Plus, Download, Upload, Home, Mountain } from 'lucide-react';
```

- [ ] **Step 4: Import the `Facets` type**

In `src/features/sidebar/Sidebar.tsx`, change line 4:

```ts
import { filterVenues, groupByCanton, flatSorted, type SortMode } from '../venues/grouping';
```

to:

```ts
import { filterVenues, groupByCanton, flatSorted, type SortMode, type Facets } from '../venues/grouping';
```

- [ ] **Step 5: Add the chip state**

In `src/features/sidebar/Sidebar.tsx`, immediately after line 147 (`const [dragX, setDragX] = useState<number | null>(null);`) add:

```ts
  const [facets, setFacets] = useState<Facets>({ indoor: false, outdoor: false });
```

- [ ] **Step 6: Generalize the derived filtering vars**

In `src/features/sidebar/Sidebar.tsx`, replace lines 329-333:

```ts
  const list = filterVenues(venues, search);
  const searching = search.trim() !== '';
  const groups = groupByCanton(list, !searching);
  const hasSearch = search.trim() !== '';
  const noResults = searching && list.length === 0;
```

with:

```ts
  const list = filterVenues(venues, search, facets);
  const searching = search.trim() !== '';
  const filtering = searching || facets.indoor || facets.outdoor;
  const groups = groupByCanton(list, !filtering);
  const hasSearch = search.trim() !== '';
  const noResults = filtering && list.length === 0;
```

- [ ] **Step 7: Use `filtering` for the group auto-expand**

In `src/features/sidebar/Sidebar.tsx`, change line 611:

```ts
          const exp = searching || !!expanded[group.code];
```

to:

```ts
          const exp = filtering || !!expanded[group.code];
```

- [ ] **Step 8: Add the chip-row UI**

In `src/features/sidebar/Sidebar.tsx`, insert this block directly after the search-box wrapper's closing `</div>` on line 491 (i.e. between the search box block and the `{isAdmin && (` block that begins on line 493):

```tsx
      <div style={{ padding: '0 15px 11px', flex: 'none', display: 'flex', gap: '8px' }}>
        {([
          { key: 'indoor', label: t.indoor, Icon: Home },
          { key: 'outdoor', label: t.outdoor, Icon: Mountain },
        ] as { key: keyof Facets; label: string; Icon: typeof Home }[]).map(({ key, label, Icon }) => {
          const active = facets[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setFacets((f) => ({ ...f, [key]: !f[key] }))}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                border: '1px solid ' + (active ? theme.color.accent : theme.color.line),
                background: active ? theme.color.accent : theme.color.bg,
                color: active ? theme.color.accentInk : theme.color.ink,
                fontWeight: 600,
                fontSize: '12.5px',
                padding: '9px 8px',
                borderRadius: theme.radius.sm,
                cursor: 'pointer',
              }}
            >
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>
```

- [ ] **Step 9: Run the Sidebar tests to verify they pass**

Run: `npm run test -- src/features/sidebar/Sidebar.test.tsx`
Expected: PASS — all Sidebar cases green, including the four new chip cases.

- [ ] **Step 10: Run the full test suite and lint**

Run: `npm run test`
Expected: PASS — whole suite green.

Run: `npm run lint`
Expected: no errors (no `any`, no unused vars — `searching` is still consumed by `filtering`).

- [ ] **Step 11: Commit**

```bash
git add src/features/sidebar/Sidebar.tsx src/features/sidebar/Sidebar.test.tsx
git commit -m "feat: indoor/outdoor quick-filter chips in sidebar (#13)"
```

---

## Self-Review

**Spec coverage:**
- Two toggle chips near the search box → Task 2, Step 8. ✓
- lucide `Home`/`Mountain` + `t.indoor`/`t.outdoor` → Task 2, Steps 3/8. ✓
- Text × facet AND; chips OR → Task 1, Step 3 + tests. ✓
- Sidebar-only scope (no map/App change) → no App.tsx or MapView task. ✓
- Local Sidebar state, no permalink → Task 2, Step 5. ✓
- Generalized auto-expand / includeEmpty / no-results via `filtering` → Task 2, Steps 6/7. ✓
- No new i18n keys → confirmed, no i18n task. ✓
- Tests for filter logic and chip interaction → Task 1 Step 1, Task 2 Step 1. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step has complete code. ✓

**Type consistency:** `Facets { indoor; outdoor }` defined in Task 1 is imported and used in Task 2 (`useState<Facets>`, `keyof Facets`). `filterVenues(venues, search, facets)` third-arg signature matches its use in Task 2, Step 6. `typeof Home` types the chip tuple's `Icon` (Mountain shares the lucide icon type) — no `any`. ✓
