import { STR } from '../src/i18n/translations';
import { test as setup, expect, ADMIN, STORAGE_STATE } from './fixtures';

const t = STR.de;

// Signs in through the real form once and saves the Supabase session. Submitting with Enter rather
// than the button: the dialog's submit carries the same label as the topbar trigger that opened it,
// and LoginModal handles the key, which is what a person would do anyway.
setup('signs in as the local admin', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: t.login }).click();
  await page.getByLabel(t.email).fill(ADMIN.email);
  const password = page.getByLabel(t.password);
  await password.fill(ADMIN.password);
  await password.press('Enter');

  // The topbar swaps the unlock button for a lock button once the session is live.
  await expect(page.getByRole('button', { name: t.logout })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
