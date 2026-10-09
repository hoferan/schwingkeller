import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import type { SetupOptions } from './e2e/fixtures';
import { SUPABASE_URL, supabaseEnv } from './test-support/local-stack';
import { assertLocalTargets } from './test-support/local-only';

// End-to-end scenarios drive a real browser against the local Compose stack (see
// docker-compose.yml): Postgres, GoTrue, PostgREST and Kong behind localhost:54321, with the venues
// from supabase/seed.sql already loaded. The app under test is two production bundles, one with
// production's feature flag values on 4173 and one with the verband flag on at 4174, next to the
// Compose dev server on 5173. Nothing here talks to the cloud project, and the guard below refuses
// to start if any of these URLs points anywhere else.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';
const VERBAND_BASE_URL = process.env.E2E_VERBAND_BASE_URL ?? 'http://localhost:4174';
const CI = !!process.env.CI;

assertLocalTargets({ baseURL: BASE_URL, verbandBaseURL: VERBAND_BASE_URL, supabaseURL: SUPABASE_URL });

// The Supabase session lives in localStorage, and 4173 and 4174 are different origins, so each
// bundle gets its own sign-in and its own saved session.
const ADMIN_STATE = 'e2e/.auth/admin.json';
const VERBAND_ADMIN_STATE = 'e2e/.auth/admin-verband.json';

// Feature files by role, in e2e/features/admin or e2e/features/visitor. A scenario runs against
// both bundles unless a tag ties it to one view: @canton-view runs only with the verband flag off,
// @verband-view only with it on. bddgen writes each project's tests to its own folder.
const bddProject = (name: string, role: 'admin' | 'visitor', tags: string) => ({
  name,
  testDir: defineBddConfig({
    outputDir: `.features-gen/${name}`,
    features: `e2e/features/${role}/*.feature`,
    steps: ['e2e/steps/*.ts', 'e2e/fixtures.ts'],
    tags,
  }),
});

// Vite lets process.env win over .env files, so these values also override a developer's
// .env.local: no cloud URL, Sentry DSN or other VITE_APP_ENV reaches either bundle.
const bundleEnv = (appEnv: 'production' | 'stage') => ({
  VITE_APP_ENV: appEnv,
  VITE_SUPABASE_URL: SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: supabaseEnv('ANON_KEY'),
  VITE_SENTRY_DSN: '',
});

export default defineConfig<SetupOptions>({
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
    // Signs in once and saves the session; the admin project reuses it, so the login form is
    // exercised once per bundle rather than in front of each scenario.
    { name: 'setup', testDir: './e2e', testMatch: /auth\.setup\.ts/, use: { storageStatePath: ADMIN_STATE } },
    {
      ...bddProject('admin', 'admin', 'not @verband-view'),
      use: { ...devices['Desktop Chrome'], storageState: ADMIN_STATE },
      dependencies: ['setup'],
    },
    // Visitors are anonymous: no saved session and no dependency on the sign-in setup.
    { ...bddProject('visitor', 'visitor', 'not @verband-view'), use: { ...devices['Desktop Chrome'] } },

    // The same three against the bundle with the verband flag on.
    {
      name: 'setup-verband',
      testDir: './e2e',
      testMatch: /auth\.setup\.ts/,
      use: { baseURL: VERBAND_BASE_URL, storageStatePath: VERBAND_ADMIN_STATE },
    },
    {
      ...bddProject('admin-verband', 'admin', 'not @canton-view'),
      use: { ...devices['Desktop Chrome'], baseURL: VERBAND_BASE_URL, storageState: VERBAND_ADMIN_STATE },
      dependencies: ['setup-verband'],
    },
    {
      ...bddProject('visitor-verband', 'visitor', 'not @canton-view'),
      use: { ...devices['Desktop Chrome'], baseURL: VERBAND_BASE_URL },
    },
  ],

  // The suite tests production bundles, so a bug that only shows after bundling or minification
  // fails it. The bundle on 4173 has production's flag values (src/lib/features.ts) and covers what
  // visitors get today. The one on 4174 is built like a deploy preview, with VITE_APP_ENV=stage, and
  // covers the Verband view before it is switched on. Playwright builds and serves both itself,
  // locally as in CI, and never reuses a running one: a server someone else started may have been
  // built with other flags. It starts the servers one after the other, and the second bundle builds
  // into its own folder because the first is already being served from dist.
  //
  // Locally it first starts the Compose stack, and a stack already up is reused untouched. The dev
  // server on 5173 depends on the migrations, the seed and the admin, so its answering means the
  // backend is ready. Playwright fails a server command that exits before its URL answers, and
  // `up -d` returns while the dev server is still installing, so following the web logs keeps the
  // command alive; stopping it at the end of the run leaves the containers up. The first run on a
  // cold machine pulls images, hence the long timeout. In CI the workflow starts the backend
  // containers itself.
  //
  // `vite build` rather than `npm run build`, because build-test already type-checks; `vite preview`
  // serves the SPA fallback like Netlify does.
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
      env: bundleEnv('production'),
    },
    {
      command: 'npx vite build --outDir dist-verband && npx vite preview --outDir dist-verband --port 4174 --strictPort',
      url: VERBAND_BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: bundleEnv('stage'),
    },
  ],
});
