import { STR } from '../../src/i18n/translations';
import { anonClient, createAuthUser, signInAsAdmin } from '../../test-support/local-stack';
import { verbandId } from '../associations';
import { ACCOUNTS, Given, When, Then, expect } from '../fixtures';

const t = STR.de;

// Creates the account through the admin API rather than the form: registration.feature covers the
// form, and public sign-up needs an invitation. The address is confirmed, so the account is pending
// right away.
Given('an applicant has applied for the Verband {string}', async ({ applicant }, name: string) => {
  await createAuthUser(applicant.email, applicant.password, { association: verbandId(name) });
});

// registration.feature adds applicants in parallel, so the count itself can't be pinned down.
Then('the account entry shows pending requests', async ({ page }) => {
  const entry = page.getByRole('button', { name: t.accountsTitle });
  await expect(entry).toHaveAccessibleDescription(/\d+ offene Anfragen/);
});

When('I open the account list', async ({ page }) => {
  await page.getByRole('button', { name: t.accountsTitle }).click();
  await expect(page.getByLabel(t.accountsFilter)).toHaveValue('pending');
});

When('I approve the applicant as {string}', async ({ page, applicant }, name: string) => {
  await page.getByTestId(`account-${applicant.email}`).getByRole('button', { name: t.approve }).click();
  await page.getByLabel(t.accountsScope).selectOption(verbandId(name));
  // The row has an approve button too, so look inside the dialog.
  await page.getByTestId('scope-dialog').getByRole('button', { name: t.approve }).click();
  await expect(page.getByTestId(`account-${applicant.email}`)).toHaveCount(0);
});

// Read as the applicant: RLS lets an account see its own row.
Then('the applicant is an editor for the Verband {string}', async ({ applicant }, name: string) => {
  const client = anonClient();
  const { data: auth, error } = await client.auth.signInWithPassword(applicant);
  if (error) throw new Error(`applicant sign-in failed: ${error.message}`);
  const { data: profile } = await client
    .from('profiles')
    .select('status, scope_association_id')
    .eq('id', auth.user.id)
    .single();
  expect(profile).toEqual({ status: 'approved', scope_association_id: verbandId(name) });
});

// Approved through the API as the super-admin: account-approval.feature covers approving in the UI.
Given('an applicant is an editor for the Verband {string}', async ({ applicant }, name: string) => {
  const { error } = await anonClient().auth.signUp({
    ...applicant,
    options: { data: { association: verbandId(name) } },
  });
  if (error) throw new Error(`sign-up failed: ${error.message}`);
  const admin = await signInAsAdmin(ACCOUNTS.esv.email, ACCOUNTS.esv.password);
  const { data: profile, error: readError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', applicant.email)
    .single();
  if (readError) throw new Error(`could not read ${applicant.email}: ${readError.message}`);
  const { error: approveError } = await admin.rpc('approve_editor', { target_id: profile.id, scope: verbandId(name) });
  if (approveError) throw new Error(`could not approve ${applicant.email}: ${approveError.message}`);
});

When('I show the {string} accounts', async ({ page }, status: string) => {
  await page.getByLabel(t.accountsFilter).selectOption(status);
});

When('I open the account list showing approved accounts', async ({ page }) => {
  await page.getByRole('button', { name: t.accountsTitle }).click();
  await page.getByLabel(t.accountsFilter).selectOption('approved');
});

When("I change the applicant's scope to {string}", async ({ page, applicant }, name: string) => {
  await page.getByTestId(`account-${applicant.email}`).getByRole('button', { name: t.changeScope }).click();
  const dialog = page.getByTestId('scope-dialog');
  await dialog.getByLabel(t.accountsScope).selectOption(verbandId(name));
  await dialog.getByRole('button', { name: t.save }).click();
  await expect(dialog).toHaveCount(0);
});

// Each action takes the account out of the status the list is filtered to.
When('I suspend the applicant', async ({ page, applicant }) => {
  const row = page.getByTestId(`account-${applicant.email}`);
  await row.getByRole('button', { name: t.suspend }).click();
  await expect(row).toHaveCount(0);
});

When('I reactivate the applicant', async ({ page, applicant }) => {
  const row = page.getByTestId(`account-${applicant.email}`);
  await row.getByRole('button', { name: t.reactivate }).click();
  await expect(row).toHaveCount(0);
});

When('I delete the applicant and confirm', async ({ page, applicant }) => {
  const row = page.getByTestId(`account-${applicant.email}`);
  await row.getByRole('button', { name: t.delete }).click();
  await page.getByTestId('delete-account-dialog').getByRole('button', { name: t.delete }).click();
  await expect(row).toHaveCount(0);
});

Then("the applicant's account is {string}", async ({ applicant }, status: string) => {
  const client = anonClient();
  const { data: auth, error } = await client.auth.signInWithPassword(applicant);
  if (error) throw new Error(`applicant sign-in failed: ${error.message}`);
  const { data: profile } = await client.from('profiles').select('status').eq('id', auth.user.id).single();
  expect(profile).toEqual({ status });
});

Then('the applicant can no longer sign in', async ({ applicant }) => {
  const { error } = await anonClient().auth.signInWithPassword(applicant);
  expect(error?.code).toBe('invalid_credentials');
});

Then("the applicant's row offers no delete", async ({ page, applicant }) => {
  const row = page.getByTestId(`account-${applicant.email}`);
  await expect(row.getByRole('button', { name: t.suspend })).toBeVisible();
  await expect(row.getByRole('button', { name: t.delete })).toHaveCount(0);
});
