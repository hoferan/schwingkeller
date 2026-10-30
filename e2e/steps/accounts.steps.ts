import { STR } from '../../src/i18n/translations';
import { anonClient, createAuthUser, signInAsAdmin } from '../../test-support/local-stack';
import { verbandChip, verbandId } from '../associations';
import { ACCOUNTS, Given, When, Then, expect } from '../fixtures';

const t = STR.de;

// Creates the account through the admin API, since public sign-up needs an invitation. The address
// is confirmed, so the account is pending right away.
Given('an applicant has applied for the Verband {string}', async ({ applicant }, name: string) => {
  await createAuthUser(applicant.email, applicant.password, { association: verbandId(name) });
});

// Other scenarios add applicants in parallel, so the count itself can't be pinned down.
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
  await page.getByTestId('scope-dialog').getByRole('radio', { name: verbandChip(name) }).check();
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

// The super-admin invites the applicant through the API and the applicant signs up with the token,
// which approves the account for that Verband.
Given('an applicant is an editor for the Verband {string}', async ({ applicant }, name: string) => {
  const admin = await signInAsAdmin(ACCOUNTS.esv.email, ACCOUNTS.esv.password);
  const { data: invitation, error: inviteError } = await admin.rpc('create_invitation', {
    target_email: applicant.email,
    scope: verbandId(name),
  });
  if (inviteError) throw new Error(`could not invite ${applicant.email}: ${inviteError.message}`);
  const { error } = await anonClient().auth.signUp({ ...applicant, options: { data: { invitation } } });
  if (error) throw new Error(`sign-up of ${applicant.email} failed: ${error.message}`);
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
  await dialog.getByRole('radio', { name: verbandChip(name) }).check();
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

// On a phone the account panel is a full-screen dialog, and its lists are cards in a list where a
// wider screen shows table rows (AccountList.tsx and InvitationsView.tsx), so a card is a list item.
Then('the account panel fills the screen', async ({ page }) => {
  const viewport = page.viewportSize()!;
  const panel = page.getByRole('dialog');
  await expect(panel).toHaveCount(1);
  await expect
    .poll(async () => {
      const box = await panel.boundingBox();
      return box && [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)];
    })
    .toEqual([0, 0, viewport.width, viewport.height]);
});

Then('the applicant is listed as a card', async ({ page, applicant }) => {
  await expect(page.getByTestId(`account-${applicant.email}`)).toHaveRole('listitem');
});

Then("the applicant's invitation is listed as a card", async ({ page, applicant }) => {
  await expect(page.getByTestId(`invitation-${applicant.email}`)).toHaveRole('listitem');
});
