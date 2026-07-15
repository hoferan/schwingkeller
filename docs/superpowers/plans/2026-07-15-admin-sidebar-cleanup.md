# Admin Sidebar Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate admin data tools from the visitor search funnel in the sidebar via a collapsible "Verwaltung" top band, remove the duplicated venue count, and make the list-section label sort-aware.

**Architecture:** All changes are confined to the sidebar feature and the i18n string table. A new admin-only collapsible band renders between the dark header and the search box; the existing inline admin block (mid-funnel) is removed. State for the band's expanded/collapsed status persists in `localStorage`. No new components, no new dependencies.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library, `lucide-react` icons, inline-style `theme` tokens.

## Global Constraints

- No new npm dependencies.
- No `any` in TypeScript — use proper types or `unknown`.
- All user-facing strings go through the i18n layer (`STR` in `src/i18n/translations.ts`); keep DE/FR/IT in sync — the parity test in `src/i18n/translations.test.ts` fails if any language is missing a key.
- Run `npm run test` and `npm run lint` before considering the work complete.
- Conventional Commits for messages. Work stays on branch `claude/new-session-eeiygh`.
- TDD: write the failing test first, watch it fail, then implement.

## File Structure

- `src/i18n/translations.ts` — add 4 keys (`adminSection`, `adminToggle`, `byName`, `byDistance`) to each of `de`, `fr`, `it`.
- `src/features/sidebar/Sidebar.tsx` — add `ChevronDown` import; add `adminOpen` state + persistence; render the collapsible Verwaltung band; remove the old inline admin block (lines ~529-583); make the section label sort-aware; drop the duplicate count.
- `src/features/sidebar/Sidebar.test.tsx` — add an admin render helper, `localStorage.clear()` to `afterEach`, and new tests; update the existing "hides admin tools when not admin" test.

---

### Task 1: Add i18n keys for the admin section and sort-aware label

**Files:**
- Modify: `src/i18n/translations.ts`
- Test: `src/i18n/translations.test.ts` (existing parity test covers this; add one explicit assertion)

**Interfaces:**
- Produces: new `TKey`s `adminSection`, `adminToggle`, `byName`, `byDistance`, each present in `STR.de`, `STR.fr`, `STR.it`. Consumed by Tasks 2 and 3 via `t.adminSection` etc.

- [ ] **Step 1: Add an explicit assertion test for the new keys**

In `src/i18n/translations.test.ts`, add inside the `describe('translations', …)` block:

```ts
it('defines the admin-section and sort-label keys in every language', () => {
  for (const lang of LANGS) {
    expect(STR[lang].adminSection).toBeTruthy();
    expect(STR[lang].adminToggle).toBeTruthy();
    expect(STR[lang].byName).toBeTruthy();
    expect(STR[lang].byDistance).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/i18n/translations.test.ts`
Expected: FAIL — the new keys don't exist yet (TypeScript/assertion error on `STR[lang].adminSection`).

- [ ] **Step 3: Add the keys to all three languages**

In `src/i18n/translations.ts`, add these four lines to the `de` block (e.g. right after the `byCanton` line):

```ts
    adminSection: 'Verwaltung',
    adminToggle: 'Verwaltung ein-/ausblenden',
    byName: 'Nach Name',
    byDistance: 'Nach Distanz',
```

Add to the `fr` block:

```ts
    adminSection: 'Gestion',
    adminToggle: 'Afficher/masquer la gestion',
    byName: 'Par nom',
    byDistance: 'Par distance',
```

Add to the `it` block:

```ts
    adminSection: 'Gestione',
    adminToggle: 'Mostra/nascondi gestione',
    byName: 'Per nome',
    byDistance: 'Per distanza',
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/i18n/translations.test.ts`
Expected: PASS (both the new test and the existing "all languages share the same keys" parity test are green).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/translations.ts src/i18n/translations.test.ts
git commit -m "feat: add i18n keys for admin section and sort-aware list label"
```

---

### Task 2: Make the list-section label sort-aware and remove the duplicate count

**Files:**
- Modify: `src/features/sidebar/Sidebar.tsx` (the section-header row near lines 616-638)
- Test: `src/features/sidebar/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `t.byCanton`, `t.byName`, `t.byDistance` (from Task 1); existing `sortMode: SortMode` prop.
- Produces: no new exports. The section-header row shows exactly one sort-dependent label and no total-count span.

- [ ] **Step 1: Write the failing tests**

In `src/features/sidebar/Sidebar.test.tsx`, add inside the `describe('Sidebar', …)` block:

```ts
it('labels the list section by canton in canton sort mode', async () => {
  renderSidebar({ sortModeInit: 'canton' });
  await waitFor(() => expect(screen.getByText(STR.de.byCanton)).toBeInTheDocument());
  expect(screen.queryByText(STR.de.byName)).not.toBeInTheDocument();
});

it('relabels the list section when sorting by name', async () => {
  renderSidebar({ sortModeInit: 'name' });
  await waitFor(() => expect(screen.getByText(STR.de.byName)).toBeInTheDocument());
  expect(screen.queryByText(STR.de.byCanton)).not.toBeInTheDocument();
});

it('relabels the list section when sorting by distance', async () => {
  renderSidebar({ sortModeInit: 'distance', userPosition: { lat: 46.95, lng: 7.45 } });
  await waitFor(() => expect(screen.getByText(STR.de.byDistance)).toBeInTheDocument());
  expect(screen.queryByText(STR.de.byCanton)).not.toBeInTheDocument();
});

it('shows the total count only once (header pill, not the section header)', async () => {
  renderSidebar();
  await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());
  // "3 Schwingkeller" (venues fixture has 3) must appear exactly once — the dark header pill.
  expect(screen.getAllByText(`3 ${STR.de.unitTotal}`)).toHaveLength(1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/sidebar/Sidebar.test.tsx -t "list section"`
Expected: FAIL — the label is hardcoded to `byCanton`, and the count currently renders twice (header pill + section header), so the last test finds length 2.

- [ ] **Step 3: Compute the sort-aware label**

In `src/features/sidebar/Sidebar.tsx`, just after the existing `const flatList = …` line (~338), add:

```tsx
  const sectionLabel = sortMode === 'name' ? t.byName : sortMode === 'distance' ? t.byDistance : t.byCanton;
```

- [ ] **Step 4: Use the label and drop the duplicate count**

Replace the section-header block (currently lines ~616-638):

```tsx
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px 9px',
          flex: 'none',
        }}
      >
        <span
          style={{
            fontFamily: theme.font.display,
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: theme.color.muted,
            fontWeight: 700,
          }}
        >
          {t.byCanton}
        </span>
        <span style={{ fontSize: '11px', color: theme.color.muted }}>{totalText}</span>
      </div>
```

with (drops the count span; label is now sort-aware):

```tsx
      <div style={{ padding: '0 18px 9px', flex: 'none' }}>
        <span
          style={{
            fontFamily: theme.font.display,
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: theme.color.muted,
            fontWeight: 700,
          }}
        >
          {sectionLabel}
        </span>
      </div>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -- src/features/sidebar/Sidebar.test.tsx -t "list section"` then `npm run test -- src/features/sidebar/Sidebar.test.tsx -t "total count"`
Expected: PASS for all four new tests. (The pre-existing sort/filter tests in this file must also stay green — run the whole file: `npm run test -- src/features/sidebar/Sidebar.test.tsx`.)

- [ ] **Step 6: Commit**

```bash
git add src/features/sidebar/Sidebar.tsx src/features/sidebar/Sidebar.test.tsx
git commit -m "feat: sort-aware sidebar section label, drop duplicate venue count"
```

---

### Task 3: Collapsible "Verwaltung" admin band; remove the mid-funnel admin block

**Files:**
- Modify: `src/features/sidebar/Sidebar.tsx` (add `ChevronDown` import; add state + band; remove old block ~529-583)
- Test: `src/features/sidebar/Sidebar.test.tsx` (admin render helper, `afterEach` cleanup, new tests, update one existing test)

**Interfaces:**
- Consumes: `t.adminSection`, `t.adminToggle`, `t.add`, `t.import` (Task 1 + existing); existing props `isAdmin` (from `useAuth`), `onAdd`, `onExportJSON`, `onExportCSV`, `onImport`, and the existing `fileRef`, `exportBtnStyle`.
- Produces: the band carries `data-testid="admin-section"`. Collapsed state persisted under `localStorage` key `sk-verwaltung-open` (string `'true'`/`'false'`, default absent → collapsed).

- [ ] **Step 1: Expose `onAdd` on the harness, add the admin render helper and localStorage cleanup**

In `src/features/sidebar/Sidebar.test.tsx`, first let the harness accept an `onAdd` prop so a test can assert it fires. Add `onAdd?: () => void;` to the `HarnessProps` interface, then default and forward it in `Harness`:

```tsx
// in HarnessProps:
  onAdd?: () => void;
```

```tsx
// in the Harness destructuring params (add alongside the others):
  onAdd = () => {},
```

```tsx
// in the <Sidebar …> JSX, replace `onAdd={vi.fn()}` with:
  onAdd={onAdd}
```

Then add this helper right after the existing `renderSidebar` definition (~line 102). `getSession` is the hoisted mock already used by the file; `isAdmin` is `!!session` in `AuthProvider`, so any non-null session makes the sidebar render as admin:

```tsx
const renderAdminSidebar = (props: HarnessProps = {}) => {
  getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'admin' } } } });
  return renderSidebar(props);
};
```

Then extend the existing `afterEach` (currently only `vi.unstubAllGlobals()`) so band state never leaks between tests:

```tsx
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });
```

- [ ] **Step 2: Write the failing tests**

Add inside the `describe('Sidebar', …)` block:

```tsx
it('renders the Verwaltung band above the search box when admin', async () => {
  renderAdminSidebar();
  const band = await screen.findByTestId('admin-section');
  const searchInput = screen.getByPlaceholderText(STR.de.search);
  // Band must appear before the search input in document order.
  expect(band.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('collapses the Verwaltung band by default, hiding Export/Import', async () => {
  renderAdminSidebar();
  await screen.findByTestId('admin-section');
  expect(screen.queryByText('JSON')).not.toBeInTheDocument();
  expect(screen.queryByText('CSV')).not.toBeInTheDocument();
  expect(screen.queryByText(STR.de.import)).not.toBeInTheDocument();
});

it('adds a venue in one click while the band is collapsed', async () => {
  const user = userEvent.setup();
  const onAdd = vi.fn();
  renderAdminSidebar({ onAdd });
  // Band is collapsed by default (Export/Import not rendered), yet Add is reachable directly.
  const addBtn = await screen.findByRole('button', { name: STR.de.add });
  expect(screen.queryByText('JSON')).not.toBeInTheDocument();

  await user.click(addBtn);

  expect(onAdd).toHaveBeenCalledTimes(1);
});

it('reveals Export/Import and persists open state when expanded', async () => {
  const user = userEvent.setup();
  renderAdminSidebar();
  const toggle = await screen.findByRole('button', { name: STR.de.adminToggle });

  await user.click(toggle);

  expect(screen.getByText('JSON')).toBeInTheDocument();
  expect(screen.getByText('CSV')).toBeInTheDocument();
  expect(screen.getByText(STR.de.import)).toBeInTheDocument();
  expect(localStorage.getItem('sk-verwaltung-open')).toBe('true');
});

it('restores the expanded band from localStorage on mount', async () => {
  localStorage.setItem('sk-verwaltung-open', 'true');
  renderAdminSidebar();
  await screen.findByTestId('admin-section');
  expect(screen.getByText('JSON')).toBeInTheDocument();
});
```

Then **replace** the existing test `hides admin tools when not admin` (currently ~lines 211-215) with a version that no longer depends on Add being visible *text* (Add is now an icon button with an aria-label):

```tsx
it('hides admin tools when not admin', async () => {
  renderSidebar();
  await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());
  expect(screen.queryByTestId('admin-section')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: STR.de.add })).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test -- src/features/sidebar/Sidebar.test.tsx -t "Verwaltung"`
Expected: FAIL — `admin-section` testid doesn't exist yet.

- [ ] **Step 4: Import the ChevronDown icon**

In `src/features/sidebar/Sidebar.tsx`, update the `lucide-react` import (line 2) to add `ChevronDown`:

```tsx
import { Search, X, ChevronRight, ChevronLeft, ChevronDown, Plus, Download, Upload, Home, Mountain } from 'lucide-react';
```

- [ ] **Step 5: Add the band's persisted state**

In `src/features/sidebar/Sidebar.tsx`, add alongside the other `useState` hooks (e.g. after the `facets` state ~line 148):

```tsx
  const [adminOpen, setAdminOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sk-verwaltung-open') === 'true';
    } catch {
      return false;
    }
  });
  const toggleAdmin = () =>
    setAdminOpen((open) => {
      const next = !open;
      try {
        localStorage.setItem('sk-verwaltung-open', String(next));
      } catch {
        /* localStorage unavailable — keep in-memory state only */
      }
      return next;
    });
```

- [ ] **Step 6: Render the Verwaltung band above the search box**

In `src/features/sidebar/Sidebar.tsx`, insert this block immediately after the header's closing `</div>` (the one ending the `sidebar-header` block, ~line 442) and **before** the search container `<div style={{ padding: '15px 15px 11px', … }}>` (~line 444):

```tsx
      {isAdmin && (
        <div style={{ padding: '12px 15px 4px', flex: 'none' }} data-testid="admin-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontFamily: theme.font.display,
                fontSize: '11px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: theme.color.muted,
                fontWeight: 700,
                flex: 1,
              }}
            >
              {t.adminSection}
            </span>
            <button
              type="button"
              onClick={onAdd}
              aria-label={t.add}
              title={t.add}
              style={{
                width: '30px',
                height: '30px',
                border: 'none',
                borderRadius: theme.radius.sm,
                background: theme.color.accent,
                color: theme.color.accentInk,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              onClick={toggleAdmin}
              aria-label={t.adminToggle}
              aria-expanded={adminOpen}
              title={t.adminSection}
              style={{
                width: '30px',
                height: '30px',
                border: '1px solid ' + theme.color.line,
                borderRadius: theme.radius.sm,
                background: theme.color.bg,
                color: theme.color.ink,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
            >
              {adminOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
          {adminOpen && (
            <div style={{ display: 'flex', gap: '7px', marginTop: '10px' }}>
              <button onClick={onExportJSON} style={exportBtnStyle}>
                <Download size={13} /> JSON
              </button>
              <button onClick={onExportCSV} style={exportBtnStyle}>
                <Download size={13} /> CSV
              </button>
              <label style={exportBtnStyle}>
                <Upload size={13} /> {t.import}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,.csv,application/json,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImport(f);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 7: Remove the old mid-funnel admin block**

Delete the entire old admin block (the `{isAdmin && ( … )}` starting at ~line 529 and ending ~line 583) — the one containing the full-width `onAdd` button and the JSON/CSV/Import row that currently sits between the Innen/Aussen filter and the sort tabs. Its Add and Export/Import functionality now lives in the new band from Step 6.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run test -- src/features/sidebar/Sidebar.test.tsx`
Expected: PASS — all new Verwaltung tests, the updated "hides admin tools when not admin", and every pre-existing test in the file are green.

- [ ] **Step 9: Full verification**

Run: `npm run test` then `npm run lint`
Expected: entire suite passes; lint reports no errors (no unused imports — verify `ChevronDown` is used and nothing from the removed block is now dangling).

- [ ] **Step 10: Commit**

```bash
git add src/features/sidebar/Sidebar.tsx src/features/sidebar/Sidebar.test.tsx
git commit -m "feat: collapsible Verwaltung admin band in sidebar (#issue)"
```

---

## Notes for the implementer

- The `venues` fixture in the test file has 3 venues, so the header pill reads "3 Schwingkeller" — that's why Task 2's count test asserts `3 ${STR.de.unitTotal}`.
- `getSession` in the test file is a **hoisted** mock (`vi.hoisted`) shared across tests; `mockResolvedValueOnce` queues a one-time admin session for the next mount without disturbing the default non-admin `mockResolvedValue`.
- The admin band is fixed-header content (`flex: 'none'`), so it does not interact with the mobile-sheet / tablet-panel drag logic — none of those tests need changing.
- Keep the visitor funnel contiguous: after Task 3, nothing admin-related sits between the Innen/Aussen filter and the sort tabs.
