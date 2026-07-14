# All-Cantons Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show all 26 Swiss cantons in the sidebar (not just cantons with venues), with a neutral empty-state message for cantons that have no venues yet.

**Architecture:** A new optional `includeEmpty` flag on the existing `groupByCanton` pure function produces the full 26-canton list on demand. The Sidebar passes `includeEmpty = !searching` so the full list shows when idle but empty cantons stay hidden during search. A new i18n string (`cantonEmpty`) renders inside an expanded empty canton.

**Tech Stack:** TypeScript, React 19, Vitest. No new dependencies.

## Global Constraints

- Keep i18n keys in sync across DE/FR/IT — every new key exists in all three (`translations.test.ts` enforces this).
- No `any` in TypeScript — use proper types or `unknown`.
- Swiss orthography in German copy (`ss`, never `ß`).
- Do not hardcode locale text in components — always go through the `t` i18n layer.
- Conventional Commits format for commit messages.
- Work stays on the `claude/new-session-eeiygh` branch (already checked out); never commit to `main`.
- Test runner: `npx vitest run <file>` for a single file; `npm run test` for the full suite.

---

### Task 1: `groupByCanton` gains an `includeEmpty` flag

**Files:**
- Modify: `src/features/venues/grouping.ts:15-21`
- Test: `src/features/venues/grouping.test.ts:26-32`

**Interfaces:**
- Consumes: `CANTONS` (26 entries, `{ code, name, w }`) from `src/data/cantons.ts`; `Venue` from `./types`; existing `CantonGroup` interface `{ code: string; name: string; count: number; venues: Venue[] }`.
- Produces: `groupByCanton(venues: Venue[], includeEmpty?: boolean): CantonGroup[]`. Default `includeEmpty = false` preserves the current signature for all existing callers. With `true`, returns all 26 cantons in `CANTONS` order; cantons with no venues come back as `{ count: 0, venues: [] }`.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('groupByCanton', ...)` block in `src/features/venues/grouping.test.ts` (after the existing `groups in canton order with counts` test):

```ts
  it('includes all 26 cantons in canton order when includeEmpty is true', () => {
    const g = groupByCanton(venues, true);
    expect(g).toHaveLength(26);
    expect(g.map((x) => x.code)).toEqual([
      'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL',
      'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TG', 'TI', 'VD', 'VS', 'NE', 'GE', 'JU',
    ]);
    const zh = g.find((x) => x.code === 'ZH')!;
    expect(zh.count).toBe(0);
    expect(zh.venues).toEqual([]);
    const lu = g.find((x) => x.code === 'LU')!;
    expect(lu.count).toBe(2);
  });

  it('defaults to only cantons with venues when includeEmpty is omitted', () => {
    expect(groupByCanton(venues).map((x) => x.code)).toEqual(['BE', 'LU']);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/venues/grouping.test.ts`
Expected: FAIL — the `includeEmpty` test fails because `groupByCanton` currently returns only 2 groups (`['BE', 'LU']`), not 26. (The `defaults to...` test may already pass — that's fine; it locks in backward compatibility.)

- [ ] **Step 3: Write minimal implementation**

Replace the body of `groupByCanton` in `src/features/venues/grouping.ts` (lines 15-21):

```ts
export const groupByCanton = (venues: Venue[], includeEmpty = false): CantonGroup[] => {
  const by: Record<string, Venue[]> = {};
  venues.forEach((v) => { (by[v.canton] = by[v.canton] ?? []).push(v); });
  const source = includeEmpty ? CANTONS : CANTONS.filter((c) => by[c.code]);
  return source.map((c) => ({
    code: c.code, name: c.name, count: (by[c.code] ?? []).length, venues: by[c.code] ?? [],
  }));
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/venues/grouping.test.ts`
Expected: PASS — all tests in the file pass, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/grouping.ts src/features/venues/grouping.test.ts
git commit -m "feat: add includeEmpty flag to groupByCanton (#34)"
```

---

### Task 2: Empty-state copy + Sidebar wiring

**Files:**
- Modify: `src/i18n/translations.ts` (add `cantonEmpty` to `de`, `fr`, `it` blocks)
- Modify: `src/features/sidebar/Sidebar.tsx:307` (groups call), `:310` (noResults), `:610-646` (expanded body)
- Test: `src/i18n/translations.test.ts` (existing parity test — no edit needed, used as the red/green gate)

**Interfaces:**
- Consumes: `groupByCanton(list, !searching)` from Task 1; `t.cantonEmpty` (new key); existing `theme.color.muted`, `theme.radius`, and the `searching` / `list` locals already computed in the Sidebar.
- Produces: no new exported interface — this is the final user-facing wiring.

- [ ] **Step 1: Add the new key to German only, to make the parity test fail**

In `src/i18n/translations.ts`, in the `de` block, add after the `shareFailed: 'Teilen fehlgeschlagen',` line (around line 74):

```ts
    cantonEmpty:
      'Für diesen Kanton sind noch keine Schwingkeller erfasst. Neue Einträge können ausschliesslich von Administratoren hinzugefügt werden.',
```

- [ ] **Step 2: Run the translations test to verify it fails**

Run: `npx vitest run src/i18n/translations.test.ts`
Expected: FAIL — `all languages share the same keys` fails because `fr` and `it` are now missing `cantonEmpty`.

- [ ] **Step 3: Add the key to French and Italian**

In the `fr` block, after `shareFailed: 'Échec du partage',` (around line 145):

```ts
    cantonEmpty:
      'Aucun lieu n’est encore répertorié pour ce canton. Les nouvelles entrées ne peuvent être ajoutées que par les administrateurs.',
```

In the `it` block, after `shareFailed: 'Condivisione non riuscita',` (around line 216):

```ts
    cantonEmpty:
      'Per questo cantone non è ancora stata registrata alcuna sede. Le nuove voci possono essere aggiunte esclusivamente dagli amministratori.',
```

Note: use the typographic apostrophe `’` in the French string (matching the existing `l’édition`, `d’import` strings in the file), not a straight `'`.

- [ ] **Step 4: Run the translations test to verify it passes**

Run: `npx vitest run src/i18n/translations.test.ts`
Expected: PASS — key parity restored across all three languages.

- [ ] **Step 5: Wire the full canton list into the Sidebar**

In `src/features/sidebar/Sidebar.tsx`, change the groups computation (line 307) from:

```ts
  const groups = groupByCanton(list);
```

to:

```ts
  const groups = groupByCanton(list, !searching);
```

- [ ] **Step 6: Scope the no-results banner to search**

In `src/features/sidebar/Sidebar.tsx`, change the `noResults` computation (line 310) from:

```ts
  const noResults = list.length === 0;
```

to:

```ts
  const noResults = searching && list.length === 0;
```

This prevents the 26 idle empty-canton groups from rendering beneath a contradictory "no results" banner.

- [ ] **Step 7: Render the empty-state message in expanded empty cantons**

In `src/features/sidebar/Sidebar.tsx`, replace the expanded-body block (lines 610-646, the `{exp && (...)}` block) with a version that branches on whether the group has venues:

```tsx
              {exp && (
                <div style={{ padding: '1px 0 9px' }}>
                  {group.venues.length === 0 ? (
                    <div
                      style={{
                        padding: '10px 12px 14px',
                        color: theme.color.muted,
                        fontSize: '12.5px',
                        lineHeight: 1.5,
                      }}
                    >
                      {t.cantonEmpty}
                    </div>
                  ) : (
                    group.venues.map((v) => {
                      const sel = v.id === selectedId;
                      return (
                        <div key={v.id} onClick={() => onSelect(v.id)} style={rowStyle(sel)}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: theme.color.ink,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {v.name}
                            </div>
                            <div
                              style={{
                                fontSize: '12px',
                                color: theme.color.muted,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {townOf(v.address)}
                            </div>
                          </div>
                          <span style={chevronBadgeStyle(sel)}><ChevronRight size={14} /></span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
```

- [ ] **Step 8: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass with no errors.

- [ ] **Step 9: Verify the full test suite still passes**

Run: `npm run test`
Expected: PASS — all tests green.

- [ ] **Step 10: Manually verify the rendered result**

Run: `npm run dev`, open the app.
Expected:
- With the search box empty, all 26 cantons are listed. Cantons with no venues show a `0` count badge; expanding one shows the empty-state message in the current UI language.
- Typing a search query hides empty cantons — only cantons with matching venues appear.
- Switching language (DE/FR/IT) updates the empty-state message.

- [ ] **Step 11: Commit**

```bash
git add src/i18n/translations.ts src/features/sidebar/Sidebar.tsx
git commit -m "feat: show all 26 cantons in sidebar with empty-state message (#34)"
```

---

## Notes

- No new `Sidebar.test.tsx` — consistent with this repo's convention of not unit-testing the large presentational components (there is no `Sidebar.test.tsx` or `App.test.tsx` today). The Sidebar behavior is covered by the pure-function test in Task 1 plus the manual verification in Task 2, Step 10.
- The total venue count pill (`totalText`) is intentionally unchanged — it counts venues, not cantons.
