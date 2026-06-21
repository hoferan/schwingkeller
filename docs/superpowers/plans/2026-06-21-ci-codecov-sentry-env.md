# CI / Codecov / Sentry Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken Supabase migration command, wire up Codecov test results and bundle analysis, fix Sentry environment tagging across Netlify contexts, and document the PR title convention.

**Architecture:** All changes are configuration-level — CI YAML, Vite config, Netlify deploy config, and one runtime init call. No new abstractions, no schema changes. The Sentry environment value is baked in at Netlify build time via `VITE_APP_ENV` and read at runtime by `initSentry`.

**Tech Stack:** GitHub Actions, Supabase CLI, Vitest 4, Codecov (`@codecov/vite-plugin`, `codecov/test-results-action@v1`), Vite, Sentry React SDK, Netlify.

## Global Constraints

- Do not add new GitHub secrets — use only the ones already present (`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`, `CODECOV_TOKEN`, `VITE_SUPABASE_URL`, etc.)
- No new npm runtime dependencies — only devDependencies
- Keep `any` out of TypeScript — use proper types
- Run `npm run test` and `npm run lint` before each commit
- Branch: `claude/new-session-oay3cf`

---

### Task 1: Fix Supabase migration command

**Files:**
- Modify: `.github/workflows/ci.yml:44`

**Interfaces:**
- Produces: working `migrate` job in CI

- [ ] **Step 1: Replace the broken command**

Open `.github/workflows/ci.yml`. The `migrate` job currently has a single step:

```yaml
      - run: supabase db push --project-ref ${{ secrets.SUPABASE_PROJECT_REF }} --password ${{ secrets.SUPABASE_DB_PASSWORD }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

Replace it with two sequential steps:

```yaml
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      - run: supabase db push --password ${{ secrets.SUPABASE_DB_PASSWORD }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

- [ ] **Step 2: Verify YAML syntax**

```bash
npm run lint
```

Expected: exits 0 (ESLint won't check YAML, but confirms no other lint regressions).

Optionally validate the YAML itself:

```bash
python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "fix: split supabase link + db push to fix unrecognized flag error"
```

---

### Task 2: Add Codecov test results upload

**Files:**
- Modify: `.github/workflows/ci.yml` (inside `build-test` job, after the `Upload coverage to Codecov` step)

**Interfaces:**
- Consumes: `CODECOV_TOKEN` secret (already present)
- Produces: JUnit XML artefact + Codecov test results report on every CI run

- [ ] **Step 1: Add the two steps to `ci.yml`**

After this existing block (lines 20-25):

```yaml
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          fail_ci_if_error: false
```

Insert:

```yaml
      - run: npx vitest run --reporter=junit --outputFile=test-report.junit.xml
      - name: Upload test results to Codecov
        if: ${{ !cancelled() }}
        uses: codecov/test-results-action@v1
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
```

- [ ] **Step 2: Verify the XML is produced locally**

```bash
npx vitest run --reporter=junit --outputFile=test-report.junit.xml
```

Expected: exits 0, file `test-report.junit.xml` exists in the project root.

```bash
head -5 test-report.junit.xml
```

Expected: starts with `<?xml` and contains `<testsuites`.

- [ ] **Step 3: Clean up artefact and commit**

```bash
rm test-report.junit.xml
git add .github/workflows/ci.yml
git commit -m "feat: upload vitest JUnit results to Codecov"
```

---

### Task 3: Add Codecov vite bundle plugin

**Files:**
- Modify: `vite.config.ts`
- Modify: `.github/workflows/ci.yml` (add `CODECOV_TOKEN` to build step env)
- Side-effect: `package.json` + `package-lock.json` (npm install)

**Interfaces:**
- Consumes: `process.env.CODECOV_TOKEN` at build time
- Produces: bundle analysis uploaded to Codecov on every CI build

- [ ] **Step 1: Install the plugin**

```bash
npm install @codecov/vite-plugin --save-dev
```

Expected: package added to `devDependencies` in `package.json`.

- [ ] **Step 2: Add the plugin to `vite.config.ts`**

Current `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
          }),
        ]
      : []),
  ],
  ...
});
```

Replace the imports and plugins section so the full file reads:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { codecovVitePlugin } from '@codecov/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
          }),
        ]
      : []),
    ...(process.env.CODECOV_TOKEN
      ? [
          codecovVitePlugin({
            enableBundleAnalysis: true,
            bundleName: 'schwingkeller',
            uploadToken: process.env.CODECOV_TOKEN,
          }),
        ]
      : []),
  ],
  build: {
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx'],
    },
  },
});
```

- [ ] **Step 3: Expose `CODECOV_TOKEN` in the CI build step**

In `.github/workflows/ci.yml`, the `build` step env block currently ends at `SENTRY_PROJECT`. Add `CODECOV_TOKEN`:

```yaml
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
          CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

- [ ] **Step 4: Verify build and lint pass**

```bash
npm run lint && npm run test
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts package.json package-lock.json .github/workflows/ci.yml
git commit -m "feat: add Codecov vite bundle analysis plugin"
```

---

### Task 4: Fix Sentry environment

**Files:**
- Modify: `src/lib/sentry.test.ts` (write tests first)
- Modify: `src/lib/sentry.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `netlify.toml`
- Modify: `.env.example`

**Interfaces:**
- Produces: `initSentry()` passes `environment` string to `Sentry.init`; value is `'development'` when `VITE_APP_ENV` is unset, otherwise the value of `VITE_APP_ENV`

- [ ] **Step 1: Write failing tests in `src/lib/sentry.test.ts`**

The current mock only includes `captureException`. Update the mock to include `init`, import `initSentry`, and add an `afterEach` to clear env stubs. Full updated file:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@sentry/react', () => ({ init: vi.fn(), captureException: vi.fn() }));

import * as SentryMod from '@sentry/react';
import { extractCode, captureAndFormat, initSentry } from './sentry';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('initSentry', () => {
  it('does not call init when DSN is missing', () => {
    initSentry();
    expect(SentryMod.init).not.toHaveBeenCalled();
  });

  it('passes VITE_APP_ENV as environment when set', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/1');
    vi.stubEnv('VITE_APP_ENV', 'stage');
    initSentry();
    expect(SentryMod.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'stage' }),
    );
  });

  it('defaults environment to "development" when VITE_APP_ENV is unset', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/1');
    initSentry();
    expect(SentryMod.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'development' }),
    );
  });
});

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

- [ ] **Step 2: Run tests to confirm the new ones fail**

```bash
npm run test -- src/lib/sentry.test.ts
```

Expected: the two `initSentry` environment tests FAIL because `environment` is not yet passed to `Sentry.init`. The "does not call init when DSN is missing" test will PASS — that is fine.

- [ ] **Step 3: Update `src/lib/sentry.ts`**

Replace the file content:

```ts
import * as Sentry from '@sentry/react';

export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
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

- [ ] **Step 4: Declare `VITE_APP_ENV` in `src/vite-env.d.ts`**

Add `readonly VITE_APP_ENV?: string;` to the `ImportMetaEnv` interface:

```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APP_ENV?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
```

- [ ] **Step 5: Run tests to confirm all pass**

```bash
npm run test -- src/lib/sentry.test.ts
```

Expected: all tests PASS including the 3 new `initSentry` tests.

- [ ] **Step 6: Update `netlify.toml`**

Append context environment blocks after the existing `[build.environment]` block:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[context.production.environment]
  VITE_APP_ENV = "production"

[context.deploy-preview.environment]
  VITE_APP_ENV = "stage"

[context.branch-deploy.environment]
  VITE_APP_ENV = "stage"

# SPA fallback
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 7: Document in `.env.example`**

Add `VITE_APP_ENV=` after the Sentry DSN line so developers know the variable exists:

```
# Supabase — use the NEW publishable key (sb_publishable_...) in the cloud.
# For local dev, use the key printed by `supabase start`.
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx

# Sentry (browser-safe DSN)
VITE_SENTRY_DSN=

# App environment — set by Netlify context at build time; leave empty for local dev (defaults to "development")
VITE_APP_ENV=
```

- [ ] **Step 8: Run full test and lint suite**

```bash
npm run lint && npm run test
```

Expected: both exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/lib/sentry.ts src/lib/sentry.test.ts src/vite-env.d.ts netlify.toml .env.example
git commit -m "fix: tag Sentry events with correct environment per Netlify context"
```

---

### Task 5: Document PR title convention in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces: documented convention visible to Claude Code and human contributors

- [ ] **Step 1: Add one line to the Dos section of `CLAUDE.md`**

Locate the `## Dos` section. It currently ends with:

```
- Commit on a feature branch; push to `claude/new-session-eeiygh` for this session
```

Add the new line before that line (keep session-specific line last):

```
- Use Conventional Commits format for PR titles (e.g. `feat: add Codecov integration`, `fix: supabase db push flag`) — matching the existing commit history
- Commit on a feature branch; push to `claude/new-session-eeiygh` for this session
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Conventional Commits PR title convention to CLAUDE.md"
```

---

### Final: Push branch

- [ ] **Push all commits**

```bash
git push -u origin claude/new-session-oay3cf
```

Expected: all 5 commits pushed, CI triggers on the branch.
