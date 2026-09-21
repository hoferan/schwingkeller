import { defineConfig, devices } from '@playwright/test';

// End-to-end specs drive a real browser against the local Compose stack (see docker-compose.yml):
// Postgres, GoTrue, PostgREST and Kong behind localhost:54321, with the Vite app on 5173 and the
// venues from supabase/seed.sql already loaded. Nothing here talks to the cloud project.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

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

  // Brings the stack up if it is not already running; a stack that is already serving 5173 is
  // reused untouched. The first run on a cold machine pulls images, hence the long timeout.
  webServer: {
    command: 'docker compose up -d',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
