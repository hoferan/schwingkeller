import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { SUPABASE_URL, supabaseEnv } from './test-support/local-stack';
import { assertLocalTargets } from './test-support/local-only';

// End-to-end scenarios drive a real browser against the local Compose stack (see
// docker-compose.yml): Postgres, GoTrue, PostgREST and Kong behind localhost:54321, with the venues
// from supabase/seed.sql already loaded. The app under test is a production bundle on 4173, next
// to the Compose dev server on 5173. Nothing here talks to the cloud project, and the guard below
// refuses to start if either URL points anywhere else.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';
const CI = !!process.env.CI;

assertLocalTargets({ baseURL: BASE_URL, supabaseURL: SUPABASE_URL });

export default defineConfig({
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
    // Signs in once and writes the session to e2e/.auth; the admin project reuses it, so the
    // login form is exercised exactly once rather than in front of each scenario.
    { name: 'setup', testDir: './e2e', testMatch: /auth\.setup\.ts/ },
    {
      // Feature files in e2e/features/admin; bddgen writes the Playwright tests to .features-gen.
      name: 'admin',
      testDir: defineBddConfig({
        outputDir: '.features-gen/admin',
        features: 'e2e/features/admin/*.feature',
        steps: ['e2e/steps/*.ts', 'e2e/fixtures.ts'],
      }),
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      dependencies: ['setup'],
    },
    {
      // Visitors are anonymous: no saved session and no dependency on the sign-in setup.
      name: 'visitor',
      testDir: defineBddConfig({
        outputDir: '.features-gen/visitor',
        features: 'e2e/features/visitor/*.feature',
        steps: ['e2e/steps/*.ts', 'e2e/fixtures.ts'],
      }),
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // The suite tests a production bundle with production's flag values (src/lib/features.ts), so it
  // covers what visitors get, and a bug that only shows after bundling or minification fails it.
  // Playwright builds and serves that bundle itself, locally as in CI, and never reuses a running
  // one: a server someone else started may have been built with other flags.
  //
  // Locally it first starts the Compose stack, and a stack already up is reused untouched. The dev
  // server on 5173 depends on the migrations, the seed and the admin, so its answering means the
  // backend is ready. Playwright fails a server command that exits before its URL answers, and
  // `up -d` returns while the dev server is still installing, so following the web logs keeps the
  // command alive; stopping it at the end of the run leaves the containers up. The first run on a
  // cold machine pulls images, hence the long timeout. In CI the workflow starts the backend
  // containers itself.
  //
  // Vite lets process.env win over .env files, so these values also override a developer's
  // .env.local: no cloud URL, Sentry DSN or other VITE_APP_ENV reaches the bundle. `vite build`
  // rather than `npm run build`, because build-test already type-checks; `vite preview` serves the
  // SPA fallback like Netlify does.
  webServer: [
    ...(CI
      ? []
      : [
          {
            command: 'docker compose up -d && docker compose logs --follow web',
            url: 'http://localhost:5173',
            reuseExistingServer: true,
            timeout: 300_000,
          },
        ]),
    {
      command: 'npx vite build && npx vite preview --port 4173 --strictPort',
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        VITE_APP_ENV: 'production',
        VITE_SUPABASE_URL: SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: supabaseEnv('ANON_KEY'),
        VITE_SENTRY_DSN: '',
      },
    },
  ],
});
