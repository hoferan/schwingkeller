import { STR } from '../../src/i18n/translations';
import { anonClient } from '../../test-support/local-stack';
import { When, Then, expect } from '../fixtures';
import { E2E_PREFIX } from '../db';

const t = STR.de;

// Canton groups start collapsed; a search, a filter or a ?ctn= link expands them. Positive list
// checks therefore come first in a scenario, and a "does not show" check only runs once a positive
// one has proved the list is in the state under test.
const rows = (page: import('@playwright/test').Page) => page.getByTestId('venue-row');

// Looked up through the anon client, whose module-scope guard refuses anything but the local stack.
const venueByName = async (name: string) => {
  const { data, error } = await anonClient().from('venues').select('id').eq('name', name).single();
  if (error) throw new Error(`looking up "${name}" failed: ${error.message}`);
  return data.id as string;
};

When('I search for {string}', async ({ page }, query: string) => {
  await page.getByPlaceholder(t.search).fill(query);
});

Then('the list shows {string} and no other venue', async ({ page }, name: string) => {
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText(name);
});

Then('the list shows {string}', async ({ page }, name: string) => {
  await expect(rows(page).filter({ hasText: name })).toHaveCount(1);
});

Then('the list does not show {string}', async ({ page }, name: string) => {
  await expect(rows(page).filter({ hasText: name })).toHaveCount(0);
});

Then('the list says that nothing was found', async ({ page }) => {
  await expect(page.getByText(t.noResults)).toBeVisible();
});

When('I show only outdoor venues', async ({ page }) => {
  const outdoor = page.getByRole('button', { name: t.outdoor, exact: true });
  await outdoor.click();
  await expect(outdoor).toHaveAttribute('aria-pressed', 'true');
});

When('I open {string} from the list', async ({ page }, name: string) => {
  // A visitor finds it by searching, which also expands its canton. Selecting a row flies the map
  // to its marker and, once that finishes, opens the marker's popup; MapView.tsx wires the detail
  // view to that popup's own "Details" button, not to the row itself.
  await page.getByPlaceholder(t.search).fill(name);
  await rows(page).filter({ hasText: name }).click();
  await page.getByRole('button', { name: t.details }).click();
});

Then('I see the address {string}', async ({ page }, address: string) => {
  await expect(page.getByTestId('venue-detail')).toContainText(address);
});

// The directions control is a plain button, not a link (App.tsx builds the Google Maps URL and
// hands it to window.open), so there is no href to read. Instead, everything under
// google.com/maps is routed to a stub response, so the click never reaches the real service, and
// the assertion reads the URL of the popup window the button opens.
Then('I can get directions to it', async ({ page }) => {
  await page.context().route('https://www.google.com/maps/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '' }));
  const popup = page.waitForEvent('popup');
  await page.getByTestId('venue-detail').getByRole('button', { name: t.navigate }).click();
  const opened = await popup;
  await expect(opened).toHaveURL(
    /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d+(\.\d+)?,-?\d+(\.\d+)?$/,
  );
  await opened.close();
});

When('I follow a shared link to {string}', async ({ page }, name: string) => {
  await page.goto(`/?venue=${await venueByName(name)}`);
});

Then('the details of {string} are open', async ({ page }, name: string) => {
  await expect(page.getByTestId('venue-detail')).toContainText(name);
});

// Leaflet names a pin's button after the marker's title, which MapView sets to the venue's name.
const pinOf = (page: import('@playwright/test').Page, name: string) =>
  page.locator(`.leaflet-marker-icon[title="${name}"]`);

// The map's zoom, read from the tiles it shows: every tile URL carries its zoom level
// (tile.openstreetmap.org/{z}/{x}/{y}.png). While the map flies or zooms, tiles of two levels are on
// screen, and then this returns -1.
const tileZoom = async (page: import('@playwright/test').Page) => {
  const srcs = await page.locator('img.leaflet-tile').evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).src));
  const levels = [...new Set(srcs.map((src) => Number(new URL(src).pathname.split('/')[1])))];
  return levels.length === 1 ? levels[0] : -1;
};

// MapView opens on the whole country at zoom 8, and a canton link flies in from there.
const COUNTRY_ZOOM = 8;

// The zoom once the map is at rest. Partway through a flight the tiles can show a single level for
// a moment, so a lone level alone doesn't prove the map has landed; a pin that stays put for 300 ms
// does, since every frame of a flight moves it.
const restingZoom = async (page: import('@playwright/test').Page, pin: import('@playwright/test').Locator) => {
  let zoom = -1;
  await expect.poll(async () => {
    const before = await pin.boundingBox();
    await page.waitForTimeout(300);
    const after = await pin.boundingBox();
    const still = !!before && !!after && before.x === after.x && before.y === after.y;
    zoom = still ? await tileZoom(page) : -1;
    return zoom;
  }, { timeout: 10_000 }).toBeGreaterThan(COUNTRY_ZOOM);
  return zoom;
};

When('I click the pin of {string}', async ({ page, mapZoom }, name: string) => {
  // The pin is clicked once the canton link's flight has landed.
  mapZoom.before = await restingZoom(page, pinOf(page, name));
  await pinOf(page, name).click();
});

Then('the popup of {string} is open', async ({ page }, name: string) => {
  await expect(page.locator('.leaflet-popup')).toContainText(name);
});

// A pin click used to fly the map in, which took 800 ms. This checks that nothing happens, so it
// waits out that time before it reads the zoom again.
Then('the map has kept its zoom', async ({ page, mapZoom }) => {
  await page.waitForTimeout(1000);
  await expect.poll(() => tileZoom(page)).toBe(mapZoom.before);
});

// The selected pin is the only teardrop (an SVG path), and its row in the list is marked current.
Then('{string} is selected', async ({ page }, name: string) => {
  await expect(pinOf(page, name).locator('path')).toHaveCount(1);
  await expect(rows(page).filter({ hasText: name })).toHaveAttribute('aria-current', 'true');
});

When('I close the popup', async ({ page }) => {
  await page.locator('.leaflet-popup').getByRole('button', { name: t.close }).click();
});

Then('no venue is selected', async ({ page }) => {
  await expect(page.locator('.leaflet-marker-icon path')).toHaveCount(0);
  await expect(page.locator('[data-testid="venue-row"][aria-current="true"]')).toHaveCount(0);
});

When('I follow a shared link to canton {string}', async ({ page }, canton: string) => {
  await page.goto(`/?ctn=${canton}`);
});

// Only a ?ctn= link pre-expands a canton (App.tsx), so its venues are listed and every other
// canton's stay collapsed. The venue picked to prove that is deliberate, not the first one found:
// parallel admin scenarios write transient [e2e] venues into GR, and one of those could otherwise
// get picked and then vanish mid-run when its own scenario cleans up, so it is excluded and the
// remaining candidates are sorted by name for a stable choice.
Then('the venues of canton {string} are shown', async ({ page }, canton: string) => {
  const { data, error } = await anonClient().from('venues').select('name, canton');
  if (error) throw new Error(`reading venues failed: ${error.message}`);
  const inside = data.filter((v) => v.canton === canton).map((v) => v.name as string);
  const outside = data
    .filter((v) => v.canton !== canton && !(v.name as string).startsWith(E2E_PREFIX))
    .map((v) => v.name as string)
    .sort()[0];
  expect(inside.length).toBeGreaterThan(0);
  expect(outside, 'no venue outside that canton to check against').toBeDefined();
  for (const name of inside) {
    await expect(rows(page).filter({ hasText: name })).toHaveCount(1);
  }
  await expect(rows(page).filter({ hasText: outside! })).toHaveCount(0);
});

Then('there is no button to add a venue', async ({ page }) => {
  // "I visit the map" waited for the canton list, so an admin control would be rendered by now.
  await expect(page.getByRole('button', { name: t.add })).toHaveCount(0);
});

Then('no canton offers a poster', async ({ page }) => {
  await expect(page.locator('[data-testid^="generate-poster-"]')).toHaveCount(0);
});

When('I switch the language to French', async ({ page }) => {
  // The topbar labels its language buttons with the language's own name (LANG_NAMES in Topbar.tsx).
  await page.getByRole('button', { name: 'Français' }).click();
});

Then('the interface is in French', async ({ page }) => {
  await expect(page.getByPlaceholder(STR.fr.search)).toBeVisible();
});

const sidebarWidth = async (page: import('@playwright/test').Page) =>
  (await page.getByTestId('sidebar-root').boundingBox())!.width;

// The handle follows the pointer one to one, so moving it by the difference to the wanted width
// lands exactly on it. The intermediate steps send pointer moves along the way, as a hand does.
When('I drag the edge of the venue list to {int} pixels', async ({ page }, width: number) => {
  const box = (await page.getByRole('separator', { name: t.resizeSidebar }).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + width - (await sidebarWidth(page)), y, { steps: 5 });
  await page.mouse.up();
});

Then('the venue list is {int} pixels wide', async ({ page }, width: number) => {
  await expect.poll(() => sidebarWidth(page)).toBe(width);
});

When('I come back to the map later', async ({ page }) => {
  await page.reload();
  await expect(page.getByTestId('sidebar-header')).toContainText(new RegExp(`[1-9]\\d* ${t.unitTotal}`));
});
