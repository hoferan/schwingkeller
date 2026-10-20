import { STR } from '../../src/i18n/translations';
import { anonClient } from '../../test-support/local-stack';
import { verbandId } from '../associations';
import { Given, When, Then, expect } from '../fixtures';

const t = STR.de;

// Signs up through the API rather than the form: registration.feature covers the form. The local
// stack confirms addresses on its own, so the account is pending right away.
Given('an applicant has applied for the Verband {string}', async ({ applicant }, name: string) => {
  const { error } = await anonClient().auth.signUp({
    ...applicant,
    options: { data: { association: verbandId(name) } },
  });
  if (error) throw new Error(`sign-up failed: ${error.message}`);
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
  await page.getByRole('button', { name: t.approveAs.replace('{scope}', '') }).click();
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
