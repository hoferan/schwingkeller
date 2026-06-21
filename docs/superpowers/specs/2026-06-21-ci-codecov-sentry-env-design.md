# CI / Codecov / Sentry Environment — Design

Date: 2026-06-21

## Scope

Five targeted changes to CI, build config, and runtime initialisation:

1. Fix Supabase migration command
2. Add Codecov test-results upload
3. Add Codecov bundle-analysis vite plugin
4. Fix Sentry environment tagging across Netlify contexts
5. Document PR title convention in CLAUDE.md

---

## 1. Supabase Migration Fix

**Problem:** `supabase db push --project-ref` flag no longer exists in recent CLI versions.

**Change:** Split the single command in `.github/workflows/ci.yml` into two sequential steps:

```yaml
- run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
- run: supabase db push --password ${{ secrets.SUPABASE_DB_PASSWORD }}
```

`SUPABASE_ACCESS_TOKEN` stays in the `env` block unchanged. No secret changes required.

---

## 2. Codecov Test Results Upload

**Problem:** CI only uploads coverage (lcov); test results (pass/fail per test) are not sent to Codecov.

**Change:** Add two steps to `ci.yml` in the `build-test` job, after the existing coverage upload:

```yaml
- run: npx vitest run --reporter=junit --outputFile=test-report.junit.xml
- name: Upload test results to Codecov
  if: ${{ !cancelled() }}
  uses: codecov/test-results-action@v1
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
```

No new secrets needed (`CODECOV_TOKEN` already exists).

---

## 3. Codecov Vite Plugin

**Problem:** Codecov bundle analysis is not wired up.

**Changes:**

- Install: `npm install @codecov/vite-plugin --save-dev`
- Update `vite.config.ts` to conditionally add the plugin (same guard pattern as the existing Sentry plugin):

```ts
import { codecovVitePlugin } from '@codecov/vite-plugin';

// inside plugins array:
...(process.env.CODECOV_TOKEN
  ? [
      codecovVitePlugin({
        enableBundleAnalysis: true,
        bundleName: 'schwingkeller',
        uploadToken: process.env.CODECOV_TOKEN,
      }),
    ]
  : []),
```

`CODECOV_TOKEN` must be available at build time in CI (already present as a secret).

---

## 4. Sentry Environment

**Problem:** `Sentry.init` has no `environment` set, so all events (local dev, deploy previews, production) appear as `"production"` in Sentry.

**Target mapping:**

| Context | `VITE_APP_ENV` | Sentry environment |
|---------|---------------|-------------------|
| Local dev | unset | `"development"` |
| Netlify deploy-preview | `"stage"` | `"stage"` |
| Netlify branch-deploy | `"stage"` | `"stage"` |
| Netlify production | `"production"` | `"production"` |

**Change 1 — `netlify.toml`:** Add context-specific environment blocks:

```toml
[context.production.environment]
  VITE_APP_ENV = "production"

[context.deploy-preview.environment]
  VITE_APP_ENV = "stage"

[context.branch-deploy.environment]
  VITE_APP_ENV = "stage"
```

**Change 2 — `src/lib/sentry.ts`:** Pass `environment` to `Sentry.init`:

```ts
Sentry.init({
  dsn,
  environment: import.meta.env.VITE_APP_ENV ?? 'development',
  tracesSampleRate: 0.1,
});
```

Also add `VITE_APP_ENV=` (empty) to `.env.example` as documentation.

---

## 5. CLAUDE.md PR Title Convention

**Change:** Add one line to the Dos section:

```
- Use Conventional Commits format for PR titles (e.g. `feat: add Codecov integration`, `fix: supabase db push flag`) — matching the existing commit history
```

---

## Out of Scope

- No new Supabase secrets
- No changes to RLS or schema
- No i18n changes
- No commitlint tooling (convention is documented, not enforced by tooling)
