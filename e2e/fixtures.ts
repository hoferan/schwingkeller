import { test as base, expect } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TILE_URLS } from '../src/features/map/tileSources';
import { E2E_PREFIX, deleteVenuesNamed, signInAsAdmin } from './db';

// The admin that docker-compose.yml's admin-init creates through the GoTrue admin API. These are
// local-stack-only credentials, committed alongside the demo JWTs in docker/supabase.env for the
// same reason: `docker compose up` has to work with no setup. They authenticate against nothing
// but a disposable container on this machine.
export const ADMIN = {
  email: 'admin@schwingkeller.local',
  password: 'schwingadmin',
} as const;

export const STORAGE_STATE = 'e2e/.auth/admin.json';

// Fribourg carries 11 seeded venues, two of them ~135m apart, which is the only canton dense
// enough to push the poster's label placement off its first-choice slot. See supabase/seed.sql.
export const DENSE_CANTON = 'FR';

// The sidebar's search box has no label, only a placeholder.
export const venueSearchPlaceholder = 'Schwingkeller suchen';

const STUB_TILE = readFileSync(resolve(process.cwd(), 'e2e/fixtures/tile.png'));

// Origins come from the app's own TILE_URLS, so pointing the map at a different provider cannot
// quietly leave these tests fetching from the real internet again.
const TILE_ORIGINS = Object.values(TILE_URLS).map((url) => new URL(url).origin);

// Serves every map tile from a local 256px PNG instead of the real providers. Three reasons:
// OpenStreetMap's tile usage policy does not cover a CI suite hammering it on every pull request;
// shared runner addresses get throttled, and the poster export gives up after 8s with
// [TILE_TIMEOUT]; and a fixed tile makes the export byte-stable instead of network-dependent.
//
// Access-Control-Allow-Origin is not optional here. The capture map requests tiles with
// crossOrigin: 'anonymous' precisely so the canvas stays untainted, and a stubbed response without
// that header taints it — canvas.toBlob() then throws SecurityError and the failure looks like
// anything but a missing header.
export const stubMapTiles = async (page: import('@playwright/test').Page) => {
  for (const origin of TILE_ORIGINS) {
    await page.route(`${origin}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
        body: STUB_TILE,
      }));
  }
};

// Nominatim is a volunteer service with a published rate limit of one request a second, so a test
// suite has no business calling it — the edit form geocodes 900ms after an address is typed.
// Answering with an empty result set leaves the form's own "nothing found" path intact.
export const stubGeocoding = async (page: import('@playwright/test').Page) => {
  await page.route('https://nominatim.openstreetmap.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
};

// Every spec gets the tile stub, including the sign-in one: the app renders its map behind the
// login dialog, so even that page would otherwise reach for real tiles.
//
// `venuePrefix` is what makes writing safe under fullyParallel. Specs run against one shared
// database, so a spec that creates venues has to name them something no other worker will touch
// and remove them afterwards. Taking the prefix from the fixture guarantees both: the name is
// unique per test, and the cleanup runs even when the test fails.
export const test = base.extend<{ venuePrefix: string }, { adminDb: SupabaseClient }>({
  page: async ({ page }, use) => {
    await stubMapTiles(page);
    await stubGeocoding(page);
    await use(page);
  },

  // One sign-in per worker rather than per test.
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the fixture-args parameter
  adminDb: [async ({}, use) => {
    const client = await signInAsAdmin(ADMIN.email, ADMIN.password);
    await use(client);
  }, { scope: 'worker' }],

  venuePrefix: async ({ adminDb }, use, testInfo) => {
    const prefix = `${E2E_PREFIX} w${testInfo.workerIndex}-${testInfo.testId.slice(0, 8)} `;
    await use(prefix);
    await deleteVenuesNamed(adminDb, prefix);
  },
});

export { expect };
