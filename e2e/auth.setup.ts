import { test as setup, expect } from '@playwright/test';
import { STR } from '../src/i18n/translations';
import { ADMIN, STORAGE_STATE } from './fixtures';

const t = STR.de;

// Signs in through the real form once and saves the Supabase session. The submit button carries the
// same label as the topbar trigger that opens the dialog, so this presses Enter in the password
// field instead — LoginModal handles that key, and it is what a person would do anyway.
setup('signs in as the local admin', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: t.login }).click();
  await page.locator('input[type="email"]').fill(ADMIN.email);
  const password = page.locator('input[type="password"]');
  await password.fill(ADMIN.password);
  await password.press('Enter');

  // The topbar swaps the unlock button for a lock button once the session is live.
  await expect(page.getByRole('button', { name: t.logout })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
