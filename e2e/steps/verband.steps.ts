import type { Page } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { STR } from '../../src/i18n/translations';
import { anonClient } from '../../test-support/local-stack';
import { When, Then, expect } from '../fixtures';
import { TEILVERBAND_IDS, teilverbandId, verbandId, verbandIdsOf } from '../associations';

const t = STR.de;

const rows = (page: Page) => page.getByTestId('venue-row');

// The venues filed under these Verbände, read through the anon client as a visitor would get them.
const venuesIn = async (ids: readonly string[]): Promise<string[]> => {
  const { data, error } = await anonClient().from('venues').select('name, association_id');
  if (error) throw new Error(`reading venues failed: ${error.message}`);
  return data.filter((v) => ids.includes(v.association_id as string)).map((v) => v.name as string);
};

// Exact, so it also proves that every other group stayed closed. Admin scenarios add venues in
// Graubünden while this runs, which makes any count under NOSV move: never point this at NOSV.
const expectExactly = async (page: Page, names: string[]) => {
  expect(names.length, 'no venues to look for').toBeGreaterThan(0);
  await expect(rows(page)).toHaveCount(names.length);
  for (const name of names) {
    await expect(rows(page).filter({ hasText: name })).toHaveCount(1);
  }
};

// Group headers carry aria-expanded; the count badges inside them share the group- prefix but not
// the attribute.
Then('the Teilverbände are listed in this order: {}', async ({ page }, list: string) => {
  const expected = list.split(', ').map(teilverbandId);
  const shown = await page
    .locator('[data-testid^="group-"][aria-expanded]')
    .evaluateAll((headers) => headers.map((h) => h.getAttribute('data-testid')!.slice('group-'.length)));
  expect(shown.filter((id) => (TEILVERBAND_IDS as string[]).includes(id))).toEqual(expected);
});

Then('the Teilverbände count these venues:', async ({ page }, table: DataTable) => {
  for (const row of table.hashes()) {
    await expect(page.getByTestId(`group-${teilverbandId(row.Teilverband)}`).getByTestId('group-count'))
      .toHaveText(row.venues);
  }
});

When('I open the Verband {string}', async ({ page }, name: string) => {
  const header = page.getByTestId(`group-${verbandId(name)}`);
  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
});

Then('the list shows exactly the venues of Verband {string}', async ({ page }, name: string) => {
  await expectExactly(page, await venuesIn([verbandId(name)]));
});

Then('the list shows exactly the venues of Teilverband {string}', async ({ page }, short: string) => {
  await expectExactly(page, await venuesIn(verbandIdsOf(teilverbandId(short))));
});

When('I follow a shared link to Verband {string}', async ({ page }, name: string) => {
  await page.goto(`/?vb=${verbandId(name)}`);
});

Then('the list says that Verband {string} has no venues yet', async ({ page }, name: string) => {
  // The empty note shows before any venue arrives, so wait for the total first: once venues are in,
  // a Verband that still shows the note really has none.
  await expect(page.getByTestId('sidebar-header')).toContainText(new RegExp(`[1-9]\\d* ${t.unitTotal}`));
  await expect(page.getByTestId(`group-${verbandId(name)}`)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(t.associationEmpty)).toHaveCount(1);
  await expect(page.getByText(t.associationEmpty)).toBeVisible();
});
