import { STR } from '../../src/i18n/translations';
import { ACCOUNTS, Given, When, Then, expect } from '../fixtures';
import { verbandId } from '../associations';

const t = STR.de;

type AccountName = keyof typeof ACCOUNTS;

// What the profile says about each local account. The record is exhaustive, so a new account in
// test-support/local-stack.ts doesn't compile until it is listed here.
const STATUS: Record<AccountName, 'approved' | 'pending'> = {
  esv: 'approved',
  bksv: 'approved',
  emmental: 'approved',
  pending: 'pending',
};

Given('I am signed in as the {string} editor', async ({ page }, name: string) => {
  if (!(name in ACCOUNTS)) throw new Error(`no local account "${name}"`);
  const account = ACCOUNTS[name as AccountName];
  await page.goto('/');
  await page.getByRole('button', { name: t.login }).click();
  await page.getByLabel(t.email).fill(account.email);
  const password = page.getByLabel(t.password);
  await password.fill(account.password);
  await password.press('Enter');
  await expect(page.getByRole('button', { name: t.logout })).toBeVisible();
  // The profile loads after the session. Both waits show that it has arrived, so a "doesn't offer
  // editing" check can't pass just because rights haven't loaded yet: an approved editor gets the
  // add button, an account waiting for approval gets the banner.
  if (STATUS[name as AccountName] === 'approved') {
    await expect(page.getByRole('button', { name: t.add })).toBeVisible();
  } else {
    await expect(page.getByRole('status')).toContainText(t.statusPending);
  }
});

Then('the details offer editing', async ({ page }) => {
  await expect(page.getByTestId('venue-detail')).toBeVisible();
  await expect(page.getByRole('button', { name: t.edit })).toBeVisible();
  await expect(page.getByRole('button', { name: t.delete })).toBeVisible();
});

Then("the details don't offer editing", async ({ page }) => {
  // The detail view is open, so a missing button is not just a slow render.
  await expect(page.getByTestId('venue-detail')).toBeVisible();
  await expect(page.getByRole('button', { name: t.edit })).toHaveCount(0);
  await expect(page.getByRole('button', { name: t.delete })).toHaveCount(0);
});

When('I start adding a venue', async ({ page }) => {
  await page.getByRole('button', { name: t.add }).click();
  await expect(page.getByLabel(t.association)).toBeVisible();
});

Then('the Verband choices are exactly: {}', async ({ page }, list: string) => {
  const shown = await page
    .getByLabel(t.association)
    .locator('option:not([disabled])')
    .allTextContents();
  expect(shown).toEqual(list.split(', '));
});

Then('the Verband {string} is preselected', async ({ page }, name: string) => {
  await expect(page.getByLabel(t.association)).toHaveValue(verbandId(name));
});

Then('Verband {string} offers a poster', async ({ page }, name: string) => {
  await expect(page.getByTestId(`generate-poster-${verbandId(name)}`)).toBeVisible();
});

Then("Verband {string} doesn't offer a poster", async ({ page }, name: string) => {
  // The Verband row is on screen once its group is open, so a missing button means no rights.
  await expect(page.getByTestId(`group-${verbandId(name)}`)).toBeVisible();
  await expect(page.getByTestId(`generate-poster-${verbandId(name)}`)).toHaveCount(0);
});

Then('I see that my account is waiting for approval', async ({ page }) => {
  await expect(page.getByRole('status')).toContainText(t.statusPending);
});
