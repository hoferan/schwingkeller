import { STR } from '../../src/i18n/translations';
import { countVenuesNamed } from '../../test-support/local-stack';
import { When, Then, expect, venueSearchPlaceholder } from '../fixtures';

const t = STR.de;

// The name comes from the venuePrefix fixture, unique per test and removed afterwards, so steps
// share no state: each derives the same name.
const newVenueName = (prefix: string) => `${prefix}Trainingshalle`;

When('I add a venue in canton {string}', async ({ page, venuePrefix }, canton: string) => {
  await page.getByRole('button', { name: t.add }).click();
  // Name is the only required field. The address stays empty on purpose: typing into it schedules
  // a geocode, and although the fixture stubs Nominatim, the empty result would only add a wait.
  await page.getByLabel(t.name).fill(newVenueName(venuePrefix));
  await page.getByLabel(t.canton).selectOption(canton);
  await page.getByRole('button', { name: t.saveClose }).click();
});

Then('searching for its name shows it', async ({ page, venuePrefix }) => {
  // Searched for by name rather than counted: other workers create venues at the same moment.
  const name = newVenueName(venuePrefix);
  await page.getByPlaceholder(venueSearchPlaceholder).fill(name);
  await expect(page.getByText(name)).toBeVisible();
});

Then('exactly one venue with its name is stored', async ({ adminDb, venuePrefix }) => {
  // Only its own prefix: other workers' rows are none of its business, and the fixture removes this
  // one when the test ends.
  await expect.poll(() => countVenuesNamed(adminDb, venuePrefix)).toBe(1);
});
