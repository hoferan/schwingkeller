import { STR } from '../../src/i18n/translations';
import { Given, expect } from '../fixtures';

const t = STR.de;

Given('I am signed in as the admin', async ({ page }) => {
  await page.goto('/');
  // The session from auth.setup.ts comes in with storageState; once it is live the topbar shows
  // the lock button instead of the unlock one.
  await expect(page.getByRole('button', { name: t.logout })).toBeVisible();
});

Given('I visit the map', async ({ page }) => {
  await page.goto('/');
  // The sidebar renders its groups from a static list before any venue loads (the 26 cantons, or
  // with the verband flag on the Teilverbände and Verbände), so waiting for a group name would pass
  // too early. The header's total only turns non-zero once venues
  // arrive from PostgREST, which is what later "is not there" checks need to wait for.
  await expect(page.getByTestId('sidebar-header')).toContainText(new RegExp(`[1-9]\\d* ${t.unitTotal}`));
});
