# Design: Error Handling + Health Badges

**Date:** 2026-06-20
**Status:** Approved

## Problem

1. **Silent errors in Sentry:** Caught exceptions (DB failures, photo upload errors) are shown as toasts but never reported to Sentry, because Sentry's default integration only captures unhandled exceptions. Operational issues go unnoticed until a user reports them.

2. **Raw DB messages exposed to users:** Error toasts currently include the raw Supabase/PostgreSQL error message (e.g. `"function replace_venues does not exist"`). This is too technical and leaks internal details.

3. **No health visibility in README:** There are no status badges indicating the health of CI, coverage, deploy, or uptime.

## Scope

Two independent changes:

- **A) Sentry error capture** — add `Sentry.captureException()` to catch blocks and clean up toast messages
- **B) README badges** — add CI, coverage, deploy, and uptime badges

---

## A) Sentry Error Capture

### Behaviour

Every `catch` block that calls `showFlash('err', ...)` or `window.alert()` must:

1. Call `Sentry.captureException(err)` — Sentry gets full stack trace, user session, and frequency data
2. Show a generic i18n toast — user sees a clean message without internal details
3. Include the error code if available — e.g. `[42883]` from the PostgreSQL error code — so the admin can correlate the toast with the Sentry event

**Error code extraction:** Supabase client errors expose a `code` field on the error object returned by the query (e.g. PostgreSQL code `42883`). Currently `api.ts` does `throw new Error(error.message)`, which loses the code. The fix: change all throws in `api.ts` to `throw new Error(\`[\${error.code}] \${error.message}\`)` so the code travels with the error. Then `extractCode(err: unknown): string | null` extracts it via regex `/^\[(\w+)\]/` from the message string.

### Affected Locations

| File | Line | Current behaviour | After |
|------|------|-------------------|-------|
| `src/App.tsx` | 224–225 | `showFlash('err', t.importFailed + ': ' + rawMessage)` | `captureException` + generic toast with code |
| `src/features/venue-edit/EditForm.tsx` | 138 | `window.alert(rawMessage)` | `captureException` + `showFlash` via `onError` prop |
| `src/features/venue-edit/EditForm.tsx` | 160 | `window.alert(rawMessage)` | `captureException` + `showFlash` via `onError` prop |

The `EditForm` currently has no access to the app's flash system — it uses `window.alert()`. This change adds an `onError?: (msg: string) => void` prop to `EditFormProps` and calls it instead. `App.tsx` passes a closure that calls `showFlash('err', msg)`.

### New i18n Keys

One new key added to all three languages (DE/FR/IT):

| Key | DE | FR | IT |
|-----|----|----|-----|
| `importError` | `Import fehlgeschlagen` | `Échec de l'import` | `Importazione fallita` |
| `saveError` | `Speichern fehlgeschlagen` | `Échec de l'enregistrement` | `Salvataggio fallito` |
| `uploadError` | `Foto-Upload fehlgeschlagen` | `Échec du téléchargement` | `Caricamento foto fallito` |

Toast format: `"{key} [{code}]"` when a code is available, `"{key}"` otherwise.

### Sentry Helper

A small utility in `src/lib/sentry.ts` (existing file, extend it):

```ts
// Extracts a short error code for display in toasts (e.g. PostgreSQL code "42883").
export const extractCode = (err: unknown): string | null => { ... }

// Captures an exception in Sentry and returns a display-safe message.
export const captureAndFormat = (err: unknown, fallback: string): string => { ... }
```

`captureAndFormat` calls `Sentry.captureException(err)` and returns `"{fallback} [{code}]"` or `"{fallback}"`.

### Testing

- Unit tests for `extractCode` (code present, code absent, non-Error input)
- Unit test for `captureAndFormat` (mocks `Sentry.captureException`, verifies return format)
- Update `EditForm` tests to pass a mock `onError` prop

### No new dependencies

`@sentry/react` is already installed.

---

## B) README Badges

Four badges added near the top of `README.md`, below the title:

```markdown
[![CI](https://github.com/hoferan/schwingkeller/actions/workflows/ci.yml/badge.svg)](https://github.com/hoferan/schwingkeller/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/hoferan/schwingkeller/branch/main/graph/badge.svg)](https://codecov.io/gh/hoferan/schwingkeller)
[![Netlify Status](https://api.netlify.com/api/v1/badges/<site-id>/deploy-status)](https://app.netlify.com/sites/<site-name>/deploys)
[![Uptime](https://badgen.net/uptime-robot/status/<monitor-id>)](https://uptimerobot.com)
```

### Badge Sources

| Badge | Source | Setup |
|-------|--------|-------|
| CI | GitHub Actions (auto) | Zero setup — badge URL uses repo path |
| Coverage | Codecov (auto) | Already wired in CI — badge URL uses repo path |
| Netlify | Netlify dashboard | Copy from Site settings → General → Status badge |
| Uptime | UptimeRobot free tier | Create account, add HTTP monitor for the Netlify URL, copy badge URL |

### UptimeRobot Setup (manual, one-time)

1. Create account at uptimerobot.com
2. Add monitor: HTTP(s), URL = production Netlify URL, interval = 5 min
3. Copy the badge URL from monitor settings (format: `https://badgen.net/uptime-robot/status/<monitor-id>`)
4. Paste into `README.md`

The Netlify badge `<site-id>` and `<site-name>` placeholders must be filled in by the developer — they are not committed as placeholders.

---

## Out of Scope

- GitHub Actions migrate job (`supabase db push` on merge) — separate concern, deferred
- Sentry uptime monitoring — UptimeRobot covers this; keeping tools focused
- Custom health-check endpoint — YAGNI for this project size
