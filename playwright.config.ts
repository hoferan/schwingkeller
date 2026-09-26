import { defineConfig, devices } from '@playwright/test';
import { SUPABASE_URL } from './test-support/local-stack';
import { assertLocalTargets } from './test-support/local-only';

// End-to-end specs drive a real browser against the local Compose stack (see docker-compose.yml):
// Postgres, GoTrue, PostgREST and Kong behind localhost:54321, with the Vite app on 5173 and the
// venues from supabase/seed.sql already loaded. Nothing here talks to the cloud project, and the
// guard below refuses to start if either URL points anywhere else.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const CI = !!process.env.CI;

assertLocalTargets({ baseURL: BASE_URL, supabaseURL: SUPABASE_URL });

export default defineConfig({
  testDir: './e2e',
  // Specs only. Playwright's default would also load e2e/*.test.ts, the Vitest unit tests of the
  // e2e helpers, and fail on their Vitest imports.
  testMatch: '**/*.spec.ts',
  // Sweeps venues left by a run that died before cleaning up. See e2e/global-setup.ts.
  globalSetup: './e2e/global-setup.ts',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: CI,
  // One retry absorbs a container still settling; more than that would let a genuinely flaky
  // spec report green, and with tiles stubbed there is no longer a network excuse for flakiness.
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    // The poster export waits on OSM tiles, which are slower and less predictable than local
    // requests, so the default 5s expect timeout is too tight for those assertions.
    actionTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Signs in once and writes the session to e2e/.auth; every other project reuses it, so the
    // login form is exercised exactly once rather than in front of each spec.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      dependencies: ['setup'],
    },
  ],

  // Locally the Compose stack serves the app itself, and a stack already on 5173 is reused
  // untouched; the first run on a cold machine pulls images, hence the long timeout. In CI the
  // workflow starts only the backend containers, and the runner builds the production bundle and
  // serves it with `vite preview`, so a bug that only shows after bundling or minification fails
  // the pull request. Vite inlines VITE_SUPABASE_URL at build time, and the workflow points it at
  // the local stack first. `vite build` rather than `npm run build`, because build-test already
  // type-checks; `vite preview` serves the SPA fallback like Netlify does.
  webServer: {
    command: CI
      ? 'npx vite build && npx vite preview --port 5173 --strictPort'
      : 'docker compose up -d',
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: CI ? 180_000 : 300_000,
  },
});
