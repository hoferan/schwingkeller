import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TILE_URLS } from '../src/features/map/tileSources';

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

// Every spec gets the tile stub, including the sign-in one: the app renders its map behind the
// login dialog, so even that page would otherwise reach for real tiles.
export const test = base.extend({
  page: async ({ page }, use) => {
    await stubMapTiles(page);
    await use(page);
  },
});

export { expect };
