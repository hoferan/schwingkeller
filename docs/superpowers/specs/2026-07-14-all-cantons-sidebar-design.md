# Show all 26 cantons in sidebar, with empty-state message — design

## Problem

The sidebar's canton grouping (`groupByCanton`) only lists cantons that
currently have at least one venue. Cantons with zero venues are invisible —
there's no way to see "this canton has no cellars listed yet." See issue #34.

This surfaced while building issue #10 (canton-centered permalinks, `?ctn=`):
once `?ctn=` can deep-link to *any* real canton (including empty ones), the
sidebar had no representation for those cantons. It was deliberately split out
of #10 to keep that spec focused.

## Scope

- List all 26 cantons in the sidebar when the user is **not** searching.
- A canton with zero venues shows a count badge of `0` and, when expanded, a
  neutral empty-state message (see Copy).
- While **searching**, empty cantons are hidden — only cantons with matching
  venues appear (unchanged from today's behavior).
- Empty cantons stay collapsed by default; the message appears only on expand.
- New i18n string across DE/FR/IT (`cantonEmpty`).

### Out of scope

- Any "request access" mechanism — no mailto, form, GitHub link, or auth
  tie-in. The neutral message simply states that only admins can add entries.
  The real self-registration / access-request flow is the separate
  canton-scoped user-management track (issues #25–#32, notably #28).
- Changing the default-expanded canton, the total venue count, search
  behavior beyond the empty-canton visibility rule, or any map behavior.

## Approach

### Data layer — `groupByCanton` gains an `includeEmpty` flag

`src/features/venues/grouping.ts` currently filters `CANTONS` down to those
with venues. Add an optional second parameter, defaulting to `false` so all
existing callers are unchanged:

```ts
export const groupByCanton = (venues: Venue[], includeEmpty = false): CantonGroup[] => {
  const by: Record<string, Venue[]> = {};
  venues.forEach((v) => { (by[v.canton] = by[v.canton] ?? []).push(v); });
  const source = includeEmpty ? CANTONS : CANTONS.filter((c) => by[c.code]);
  return source
    .map((c) => ({
      code: c.code, name: c.name, count: (by[c.code] ?? []).length, venues: by[c.code] ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
};
```

Groups are sorted alphabetically by canton name (German-locale collation, so
`Zürich` sorts after `Zug`); empty cantons come back as `{ count: 0, venues: [] }`
alongside the populated ones.

**Alternatives considered:** a separate `allCantonGroups()` function (two code
paths to keep in sync) and computing the full list inside the Sidebar (leaks
grouping logic into the component, harder to test). A flag on the single
existing function keeps one source of truth and stays trivially testable.

### Sidebar wiring — `src/features/sidebar/Sidebar.tsx`

- Compute groups with the flag driven by search state:
  `const groups = groupByCanton(list, !searching);`
  Full 26-canton list when idle; during search the filtered `list` has no
  venues for empty cantons, so they fall out naturally.
- The count badge already renders `{group.count}`, so empty cantons display
  `0` with no extra code.
- In the expanded body, when `group.venues.length === 0`, render the muted
  empty-state message (i18n key `cantonEmpty`) instead of the venue rows.
- Scope the existing "no results" empty state to search only:
  `const noResults = searching && list.length === 0;`
  Otherwise the 26 idle groups would render beneath a contradictory
  "no results" message if the venue set were ever empty.

### Copy — new i18n key `cantonEmpty` (DE/FR/IT)

| Lang | String |
|------|--------|
| de | `Für diesen Kanton sind noch keine Schwingkeller erfasst. Neue Einträge können ausschliesslich von Administratoren hinzugefügt werden.` |
| fr | `Aucun lieu n'est encore répertorié pour ce canton. Les nouvelles entrées ne peuvent être ajoutées que par les administrateurs.` |
| it | `Per questo cantone non è ancora stata registrata alcuna sede. Le nuove voci possono essere aggiunte esclusivamente dagli amministratori.` |

Swiss orthography (`ausschliesslich`, not `ausschließlich`), matching existing
strings like `Schliessen`. Uses the domain terms already in the app
(`Schwingkeller` / `lieu` / `sede`).

## Error handling / edge cases

- Venue set entirely empty + not searching → 26 empty groups render, each with
  its own `cantonEmpty` message; no "no results" banner (scoped to search).
- Search with no matches → empty cantons hidden, `noResults` banner shown
  (unchanged from today).

## Testing

- `src/features/venues/grouping.test.ts` (extend): `groupByCanton(venues, true)`
  returns all 26 cantons sorted alphabetically by name, with empty ones at `count: 0` and
  `venues: []`; the existing default-call test (only cantons with venues) stays
  green, confirming backward compatibility.
- `src/i18n/translations.test.ts` already enforces key parity across DE/FR/IT —
  adding `cantonEmpty` to all three keeps it passing.
- No new Sidebar/Leaflet-level test, consistent with this repo's convention of
  not unit-testing the large presentational components (no `Sidebar.test.tsx`
  or `App.test.tsx` today). The rendered empty state is verified manually via
  `npm run dev`.
