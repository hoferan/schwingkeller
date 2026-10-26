import { randomBytes } from 'node:crypto';
import { STR } from '../../src/i18n/translations';
import { signInAsAdmin } from '../../test-support/local-stack';
import { verbandId } from '../associations';
import { ACCOUNTS, Given, When, Then, expect } from '../fixtures';

const t = STR.de;

// The super-admin invites through the API; the admin panel's invite form is #141.
Given('the applicant has been invited to the Verband {string}', async ({ applicant, invitation }, name: string) => {
  const admin = await signInAsAdmin(ACCOUNTS.esv.email, ACCOUNTS.esv.password);
  const { data, error } = await admin.rpc('create_invitation', {
    target_email: applicant.email,
    scope: verbandId(name),
  });
  if (error) throw new Error(`could not invite ${applicant.email}: ${error.message}`);
  invitation.token = data as string;
});

When('the applicant opens the invitation link', async ({ page, invitation }) => {
  if (!invitation.token) throw new Error('no invitation was created');
  await page.goto(`/?invite=${encodeURIComponent(invitation.token)}`);
});

Then(
  "the sign-up form shows the applicant's address, locked, for {string}",
  async ({ page, applicant }, name: string) => {
    const email = page.getByLabel(t.email);
    await expect(email).toHaveValue(applicant.email);
    await expect(email).toHaveAttribute('readonly', '');
    await expect(page.getByText(t.inviteFor.replace('{node}', name))).toBeVisible();
    // The token has already left the address bar.
    expect(new URL(page.url()).searchParams.has('invite')).toBe(false);
  },
);

When('the applicant chooses a password and creates the account', async ({ page, applicant }) => {
  await page.getByLabel(t.password, { exact: true }).fill(applicant.password);
  await page.getByLabel(t.passwordConfirm).fill(applicant.password);
  await page.getByRole('button', { name: t.inviteSubmit }).click();
});

Then('the welcome note names {string}', async ({ page }, name: string) => {
  await expect(page.getByText(t.inviteWelcome.replace('{node}', name))).toBeVisible();
});

// 32 random bytes in base64url, shaped like a real token.
When('I open an invitation link with an unknown token', async ({ page }) => {
  await page.goto(`/?invite=${randomBytes(32).toString('base64url')}`);
});

Then('I see that the invitation link is not valid', async ({ page }) => {
  await expect(page.getByText(t.inviteInvalid)).toBeVisible();
});
