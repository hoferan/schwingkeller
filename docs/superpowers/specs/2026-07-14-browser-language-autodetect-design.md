# Browser-language auto-detect on first visit — Design

**Issue:** #16 — Browser-language auto-detect on first visit
**Date:** 2026-07-14
**Status:** Approved (pending implementation)

## Problem

`loadLang()` ([`src/i18n/useTranslation.ts`](../../../src/i18n/useTranslation.ts)) always defaults to
`'de'` when no stored preference exists, even for a French- or Italian-speaking visitor's first
visit. First-time French/Italian speakers see German until they find the switcher.

## Goal

On a first visit (no `schwing_lang` in `localStorage`), initialize the UI language from the
browser's preferred languages, mapping to `'de'` / `'fr'` / `'it'` and falling back to `'de'` for
anything else. Persist the detected value immediately so it is never re-detected on later visits.

## Decisions

- **Persistence:** persist-on-detect. The first visit detects a language and writes it to
  `localStorage` immediately. From then on the value is locked — a later browser-language change
  does **not** re-detect. Matches the issue wording ("auto-detect runs once, it's persisted and
  never re-detected") and makes behavior deterministic and testable.
- **Detection source:** walk the ordered `navigator.languages` list and pick the first entry whose
  primary subtag matches a supported language. Best for multilingual Swiss setups
  (`['en-US','fr-CH','de-CH']` → `'fr'`).
- **No new dependency:** the logic is ~5 lines and any package would still return raw BCP-47 tags
  requiring our own mapping/fallback. Implemented in-house as a pure, unit-testable function.
  (Per CLAUDE.md: no new npm deps without discussion.)

## Approach

All change is localized to the i18n module ([`src/i18n/useTranslation.ts`](../../../src/i18n/useTranslation.ts)).
`App.tsx`, `setLang`, `saveLang`, and the language switcher are unchanged.

### New pure function: `detectLang(): Lang`

- Read the browser preference list: `navigator.languages`, falling back to
  `[navigator.language]`, then `[]` when neither exists (guards non-browser / test environments).
- For each entry in order, take the primary subtag — lowercase, split on `-` (so `fr-CH` → `fr`) —
  and return the first that is one of the supported `LANGS` (`de` / `fr` / `it`).
- Return `'de'` if nothing matches. Romansh (`rm`), English, etc. all fall through to `'de'`,
  preserving today's default.

### Rewritten `loadLang(): Lang`

```ts
export const loadLang = (): Lang => {
  try {
    const stored = localStorage.getItem('schwing_lang');
    if (stored && (LANGS as readonly string[]).includes(stored)) return stored as Lang;
    const detected = detectLang();     // walk navigator.languages
    saveLang(detected);                // persist-on-detect → locked, never re-detected
    return detected;
  } catch {
    return 'de';
  }
};
```

Two behavior changes beyond detection:

1. An auto-detected value is persisted immediately (persist-on-detect).
2. A stored value is now **validated** against `LANGS` before use. Today a stale/invalid
   `schwing_lang` (e.g. `'en'`) would be cast through uncasted; now it falls through to detection.

`saveLang` is idempotent, so running `loadLang()` twice (e.g. React StrictMode double-invoke of the
`useState` initializer) is safe.

## Data flow

Unchanged. `App` calls `loadLang()` in its `useState` initializer
([`src/App.tsx:481`](../../../src/App.tsx#L481)); the switcher still calls `setLang`, which calls
`saveLang`.

## Error handling

- The existing `try/catch` in `loadLang` covers `localStorage` access failures (private-mode
  restrictions, etc.) → returns `'de'`.
- `detectLang` guards missing `navigator` / `navigator.languages` by falling back to an empty list
  and then `'de'`.
- No new failure modes introduced.

## Testing (TDD, Vitest)

Write failing tests first, then implement.

**`detectLang()`** — mock `navigator.languages`:

| Input                              | Expected |
| ---------------------------------- | -------- |
| `['fr-CH']`                        | `'fr'`   |
| `['it']`                           | `'it'`   |
| `['de-DE']`                        | `'de'`   |
| `['en-US','fr-CH','de-CH']`        | `'fr'`   |
| `['en-US']`                        | `'de'`   |
| `['rm-CH']`                        | `'de'`   |
| `[]` / `undefined`                 | `'de'`   |

**`loadLang()`** — mock `localStorage`:

- Stored `'fr'` → returns `'fr'`, no detection, no extra write.
- Empty store + browser `['fr-CH']` → returns `'fr'` **and** writes `schwing_lang='fr'`.
- Invalid stored `'en'` → ignored, falls through to detection.
- `localStorage.getItem` throwing → returns `'de'`.

## Out of scope

- No i18n string (DE/FR/IT) changes.
- No new npm dependency.
- No Supabase / RLS surface.
- No UI changes to the language switcher.
