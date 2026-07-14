# Indoor/Outdoor quick-filter — design

**Issue:** #13 — Indoor/Outdoor quick-filter in sidebar
**Date:** 2026-07-14

## Problem

Every venue carries `indoor` and `outdoor` boolean fields (shown as tags in the
detail view), but there is no way to filter the list by them. A user looking
specifically for an outdoor Schwinget cannot narrow the list.

## Goal

Two toggle chips (Indoor / Outdoor) near the sidebar search box that narrow the
venue list client-side, combined with the existing text search.

## Decisions

- **Scope: sidebar list only.** The map keeps showing all venues, consistent with
  how text search behaves today (search never touches the map). `MapView` and
  `App.tsx` are untouched.
- **Both chips selected → OR.** Chips within the facet are OR'd: Indoor+Outdoor
  shows venues that are indoor *or* outdoor. Standard faceted-filter behavior.
- **Text × facet → AND.** A venue must pass the text query *and* the facet filter.
- **No chip active → facet filter is a no-op** (list unchanged).
- **State lives locally in `Sidebar`** via `useState`. The filter has no consumer
  outside the sidebar, needs no import-reset, and has no permalink — lifting it to
  `App` would be needless coupling.
- **No URL/permalink persistence.** Chip state is transient UI, unlike `?ctn=` /
  `?venue=` which address a place/venue. Out of scope.
- **Icons: lucide `Home` + `Mountain`**, matching the detail view's indoor/outdoor
  tags, rather than raw `⌂`/`⛰` unicode.
- **No new i18n keys** — `indoor` / `outdoor` already exist in DE/FR/IT.

## Design

### 1. Filter logic (pure, tested) — `src/features/venues/grouping.ts`

Extend `filterVenues` with an optional facet argument:

```ts
export interface Facets { indoor: boolean; outdoor: boolean } // which chips are ACTIVE

export const filterVenues = (venues: Venue[], search: string, facets?: Facets): Venue[] => {
  const q = search.trim().toLowerCase();
  return venues.filter((v) => {
    const c = cantonByCode(v.canton);
    const textOk =
      !q ||
      `${v.name} ${v.address} ${c ? c.name : ''} ${v.person ?? ''}`.toLowerCase().includes(q);
    const anyFacet = !!facets && (facets.indoor || facets.outdoor);
    const facetOk =
      !anyFacet || (facets!.indoor && v.indoor) || (facets!.outdoor && v.outdoor);
    return textOk && facetOk;
  });
};
```

- Text search AND facet filter (both must pass).
- The two chips OR with each other.
- No chip active ⇒ `anyFacet` false ⇒ facet filter is a no-op.
- Empty query with no facet returns all venues (unchanged behavior).

### 2. Sidebar UI — `src/features/sidebar/Sidebar.tsx`

- Local state: `const [facets, setFacets] = useState<Facets>({ indoor: false, outdoor: false })`.
- New **toggle-chip row** directly below the search box, above the sort control.
  Each chip:
  - lucide `Home` (Indoor) / `Mountain` (Outdoor) icon + `t.indoor` / `t.outdoor` label,
  - `<button type="button" aria-pressed={active}>` that toggles its own flag,
  - active style reuses the accent-fill pattern of an active sort pill
    (`theme.color.accent` bg / `theme.color.accentInk` text); inactive uses the
    bordered `theme.color.line` look.
- Feed the filter through: `const list = filterVenues(venues, search, facets)`.
- Generalize the "a filter is active" notion:
  `const filtering = searching || facets.indoor || facets.outdoor`.
  Use `filtering` wherever `searching` currently drives **group auto-expand**
  (`exp = searching || expanded[code]`) and **`includeEmpty`**
  (`groupByCanton(list, !searching)`), so facet-filtering — even with no text —
  auto-expands groups and hides empty cantons exactly like text search.
- Generalize the empty state: show `t.noResults` when `filtering && list.length === 0`
  (currently keyed on `searching`).
- The count pill (`{list.length} {t.unitTotal}`) already derives from `list`, so it
  updates for free.

### 3. Testing

**`grouping.test.ts`** — extend the fixture with an outdoor venue, then add
`filterVenues` cases:
- `{ indoor: true }` returns only indoor venues,
- `{ outdoor: true }` returns only outdoor venues,
- both active returns the union (OR),
- a venue that is neither is excluded when any chip is active,
- facet + text query combine with AND,
- no facet (or `undefined`) leaves results as today.

**`Sidebar.test.tsx`** —
- clicking the Outdoor chip leaves only outdoor venues and flips its `aria-pressed`,
- clicking both chips shows the union,
- clicking an active chip again clears it,
- a facet with zero matches shows the `noResults` text.

## Out of scope (YAGNI)

- Map marker filtering.
- URL / permalink persistence of chip state.
- A generic multi-facet filter framework.
- Any new venue fields or backend/migration changes.

## Files touched

- `src/features/venues/grouping.ts` — extend `filterVenues`, add `Facets`.
- `src/features/venues/grouping.test.ts` — facet cases.
- `src/features/sidebar/Sidebar.tsx` — chip row, local state, generalized
  `filtering` flag.
- `src/features/sidebar/Sidebar.test.tsx` — chip interaction tests.
