import type { Locator, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { STR } from '../src/i18n/translations';
import { test, expect, DENSE_CANTON } from './fixtures';

const t = STR.de;

const LABEL = '[data-testid="poster-preview-label"]';

const openPosterEditor = async (page: Page, canton: string) => {
  await page.goto('/');
  // Venues arrive from PostgREST, and the canton rows only render once they do.
  await expect(page.getByTestId(`generate-poster-${canton}`)).toBeVisible();
  await page.getByTestId(`generate-poster-${canton}`).click();
  await expect(page.getByText(t.posterEditorTitle, { exact: false })).toBeVisible();
};

const PNG_SIGNATURE = '89504e470d0a1a0a';

// A PNG's IHDR is fixed-position: 8-byte signature, 4-byte length, 'IHDR', then width and height
// as big-endian uint32s at offsets 16 and 20. Reading them needs no image library.
const pngSize = (file: string) => {
  const png = readFileSync(file);
  expect(png.subarray(0, 8).toString('hex'), `${file} is not a PNG`).toBe(PNG_SIGNATURE);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
};

const boxes = async (locator: Locator) => {
  const found = await locator.all();
  return Promise.all(found.map(async (one) => {
    const box = await one.boundingBox();
    if (!box) throw new Error('a preview label had no bounding box');
    return box;
  }));
};

// The smoke path an admin actually walks: unlock, open a canton's poster, choose a format, decide
// whether names show, download the PNG. It asserts the wiring between the editor, the Leaflet map
// and the canvas exporter — the seam no jsdom test can reach. Pixel-level correctness stays in the
// unit tests, because this poster is drawn over live OpenStreetMap tiles.
test.describe('canton poster editor', () => {
  test('offers all three formats and switches the preview to 3:2 for landscape', async ({ page }) => {
    await openPosterEditor(page, DENSE_CANTON);

    const square = page.getByRole('button', { name: t.posterFormatSquare });
    const landscape = page.getByRole('button', { name: t.posterFormatLandscape });
    await expect(square).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: t.posterFormatPortrait })).toBeVisible();
    await expect(landscape).toHaveAttribute('aria-pressed', 'false');

    // Compared as ratios, not pixels: the modal animates in with a scale transform, so a box
    // measured while that is still running is uniformly smaller. A ratio is unaffected by it.
    const preview = page.getByTestId('poster-preview-square');
    const aspect = async () => {
      const box = (await preview.boundingBox())!;
      return box.height / box.width;
    };
    expect(await aspect()).toBeCloseTo(1, 1);

    await landscape.click();

    await expect(landscape).toHaveAttribute('aria-pressed', 'true');
    await expect(square).toHaveAttribute('aria-pressed', 'false');
    expect(await aspect()).toBeCloseTo(2 / 3, 1);
  });

  test('labels the pins without ever overlapping another label', async ({ page }) => {
    await openPosterEditor(page, DENSE_CANTON);

    const labels = page.locator(LABEL);
    await expect(labels.first()).toBeVisible();

    // Fribourg seeds 11 venues; some names legitimately get dropped where nothing fits, so the
    // count is bounded rather than exact. What must always hold is that no two survivors collide.
    const count = await labels.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(11);

    const placed = await boxes(labels);
    placed.forEach((a, i) => {
      placed.slice(i + 1).forEach((b) => {
        const overlaps = a.x < b.x + b.width && b.x < a.x + a.width
          && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlaps, `labels ${i} and ${i + 1} overlap`).toBe(false);
      });
    });
  });

  test('keeps every label inside the preview', async ({ page }) => {
    await openPosterEditor(page, DENSE_CANTON);
    await expect(page.locator(LABEL).first()).toBeVisible();

    const frame = (await page.getByTestId('poster-preview-square').boundingBox())!;

    for (const label of await boxes(page.locator(LABEL))) {
      expect(label.x).toBeGreaterThanOrEqual(frame.x - 1);
      expect(label.y).toBeGreaterThanOrEqual(frame.y - 1);
      expect(label.x + label.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
      expect(label.y + label.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
    }
  });

  test('removes the names when the toggle is switched off', async ({ page }) => {
    await openPosterEditor(page, DENSE_CANTON);
    await expect(page.locator(LABEL).first()).toBeVisible();

    // The checkbox itself is a zero-opacity input under the visible knob, which swallows the
    // click, so drive it by its label the way a person would.
    const names = page.getByRole('checkbox', { name: t.posterToggleLabels });
    await expect(names).toBeChecked();
    await page.getByText(t.posterToggleLabels, { exact: true }).click();

    await expect(names).not.toBeChecked();
    await expect(page.locator(LABEL)).toHaveCount(0);
  });

  // Asserting the exported pixels is the only check that the chosen format survives the whole
  // trip: editor state, generateCantonPosterBlob, the off-screen capture map and the canvas. A
  // file size would not catch an export that came out square.
  const exportCases = [
    { name: t.posterFormatLandscape, width: 1080, height: 720 },
    { name: t.posterFormatSquare, width: 1080, height: 1080 },
  ];

  for (const { name, width, height } of exportCases) {
    test(`exports a ${width}x${height} PNG named after the canton for ${name}`, async ({ page }) => {
      await openPosterEditor(page, DENSE_CANTON);
      await page.getByRole('button', { name }).click();

      const started = page.waitForEvent('download', { timeout: 60_000 });
      await page.getByRole('button', { name: t.posterDownload }).click();
      const file = await started;

      expect(file.suggestedFilename()).toBe(`schwingkeller-${DENSE_CANTON.toLowerCase()}.png`);
      expect(pngSize(await file.path())).toEqual({ width, height });
    });
  }
});
