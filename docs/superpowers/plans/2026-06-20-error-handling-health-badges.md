# Error Handling + Health Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture all caught exceptions in Sentry, show generic i18n toasts with error codes instead of raw DB messages, and add CI/coverage/deploy/uptime badges to the README.

**Architecture:** A `captureAndFormat(err, fallback)` helper in `src/lib/sentry.ts` centralises both the Sentry call and the toast message formatting. All `api.ts` throws embed the Supabase error code in the message so it survives the `new Error()` boundary. `EditForm` gets an `onError` prop so errors bubble up through the app's existing flash system instead of `window.alert`.

**Tech Stack:** `@sentry/react` (already installed), Vitest, React 19, TypeScript.

## Global Constraints

- No new npm dependencies — `@sentry/react` is already in `package.json`
- All UI strings must exist in DE, FR and IT — never hardcode text
- Use TDD: write the failing test first, then implement
- Run `npx vitest run` (not `npm run test`, vitest may not be on PATH) after each task
- Run `npx eslint .` before each commit
- Push to branch `claude/new-session-bx263n`

---

### Task 1: Sentry helpers — `extractCode` and `captureAndFormat`

**Files:**
- Modify: `src/lib/sentry.ts`
- Create: `src/lib/sentry.test.ts`

**Interfaces:**
- Produces:
  - `extractCode(err: unknown): string | null` — parses `[CODE]` prefix from an Error message; returns the code string or null
  - `captureAndFormat(err: unknown, fallback: string): string` — calls `Sentry.captureException(err)`, returns `"${fallback} [${code}]"` when a code is present, `fallback` otherwise

- [ ] **Step 1: Write the failing tests**

Create `src/lib/sentry.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import * as SentryMod from '@sentry/react';
import { extractCode, captureAndFormat } from './sentry';

beforeEach(() => { vi.clearAllMocks(); });

describe('extractCode', () => {
  it('extracts the code from a [CODE] prefixed message', () => {
    expect(extractCode(new Error('[42883] function not found'))).toBe('42883');
  });
  it('extracts alphanumeric codes', () => {
    expect(extractCode(new Error('[PGRST202] undefined function'))).toBe('PGRST202');
  });
  it('returns null when no [CODE] prefix', () => {
    expect(extractCode(new Error('plain message'))).toBeNull();
  });
  it('returns null for non-Error values', () => {
    expect(extractCode('a string')).toBeNull();
    expect(extractCode(null)).toBeNull();
  });
});

describe('captureAndFormat', () => {
  it('calls Sentry.captureException with the error', () => {
    const err = new Error('[42883] boom');
    captureAndFormat(err, 'Import fehlgeschlagen');
    expect(SentryMod.captureException).toHaveBeenCalledWith(err);
  });
  it('returns fallback with code appended when code is present', () => {
    const result = captureAndFormat(new Error('[42883] boom'), 'Import fehlgeschlagen');
    expect(result).toBe('Import fehlgeschlagen [42883]');
  });
  it('returns fallback only when no code in message', () => {
    const result = captureAndFormat(new Error('plain boom'), 'Import fehlgeschlagen');
    expect(result).toBe('Import fehlgeschlagen');
  });
  it('handles non-Error values without throwing', () => {
    const result = captureAndFormat('a string', 'Import fehlgeschlagen');
    expect(result).toBe('Import fehlgeschlagen');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/sentry.test.ts
```

Expected: FAIL — `extractCode is not a function` (or similar, functions don't exist yet).

- [ ] **Step 3: Implement the helpers**

Replace the entire content of `src/lib/sentry.ts` with:

```ts
import * as Sentry from '@sentry/react';

export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
};

export const extractCode = (err: unknown): string | null => {
  if (!(err instanceof Error)) return null;
  const m = err.message.match(/^\[(\w+)\]/);
  return m ? m[1] : null;
};

export const captureAndFormat = (err: unknown, fallback: string): string => {
  Sentry.captureException(err);
  const code = extractCode(err);
  return code ? `${fallback} [${code}]` : fallback;
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/sentry.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/lib/sentry.ts src/lib/sentry.test.ts
git add src/lib/sentry.ts src/lib/sentry.test.ts
git commit -m "feat: add extractCode and captureAndFormat Sentry helpers"
```

---

### Task 2: Embed error codes in `api.ts` throws

**Files:**
- Modify: `src/features/venues/api.ts`
- Modify: `src/features/venues/api.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: all errors thrown by api functions now have the format `"[CODE] message"` when a Supabase error code is present, so `extractCode` (from Task 1) can parse them

- [ ] **Step 1: Write the failing test**

Add to `src/features/venues/api.test.ts` — add `rpc` to the hoisted mock if not already present (it was added in the previous critical-fixes commit; if already present, skip the mock changes and only add the test):

The full updated test file (replace entirely):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { order, from, rpc } = vi.hoisted(() => {
  const order = vi.fn();
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn();
  return { order, select, from, rpc };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc } }));

import { listVenues, replaceAllVenues } from './api';
import type { VenueInput } from './types';

beforeEach(() => { vi.clearAllMocks(); });

describe('listVenues', () => {
  it('selects venues ordered by name', async () => {
    order.mockResolvedValue({ data: [{ id: '1', name: 'A' }], error: null });
    const result = await listVenues();
    expect(from).toHaveBeenCalledWith('venues');
    expect(order).toHaveBeenCalledWith('name');
    expect(result).toEqual([{ id: '1', name: 'A' }]);
  });
  it('throws with error code prefix when Supabase returns an error', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'relation not found', code: '42P01' } });
    await expect(listVenues()).rejects.toThrow('[42P01] relation not found');
  });
});

const SAMPLE_VENUE: VenueInput = {
  name: 'Testkeller', canton: 'BE', address: 'Musterweg 1', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photo_url: null,
};

describe('replaceAllVenues', () => {
  it('calls replace_venues RPC with the given rows', async () => {
    rpc.mockResolvedValue({ error: null });
    await replaceAllVenues([SAMPLE_VENUE]);
    expect(rpc).toHaveBeenCalledWith('replace_venues', { rows: [SAMPLE_VENUE] });
  });
  it('works with an empty list', async () => {
    rpc.mockResolvedValue({ error: null });
    await replaceAllVenues([]);
    expect(rpc).toHaveBeenCalledWith('replace_venues', { rows: [] });
  });
  it('throws with error code prefix on RPC error', async () => {
    rpc.mockResolvedValue({ error: { message: 'function does not exist', code: '42883' } });
    await expect(replaceAllVenues([SAMPLE_VENUE])).rejects.toThrow('[42883] function does not exist');
  });
});
```

- [ ] **Step 2: Run tests to verify the new assertions fail**

```bash
npx vitest run src/features/venues/api.test.ts
```

Expected: the two `'throws with error code prefix'` tests FAIL — current throws say `'relation not found'` and `'rpc boom'` without the `[CODE]` prefix.

- [ ] **Step 3: Update `api.ts` throws to include the error code**

Replace all error throws in `src/features/venues/api.ts`. The file becomes:

```ts
import { supabase } from '../../lib/supabase';
import type { Venue, VenueInput } from './types';

const toError = (e: { message: string; code?: string }): Error =>
  new Error(e.code ? `[${e.code}] ${e.message}` : e.message);

export const listVenues = async (): Promise<Venue[]> => {
  const { data, error } = await supabase.from('venues').select('*').order('name');
  if (error) throw toError(error);
  return (data ?? []) as Venue[];
};

export const createVenue = async (input: VenueInput): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').insert(input).select().single();
  if (error) throw toError(error);
  return data as Venue;
};

export const updateVenue = async (id: string, input: Partial<VenueInput>): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').update(input).eq('id', id).select().single();
  if (error) throw toError(error);
  return data as Venue;
};

export const removeVenue = async (id: string): Promise<void> => {
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) throw toError(error);
};

export const replaceAllVenues = async (venues: VenueInput[]): Promise<void> => {
  const { error } = await supabase.rpc('replace_venues', { rows: venues });
  if (error) throw toError(error);
};

export const uploadPhoto = async (file: File): Promise<string> => {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('venue-photos').upload(path, file, { upsert: false });
  if (error) throw toError(error);
  const { data } = supabase.storage.from('venue-photos').getPublicUrl(path);
  return data.publicUrl;
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/venues/api.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/features/venues/api.ts src/features/venues/api.test.ts
git add src/features/venues/api.ts src/features/venues/api.test.ts
git commit -m "feat: embed Supabase error codes in api.ts throws"
```

---

### Task 3: Wire `captureAndFormat` into `App.tsx` import errors

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `captureAndFormat(err, fallback)` from `src/lib/sentry.ts` (Task 1); `t.importFailed` (existing i18n key)
- Produces: import errors are now captured in Sentry; toast shows `"Import fehlgeschlagen [42883]"` instead of the raw DB message

Note: `t.importFailed` already exists in all three languages (`"Import fehlgeschlagen"` / `"Échec de l'import"` / `"Importazione non riuscita"`). No new i18n keys are needed for this task.

- [ ] **Step 1: Add the import and update the two error sites in `App.tsx`**

Add this import near the top of `src/App.tsx` (after the existing imports):

```ts
import { captureAndFormat } from './lib/sentry';
```

Find line ~207 (parse error in the file-read callback):
```ts
// BEFORE:
showFlash('err', t.importFailed + ': ' + (err instanceof Error ? err.message : String(err)));
// AFTER:
showFlash('err', captureAndFormat(err, t.importFailed));
```

Find line ~225 (RPC error in `runImport`):
```ts
// BEFORE:
showFlash('err', t.importFailed + ': ' + (err instanceof Error ? err.message : String(err)));
// AFTER:
showFlash('err', captureAndFormat(err, t.importFailed));
```

- [ ] **Step 2: Run the full test suite**

```bash
npx vitest run
```

Expected: all 42+ tests pass (App.tsx has no direct unit tests; this is validated by the suite staying green).

- [ ] **Step 3: Lint and commit**

```bash
npx eslint src/App.tsx
git add src/App.tsx
git commit -m "feat: capture import errors in Sentry with generic toast"
```

---

### Task 4: Add `onError` prop to `EditForm` + new i18n keys

**Files:**
- Modify: `src/features/venue-edit/EditForm.tsx`
- Modify: `src/i18n/translations.ts`
- Modify: `src/App.tsx` (add `onError` prop to `<EditForm />`)
- Modify: `src/features/venue-edit/EditForm.test.tsx` (pass mock `onError`)
- Modify: `src/i18n/translations.test.ts` (already tests key parity — will catch missing keys automatically)

**Interfaces:**
- Consumes: `captureAndFormat` from `src/lib/sentry.ts` (Task 1); `t.saveError`, `t.uploadError` (new i18n keys added here)
- Produces: `EditFormProps.onError?: (msg: string) => void` — called with a formatted, Sentry-captured message on save or upload failure; `App.tsx` passes `(msg) => showFlash('err', msg)`

- [ ] **Step 1: Add `saveError` and `uploadError` to all three languages in `translations.ts`**

In `src/i18n/translations.ts`, add to the `de` block (after `importFailed`):

```ts
saveError: 'Speichern fehlgeschlagen',
uploadError: 'Foto-Upload fehlgeschlagen',
```

Add to the `fr` block (after `importFailed`):

```ts
saveError: 'Échec de l\'enregistrement',
uploadError: 'Échec du téléchargement de la photo',
```

Add to the `it` block (after `importFailed`):

```ts
saveError: 'Salvataggio fallito',
uploadError: 'Caricamento foto fallito',
```

- [ ] **Step 2: Run translations test to verify parity**

```bash
npx vitest run src/i18n/translations.test.ts
```

Expected: PASS — the parity test checks all languages share the same keys, so all three must be added for this to pass.

- [ ] **Step 3: Write the failing `EditForm` test**

The `onError` call-path (catch → `captureAndFormat` → `onError`) is unit-tested in `sentry.test.ts` (Task 1). Here we write a minimal prop-acceptance test that will fail to compile until the prop is added to `EditFormProps`.

Append to `src/features/venue-edit/EditForm.test.tsx`:

```ts
describe('EditForm onError prop', () => {
  it('accepts an onError callback without invoking it on a clean render', () => {
    const onError = vi.fn();
    render(
      <EditForm
        initial={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onStartPlacing={vi.fn()}
        pickedCoords={null}
        onError={onError}
      />
    );
    expect(onError).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test to verify it fails (prop doesn't exist yet)**

```bash
npx vitest run src/features/venue-edit/EditForm.test.tsx
```

Expected: TypeScript/compile error — `onError` is not a known prop on `EditFormProps`.

- [ ] **Step 5: Update `EditFormProps` and replace `alert()` calls in `EditForm.tsx`**

In `src/features/venue-edit/EditForm.tsx`:

1. Add import at top:
```ts
import { captureAndFormat } from '../../lib/sentry';
```

2. Add `onError` to the interface:
```ts
interface EditFormProps {
  initial: Venue | null;
  onClose: () => void;
  onSaved: (v: Venue, andNew: boolean) => void;
  onStartPlacing: () => void;
  pickedCoords: { lat: number; lng: number } | null;
  onError?: (msg: string) => void;
}
```

3. Destructure it in the component signature:
```ts
export const EditForm = ({ initial, onClose, onSaved, onStartPlacing, pickedCoords, onError }: EditFormProps) => {
```

4. In `onUpload` (the photo upload catch block, currently line ~122–124), replace the `alert(...)`:
```ts
// BEFORE:
alert('Upload fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err)));
// AFTER:
onError?.(captureAndFormat(err, t.uploadError));
```

5. In `save` (the save catch block, currently line ~152–154), replace the `alert(...)`:
```ts
// BEFORE:
alert('Speichern fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err)));
// AFTER:
onError?.(captureAndFormat(err, t.saveError));
```

- [ ] **Step 6: Pass `onError` from `App.tsx` to `<EditForm />`**

In `src/App.tsx`, find the `<EditForm` JSX block (around line 295) and add the prop:

```tsx
<EditForm
  key={editSession}
  initial={editInitial}
  onClose={closeEdit}
  onSaved={onSaved}
  onStartPlacing={startPlacing}
  pickedCoords={pickedCoords}
  onError={(msg) => showFlash('err', msg)}
/>
```

- [ ] **Step 7: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass. The translations parity test catches missing keys; the `EditForm` prop test passes; all existing tests still pass.

- [ ] **Step 8: Lint and commit**

```bash
npx eslint src/features/venue-edit/EditForm.tsx src/i18n/translations.ts src/App.tsx src/features/venue-edit/EditForm.test.tsx
git add src/features/venue-edit/EditForm.tsx src/i18n/translations.ts src/App.tsx src/features/venue-edit/EditForm.test.tsx
git commit -m "feat: replace window.alert with Sentry capture + onError toast in EditForm"
```

---

### Task 5: README health badges

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: four badge images below the README title; CI and Codecov badges are live immediately after commit; Netlify and UptimeRobot badges require the developer to fill in two values manually before committing

**Pre-conditions (manual, do before this task):**

1. **Netlify badge:** In the Netlify dashboard → Sites → your site → Site settings → General → scroll to "Status badges" → copy the badge URL. It looks like `https://api.netlify.com/api/v1/badges/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX/deploy-status`.

2. **UptimeRobot badge:** Create a free account at uptimerobot.com → Add New Monitor → HTTP(s) → URL = your production Netlify URL → interval 5 min → Save. Then open the monitor → click "Get Shareable Link" or find the badge URL. It has the format `https://badgen.net/uptime-robot/status/mXXXXXXXXX`.

- [ ] **Step 1: Add badges to `README.md`**

Insert the following four lines immediately after the `# Schwingkeller Schweiz` title and before the description paragraph (i.e. after line 1, before line 3):

```markdown
[![CI](https://github.com/hoferan/schwingkeller/actions/workflows/ci.yml/badge.svg)](https://github.com/hoferan/schwingkeller/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/hoferan/schwingkeller/branch/main/graph/badge.svg)](https://codecov.io/gh/hoferan/schwingkeller)
[![Netlify Status](https://api.netlify.com/api/v1/badges/FILL_IN_NETLIFY_SITE_ID/deploy-status)](https://app.netlify.com/sites/FILL_IN_SITE_NAME/deploys)
[![Uptime](https://badgen.net/uptime-robot/status/FILL_IN_MONITOR_ID)](https://uptimerobot.com)

```

Replace `FILL_IN_NETLIFY_SITE_ID`, `FILL_IN_SITE_NAME`, and `FILL_IN_MONITOR_ID` with the values from the pre-conditions above before committing.

- [ ] **Step 2: Verify the badges render**

Open `README.md` in a Markdown preview (GitHub preview, VS Code, or similar) and confirm all four badges show as images (CI and Codecov may show "unknown" until the first CI run on main; Netlify and UptimeRobot badges show live status once filled in).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add CI, coverage, deploy and uptime badges to README"
```

---

### Task 6: Push and verify

- [ ] **Step 1: Run the full suite one final time**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin claude/new-session-bx263n
```

- [ ] **Step 3: Verify on GitHub**

Open the Actions tab on GitHub and confirm the CI workflow is green for the pushed branch. The CI badge in the README will reflect `main` status once the branch is merged.
