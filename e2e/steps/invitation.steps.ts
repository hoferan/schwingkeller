import { randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';
import { STR } from '../../src/i18n/translations';
import { signInAsAdmin } from '../../test-support/local-stack';
import { verbandChip, verbandId } from '../associations';
import { ACCOUNTS, Given, When, Then, expect } from '../fixtures';

const t = STR.de;

// Creates the invitation in the open dialog and keeps the token from the link it shows.
const createInvitation = async (page: Page, invitation: { token?: string }) => {
  const dialog = page.getByTestId('create-invitation-dialog');
  await dialog.getByRole('button', { name: t.inviteCreate }).click();
  const link = await dialog.getByLabel(t.inviteLink).inputValue();
  const token = new URL(link).searchParams.get('invite');
  if (!token) throw new Error(`the invitation link has no token: ${link}`);
  invitation.token = token;
};

// The super-admin invites through the API. Scenarios that don't test the invitations panel use this
// path; the panel has its own scenarios in invitations.feature.
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
  // The form gives way to the welcome note once the account exists, so later steps that read the
  // account don't race the sign-up request.
  await expect(page.getByLabel(t.password, { exact: true })).toHaveCount(0);
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

When('I invite the applicant from the invitations panel', async ({ page, applicant, invitation }) => {
  await page.getByRole('button', { name: t.invitationsTitle, exact: true }).click();
  await page.getByRole('button', { name: new RegExp(String.raw`^\+?\s*${t.invite}$`) }).click();
  const dialog = page.getByTestId('create-invitation-dialog');
  await dialog.getByLabel(t.email).fill(applicant.email);
  await createInvitation(page, invitation);
});

When('I invite the applicant to {string} from the Einladungen tab', async ({ page, applicant, invitation }, name: string) => {
  await page.getByRole('tab', { name: new RegExp(t.invitationsTitle) }).click();
  await page.getByRole('button', { name: new RegExp(String.raw`^\+?\s*${t.invite}$`) }).click();
  const dialog = page.getByTestId('create-invitation-dialog');
  await dialog.getByLabel(t.email).fill(applicant.email);
  await dialog.getByRole('radio', { name: verbandChip(name) }).check();
  await createInvitation(page, invitation);
});

Then('the invitation link is shown once', async ({ page }) => {
  const dialog = page.getByTestId('create-invitation-dialog');
  await expect(dialog.getByText(t.inviteShownOnce)).toBeVisible();
  const link = await dialog.getByLabel(t.inviteLink).inputValue();
  expect(link.startsWith(`${new URL(page.url()).origin}/?invite=`)).toBe(true);
});

When('I close the invitation dialog', async ({ page }) => {
  const dialog = page.getByTestId('create-invitation-dialog');
  await dialog.getByRole('button', { name: t.inviteDone }).click();
  await expect(dialog).toHaveCount(0);
});

When("I revoke the applicant's invitation", async ({ page, applicant }) => {
  const row = page.getByTestId(`invitation-${applicant.email}`);
  await row.getByRole('button', { name: t.invitationRevoke }).click();
  await expect(row).toHaveCount(0);
});
