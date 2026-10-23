import type { Page } from '@playwright/test';
import { STR } from '../../src/i18n/translations';
import { Given, When, Then, expect } from '../fixtures';

const t = STR.de;

const dialog = (page: Page) => page.getByTestId('delete-own-account-dialog');

const deleteMyAccount = async (page: Page, password: string) => {
  await page.getByRole('button', { name: t.accountMenu, exact: true }).click();
  await page.getByRole('menuitem', { name: t.deleteOwnAccount }).click();
  await dialog(page).getByLabel(t.deleteOwnPassword).fill(password);
  await dialog(page).getByRole('button', { name: t.delete }).click();
};

// Through the login form, as the applicant would. The banner shows that the profile has loaded.
Given('I am signed in as the applicant', async ({ page, applicant }) => {
  await page.goto('/');
  await page.getByRole('button', { name: t.login }).click();
  await page.getByLabel(t.email).fill(applicant.email);
  const password = page.getByLabel(t.password);
  await password.fill(applicant.password);
  await password.press('Enter');
  await expect(page.getByRole('status')).toContainText(t.statusPending);
});

When('I delete my account with my password', async ({ page, applicant }) => {
  await deleteMyAccount(page, applicant.password);
});

When('I try to delete my account with the password {string}', async ({ page }, password: string) => {
  await deleteMyAccount(page, password);
});

Then('I see that my account has been deleted', async ({ page }) => {
  await expect(page.getByText(t.accountDeleted)).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: t.login })).toBeVisible();
});

Then("I'm told the password is wrong", async ({ page }) => {
  await expect(dialog(page).getByRole('alert')).toHaveText(t.deleteOwnErrPassword);
});
