import type { Page } from '@playwright/test';
import { STR } from '../../src/i18n/translations';
import { When, Then, expect } from '../fixtures';

const t = STR.de;

// The strip a phone shows of the closed venue list (PEEK_HEIGHT in Sidebar.tsx), and the share of
// the screen the open list takes (80vh there).
const PEEK_HEIGHT = 116;
const OPEN_SHARE = 0.8;

type Point = { x: number; y: number };

// Drags a finger from one point to another through the browser's own touch input, so the app's
// touchstart, touchmove and touchend handlers run as they do on a phone. Playwright's mobile
// presets turn touch on, but its mouse and click still send mouse events.
export const swipe = async (page: Page, from: Point, to: Point, steps = 10) => {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', point?: Point) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [point] : [] });
  await touch('touchStart', from);
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', {
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
    });
  }
  await touch('touchEnd');
  await cdp.detach();
};

const sheet = (page: Page) => page.getByTestId('sidebar-root');
const header = (page: Page) => page.getByTestId('sidebar-header');

const centreOf = async (page: Page, testId: string): Promise<Point> => {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box, `${testId} is not on screen`).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
};

// The phone layout taps the venue list's header to open it, and the tablet layout has a tab on
// the panel's edge. The desktop layout has neither, so a scenario that starts with this fails if it
// ever runs at desktop width.
Then('the map shows the {word} layout', async ({ page }, layout: string) => {
  const tab = page.getByTestId('sidebar-tablet-tab');
  if (layout === 'phone') {
    await expect(header(page)).toHaveCSS('cursor', 'pointer');
    await expect(tab).toHaveCount(0);
  } else if (layout === 'tablet') {
    await expect(tab).toBeVisible();
  } else {
    throw new Error(`no such layout: ${layout}`);
  }
});

// The sheet animates its height, so both checks wait for it to settle.
Then('the venue list is a strip at the bottom', async ({ page }) => {
  await expect.poll(async () => Math.round((await sheet(page).boundingBox())?.height ?? 0)).toBe(PEEK_HEIGHT);
});

Then('the venue list is open', async ({ page }) => {
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => Math.round((await sheet(page).boundingBox())?.height ?? 0))
    .toBe(Math.round(viewport.height * OPEN_SHARE));
});

When('I tap the header of the venue list', async ({ page }) => {
  await header(page).tap();
});

When('I drag the venue list up', async ({ page }) => {
  const from = await centreOf(page, 'sidebar-header');
  await swipe(page, from, { x: from.x, y: from.y - 400 });
});

When('I drag the venue list down', async ({ page }) => {
  const from = await centreOf(page, 'sidebar-header');
  await swipe(page, from, { x: from.x, y: from.y + 400 });
});

Then('the sign-in button shows its icon without a label', async ({ page }) => {
  const button = page.getByRole('button', { name: t.login });
  await expect(button).toBeVisible();
  await expect(button).toHaveText('');
});

Then('the map legend is closed', async ({ page }) => {
  await expect(page.getByRole('button', { name: t.legendShow })).toHaveAttribute('aria-expanded', 'false');
});
