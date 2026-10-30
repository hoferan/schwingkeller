import { STR } from '../../src/i18n/translations';
import { Given, When, expect } from '../fixtures';
import { sessionControl } from '../session';

const t = STR.de;

Given('I am signed in as the admin', async ({ page }) => {
  await page.goto('/');
  // The session from auth.setup.ts comes in with storageState.
  await expect(sessionControl(page)).toBeVisible();
});

Given('I visit the map', async ({ page }) => {
  await page.goto('/');
  // The sidebar renders its groups from a static list before any venue loads (the 26 cantons, or
  // with the verband flag on the Teilverbände), so waiting for a group name would pass
  // too early. The header's total only turns non-zero once venues
  // arrive from PostgREST, which is what later "is not there" checks need to wait for.
  await expect(page.getByTestId('sidebar-header')).toContainText(new RegExp(`[1-9]\\d* ${t.unitTotal}`));
});

// InviteDialog asks a signed-in visitor to sign out instead of showing the sign-up form, so the
// invited person's steps start from a signed-out page.
When('I sign out', async ({ page }) => {
  // The panel sits over the top bar. Its title names it: "Benutzer" for an editor with nodes below,
  // "Einladungen" for the others.
  const panel = page.getByRole('dialog', { name: new RegExp(`^(${t.accountsTitle}|${t.invitationsTitle})$`) });
  await panel.getByRole('button', { name: t.close, exact: true }).click();
  await expect(panel).toHaveCount(0);
  await page.getByRole('button', { name: t.accountMenu, exact: true }).click();
  await page.getByRole('menuitem', { name: t.logout }).click();
  await expect(page.getByRole('button', { name: t.login, exact: true })).toBeVisible();
});
