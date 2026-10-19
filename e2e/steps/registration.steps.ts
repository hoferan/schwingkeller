import { STR } from '../../src/i18n/translations';
import { anonClient } from '../../test-support/local-stack';
import { verbandId } from '../associations';
import { When, Then, expect } from '../fixtures';

const t = STR.de;

When('I apply for an account for the Verband {string}', async ({ page, applicant }, name: string) => {
  await page.getByRole('button', { name: t.login }).click();
  await page.getByRole('button', { name: t.registerLink }).click();
  // Exact labels: "Passwort" is also part of "Passwort bestätigen".
  await page.getByLabel(t.email, { exact: true }).fill(applicant.email);
  await page.getByLabel(t.password, { exact: true }).fill(applicant.password);
  await page.getByLabel(t.passwordConfirm, { exact: true }).fill(applicant.password);
  await page.getByLabel(t.association, { exact: true }).selectOption(verbandId(name));
  await page.getByRole('button', { name: t.register }).click();
});

// Reads the profile the trigger created, as the applicant: RLS lets an account see its own row.
Then('my application names the Verband {string}', async ({ applicant }, name: string) => {
  const client = anonClient();
  const { data: auth, error } = await client.auth.signInWithPassword(applicant);
  if (error) throw new Error(`applicant sign-in failed: ${error.message}`);
  const { data: profile } = await client
    .from('profiles')
    .select('status, requested_association_id')
    .eq('id', auth.user.id)
    .single();
  expect(profile).toEqual({ status: 'pending', requested_association_id: verbandId(name) });
});
