# Admin Sidebar Cleanup — Design

**Date:** 2026-07-15
**Status:** Approved (pending spec review)
**Area:** `src/features/sidebar/Sidebar.tsx`, `src/i18n/translations.ts`

## Problem

The admin sidebar interleaves two unrelated jobs in one column:

| Job | Audience | Controls |
|-----|----------|----------|
| **Find a venue** | everyone | title → search → Innen/Aussen filter → sort tabs → browse list |
| **Manage data** | admin only | Add · JSON · CSV · Import |

The admin block (`Sidebar.tsx:529-583`) is injected **between the Innen/Aussen filter and the sort tabs**, splitting the visitor funnel in half. Additional smells:

1. **Flow interruption** — data-management tooling wedged mid-funnel.
2. **No grouping / label** — admin tools appear with no heading or boundary.
3. **Equal weight for unequal actions** — everyday "Add" gets the same first-class placement as rare, destructive bulk Export/Import.
4. **Duplicated count** — "9 Schwingkeller" shows in the dark header pill *and* again next to "NACH KANTON".
5. **Stale section label** — the list-section header always reads "Nach Kanton" even when the list is sorted flat by Name or Distance, where grouping-by-canton no longer applies.

Only admins ever render the admin block, so the real goals are for the *admin's own* experience: keep tools reachable without scrolling, minimize permanent space cost (esp. the mobile bottom sheet), and stop interleaving them with search/filter/sort.

## Design

### 1. "Verwaltung" collapsible top band

Render **only when `isAdmin`**, directly under the dark header block and **above** the search box (the seam near `Sidebar.tsx:442-444`). Remove the current inline admin block (`Sidebar.tsx:529-583`). Result: the visitor funnel (search → Innen/Aussen → sort → list) is fully contiguous, with no admin tooling in the middle.

**Collapsed (default):**

```
VERWALTUNG                    [ + ]  ▸
```

- `VERWALTUNG` label — reuses the small uppercase display-caps style already used for the "Nach Kanton" section header (`Sidebar.tsx:625-634`).
- `[ + ]` — accent icon-button, one-click Add (`onAdd`), `aria-label={t.add}`. The everyday action stays one click even while collapsed.
- `▸` chevron toggles expand.

**Expanded:**

```
VERWALTUNG                    [ + ]  ▾
[ JSON ]   [ CSV ]   [ Import ]
```

- Reveals the existing JSON / CSV / Import row (existing `exportBtnStyle`, behavior unchanged). These are rare, and Import is destructive (replaces all entries), so behind-the-expand is the right home.

**State:** `useState` seeded from `localStorage` key `sk-verwaltung-open` (default `false`), persisted on toggle. A returning admin who lives in Import keeps it open.

### 2. Remove the duplicated count

"9 Schwingkeller" currently appears in both the dark header pill (`Sidebar.tsx:439`) and the right side of the section-header row (`Sidebar.tsx:637`). The header pill is the canonical hero count; drop the right-side duplicate, leaving just the section label.

### 3. Sort-aware section label

The section-header label (`Sidebar.tsx:635`, currently always `t.byCanton`) becomes sort-aware:

| `sortMode` | Label (DE) |
|-----------|------------|
| `canton` | Nach Kanton |
| `name` | Nach Name |
| `distance` | Nach Distanz |

### 4. i18n — 4 new keys × DE/FR/IT

| Key | DE | FR | IT |
|-----|----|----|----|
| `adminSection` | Verwaltung | Gestion | Gestione |
| `adminToggle` (chevron aria-label) | Verwaltung ein-/ausblenden | Afficher/masquer la gestion | Mostra/nascondi gestione |
| `byName` | Nach Name | Par nom | Per nome |
| `byDistance` | Nach Distanz | Par distance | Per distanza |

`t.add` already exists (Add button aria-label); `t.import` exists; `t.byCanton` already exists; JSON/CSV are proper nouns.

### 5. Testing (TDD)

Extend `src/features/sidebar/Sidebar.test.tsx`:

- Non-admin: no Verwaltung band renders.
- Admin: band renders above the search box; collapsed by default; Export/Import row is **not rendered** (conditional render, not merely hidden) until expanded.
- Add button fires `onAdd` while collapsed (one-click).
- Toggling the chevron reveals JSON/CSV/Import and persists `sk-verwaltung-open` to `localStorage`.
- Section-header row shows no duplicate total count.
- Section label reflects the active sort mode (canton/name/distance).

## Scope boundaries

- **Not** touching mobile drag / tablet-panel logic — the band is fixed-header content and rides along unchanged.
- **Not** moving admin tools out of the sidebar (Topbar menu was considered and rejected in favor of keeping everything grouped in one place).
- No new npm dependencies; icons (`Plus`, `Download`, `Upload`, `ChevronRight`/`ChevronDown`) already available via `lucide-react`.
