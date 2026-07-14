# Browser-Language Auto-Detect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a first visit with no stored language preference, initialize the UI language from the browser's preferred languages (mapping to `de`/`fr`/`it`, falling back to `de`) and persist it immediately.

**Architecture:** Add a pure `detectLang()` helper to the existing i18n module that walks `navigator.languages`, then rewrite `loadLang()` to validate a stored value or fall back to `detectLang()` + persist-on-detect. All change is localized to `src/i18n/useTranslation.ts`; `App.tsx` and the switcher are untouched.

**Tech Stack:** TypeScript, React 19, Vitest + jsdom (`environment: 'jsdom'`, setup file `vitest.setup.ts`).

## Global Constraints

- Supported languages are exactly `LANGS = ['de', 'fr', 'it']` (from `src/i18n/translations.ts`); default/fallback is `'de'`.
- No new npm dependencies.
- No `any` — use proper types or `unknown`.
- No i18n string (DE/FR/IT) changes, no Supabase/RLS surface, no UI changes.
- Run `npm run test` and `npm run lint` before claiming the work complete.
- Commit with Conventional Commits messages on branch `feat/16-browser-language-autodetect`.
- Test command: `npm run test` (Vitest, jsdom). `navigator` and `localStorage` exist in jsdom.

---

### Task 1: `detectLang()` pure helper

**Files:**
- Modify: `src/i18n/useTranslation.ts` (add new exported function; existing `loadLang`/`saveLang` unchanged in this task)
- Create: `src/i18n/useTranslation.test.ts`

**Interfaces:**
- Consumes: `LANGS`, `type Lang` from `./translations` (already importable; `useTranslation.ts` currently imports only `STR, type Lang` — add `LANGS` to that import).
- Produces: `export const detectLang: () => Lang` — reads `navigator.languages` (falls back to `[navigator.language]`, then `[]`), returns the first entry whose primary subtag (lowercased, split on `-`) is in `LANGS`, else `'de'`. No side effects.

- [ ] **Step 1: Write the failing tests**

Create `src/i18n/useTranslation.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { detectLang } from './useTranslation';

const mockLanguages = (langs: readonly string[] | undefined) => {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(
    langs as unknown as readonly string[],
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('detectLang', () => {
  it('maps a regioned French tag to fr', () => {
    mockLanguages(['fr-CH']);
    expect(detectLang()).toBe('fr');
  });

  it('maps a bare Italian tag to it', () => {
    mockLanguages(['it']);
    expect(detectLang()).toBe('it');
  });

  it('maps a German tag to de', () => {
    mockLanguages(['de-DE']);
    expect(detectLang()).toBe('de');
  });

  it('picks the first supported language in an ordered list', () => {
    mockLanguages(['en-US', 'fr-CH', 'de-CH']);
    expect(detectLang()).toBe('fr');
  });

  it('falls back to de when the only language is unsupported', () => {
    mockLanguages(['en-US']);
    expect(detectLang()).toBe('de');
  });

  it('falls back to de for Romansh', () => {
    mockLanguages(['rm-CH']);
    expect(detectLang()).toBe('de');
  });

  it('falls back to de for an empty list', () => {
    mockLanguages([]);
    expect(detectLang()).toBe('de');
  });

  it('falls back to navigator.language when languages is undefined', () => {
    mockLanguages(undefined);
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('it-IT');
    expect(detectLang()).toBe('it');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/i18n/useTranslation.test.ts`
Expected: FAIL — `detectLang` is not exported / not a function.

- [ ] **Step 3: Write minimal implementation**

In `src/i18n/useTranslation.ts`, change the import line

```ts
import { STR, type Lang } from './translations';
```

to

```ts
import { STR, LANGS, type Lang } from './translations';
```

and add, above `loadLang`:

```ts
export const detectLang = (): Lang => {
  const prefs =
    (typeof navigator !== 'undefined' && (navigator.languages ?? [navigator.language])) || [];
  for (const tag of prefs) {
    const primary = (tag ?? '').toLowerCase().split('-')[0];
    if ((LANGS as readonly string[]).includes(primary)) return primary as Lang;
  }
  return 'de';
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/i18n/useTranslation.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/useTranslation.ts src/i18n/useTranslation.test.ts
git commit -m "feat: add detectLang browser-language helper (#16)"
```

---

### Task 2: Rewrite `loadLang()` — validate stored value or detect + persist

**Files:**
- Modify: `src/i18n/useTranslation.ts:13-15` (the `loadLang` function)
- Modify: `src/i18n/useTranslation.test.ts` (add a `loadLang` describe block)

**Interfaces:**
- Consumes: `detectLang` (Task 1), `saveLang` (existing), `LANGS`, `type Lang`.
- Produces: `export const loadLang: () => Lang` — returns a validated stored `schwing_lang` if one of `LANGS`; otherwise returns `detectLang()` **and** writes it via `saveLang` (persist-on-detect); returns `'de'` on any thrown error.

- [ ] **Step 1: Write the failing tests**

Append to `src/i18n/useTranslation.test.ts`:

```ts
import { loadLang } from './useTranslation';

describe('loadLang', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns a valid stored value without detecting', () => {
    localStorage.setItem('schwing_lang', 'fr');
    const langsGet = vi.spyOn(window.navigator, 'languages', 'get');
    expect(loadLang()).toBe('fr');
    expect(langsGet).not.toHaveBeenCalled();
  });

  it('detects and persists when nothing is stored', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['fr-CH']);
    expect(loadLang()).toBe('fr');
    expect(localStorage.getItem('schwing_lang')).toBe('fr');
  });

  it('ignores an invalid stored value and falls through to detection', () => {
    localStorage.setItem('schwing_lang', 'en');
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['it-IT']);
    expect(loadLang()).toBe('it');
    expect(localStorage.getItem('schwing_lang')).toBe('it');
  });

  it('returns de when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadLang()).toBe('de');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/i18n/useTranslation.test.ts`
Expected: FAIL — the "detects and persists" and "ignores an invalid stored value" tests fail because current `loadLang` returns `'de'`/casts the invalid value through and never writes.

- [ ] **Step 3: Write the implementation**

Replace the current `loadLang` (`src/i18n/useTranslation.ts:13-15`):

```ts
export const loadLang = (): Lang => {
  try { return (localStorage.getItem('schwing_lang') as Lang) || 'de'; } catch { return 'de'; }
};
```

with:

```ts
export const loadLang = (): Lang => {
  try {
    const stored = localStorage.getItem('schwing_lang');
    if (stored && (LANGS as readonly string[]).includes(stored)) return stored as Lang;
    const detected = detectLang();
    saveLang(detected);
    return detected;
  } catch {
    return 'de';
  }
};
```

Note: `saveLang` is declared below `loadLang` in the file. It is a `const` arrow function, so it must be defined before `loadLang` is *called* (at runtime, in `App`'s `useState` initializer), not before `loadLang` is declared. No reordering is required. If lint/TS flags use-before-define, move `detectLang` and keep `saveLang` where it is — a runtime call is fine.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/i18n/useTranslation.test.ts`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 5: Full verification**

Run: `npm run test`
Expected: PASS (whole suite).
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/useTranslation.ts src/i18n/useTranslation.test.ts
git commit -m "feat: auto-detect UI language from browser on first visit (#16)"
```

---

## Self-Review

**Spec coverage:**
- `detectLang()` walking `navigator.languages` with prefix match + `de` fallback → Task 1. ✓
- Non-browser/empty guard → Task 1 (`typeof navigator`, `?? [navigator.language]`, `|| []`). ✓
- Persist-on-detect → Task 2 (`saveLang(detected)`). ✓
- Stored-value validation against `LANGS` → Task 2. ✓
- localStorage-throws → `de` → Task 2. ✓
- All spec `detectLang` test-table rows are covered by Task 1 tests; all `loadLang` rows by Task 2 tests. ✓
- No i18n string / dependency / Supabase changes → respected (only `useTranslation.ts` + its test touched). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `detectLang: () => Lang` and `loadLang: () => Lang` used identically across tasks; `LANGS as readonly string[]` guard used consistently in both `detectLang` and `loadLang`. ✓
