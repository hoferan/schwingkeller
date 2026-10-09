import { STR } from '../../src/i18n/translations';
import { countVenuesNamed } from '../../test-support/local-stack';
import { When, Then, expect, venueSearchPlaceholder } from '../fixtures';
import { WRITE_ASSOCIATION, WRITE_CANTON } from '../db';

const t = STR.de;

// The name comes from the venuePrefix fixture, unique per test and removed afterwards, so steps
// share no state: each derives the same name.
const newVenueName = (prefix: string) => `${prefix}Trainingshalle`;

When('I add a venue in canton {string}', async ({ page, venuePrefix }, canton: string) => {
  expect(canton, 'scenarios write only into WRITE_CANTON (e2e/db.ts)').toBe(WRITE_CANTON);
  await page.getByRole('button', { name: t.add }).click();
  // Name and association are the required fields; the address can stay empty.
  await page.getByLabel(t.name).fill(newVenueName(venuePrefix));
  await page.getByLabel(t.canton).selectOption(canton);
  await page.getByLabel(t.association).selectOption(WRITE_ASSOCIATION);
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

Then('it is stored with the association {string}', async ({ adminDb, venuePrefix }, associationId: string) => {
  // The form has the association field whether the verband flag is on or off, so this runs in both
  // views.
  const associationOf = async () => {
    const { data, error } = await adminDb.from('venues').select('association_id').like('name', `${venuePrefix}%`);
    if (error) throw new Error(`reading the new venue failed: ${error.message}`);
    return data.length === 1 ? data[0].association_id : `${data.length} rows`;
  };
  await expect.poll(associationOf).toBe(associationId);
});

When('I try to add a venue in canton {string} without an association', async ({ page, venuePrefix }, canton: string) => {
  expect(canton, 'scenarios write only into WRITE_CANTON (e2e/db.ts)').toBe(WRITE_CANTON);
  await page.getByRole('button', { name: t.add }).click();
  await page.getByLabel(t.name).fill(newVenueName(venuePrefix));
  await page.getByLabel(t.canton).selectOption(canton);
  await page.getByRole('button', { name: t.saveClose }).click();
});

Then('the form asks for an association', async ({ page }) => {
  await expect(page.getByText(t.associationRequired)).toBeVisible();
});

Then('no venue with its name is stored', async ({ adminDb, venuePrefix }) => {
  // Checked after the form has answered, so a save that was going to happen would have happened.
  expect(await countVenuesNamed(adminDb, venuePrefix)).toBe(0);
});
