import { STR } from '../src/i18n/translations';
import { test, expect, venueSearchPlaceholder } from './fixtures';
import { WRITE_CANTON, countVenuesNamed } from './db';

const t = STR.de;

// The first spec that writes. It exists as much to exercise the isolation fixture as to cover the
// admin flow: `venuePrefix` names the venue something no other worker will touch and deletes it
// afterwards, which is what keeps fullyParallel safe against a single shared database.
test.describe('creating a venue', () => {
  test('saves a new venue and finds it again by name', async ({ page, venuePrefix }) => {
    const name = `${venuePrefix}Trainingshalle`;

    await page.goto('/');
    await page.getByRole('button', { name: t.add }).click();

    // Name is the only required field. The address is left alone on purpose: typing into it
    // schedules a geocode, and although the fixture stubs Nominatim, the empty result would just
    // add a wait for nothing.
    await page.getByLabel(t.name).fill(name);
    await page.getByLabel(t.canton).selectOption(WRITE_CANTON);
    await page.getByRole('button', { name: t.saveClose }).click();

    // Searched for by name rather than asserted against a total: other workers may be creating
    // their own venues at the same moment, so any count is shared state.
    await page.getByPlaceholder(venueSearchPlaceholder).fill(name);
    await expect(page.getByText(name)).toBeVisible();
  });

  test('leaves nothing behind for another spec to trip over', async ({ page, venuePrefix, adminDb }) => {
    const name = `${venuePrefix}Aufräumtest`;

    await page.goto('/');
    await page.getByRole('button', { name: t.add }).click();
    await page.getByLabel(t.name).fill(name);
    await page.getByLabel(t.canton).selectOption(WRITE_CANTON);
    await page.getByRole('button', { name: t.saveClose }).click();

    // Its own prefix is the only thing it may assert on: another worker's rows are none of its
    // business, and the fixture removes this one once the test ends.
    await expect.poll(() => countVenuesNamed(adminDb, venuePrefix)).toBe(1);
  });
});
