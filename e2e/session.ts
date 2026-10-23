import type { Locator, Page } from '@playwright/test';
import { STR } from '../src/i18n/translations';

const t = STR.de;

// The top-bar control a signed-in session gets: the lock button, or the account menu where the
// editors flag is on. Waiting for it shows that the session is live in either bundle.
export const sessionControl = (page: Page): Locator =>
  page
    .getByRole('button', { name: t.logout, exact: true })
    .or(page.getByRole('button', { name: t.accountMenu, exact: true }));
