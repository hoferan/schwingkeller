import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import QRCode from 'qrcode';
import { STR } from '../../src/i18n/translations';
import { POSTER_QR_OPTIONS } from '../../src/features/venues/posterLayout';
import { Given, When, Then, expect, tileZoomOf } from '../fixtures';
import { teilverbandOf, verbandId } from '../associations';

const t = STR.de;

const LABEL = '[data-testid="poster-preview-label"]';
const PREVIEW = '[data-testid="poster-preview-square"]';

const FORMATS = {
  square: t.posterFormatSquare,
  portrait: t.posterFormatPortrait,
  landscape: t.posterFormatLandscape,
} as const;
type Format = keyof typeof FORMATS;

const PNG_SIGNATURE = '89504e470d0a1a0a';

// A PNG's IHDR is fixed-position: 8-byte signature, 4-byte length, 'IHDR', then width and height
// as big-endian uint32s at offsets 16 and 20. Reading them needs no image library.
const pngSize = (file: string) => {
  const png = readFileSync(file);
  expect(png.subarray(0, 8).toString('hex'), `${file} is not a PNG`).toBe(PNG_SIGNATURE);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
};

interface Rect { x: number; y: number; width: number; height: number }

// Every rect read in ONE evaluation. Awaiting boundingBox() per element measures them at different
// moments, and the modal animates in with a scale transform, so elements that are side by side
// report positions that disagree, enough to fake an overlap. One frame, one set of numbers.
const readRects = (page: Page, selector: string, frameSelector?: string) =>
  page.evaluate(([sel, frameSel]) => {
    const rect = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      items: [...document.querySelectorAll(sel!)].map(rect),
      frame: frameSel ? rect(document.querySelector(frameSel)!) : null,
    };
  }, [selector, frameSelector] as const) as Promise<{ items: Rect[]; frame: Rect | null }>;

// The poster steps assert the wiring between the editor, the Leaflet map and the canvas exporter,
// the seam no jsdom test can reach. Pixel-level correctness stays in the unit tests, because the
// poster is drawn over map tiles (stubbed here).

const openPosterEditor = async (page: Page, id: string) => {
  // Venues arrive from PostgREST, and the canton rows only render once they do. The Verband rows
  // render at once, but only inside an open Teilverband.
  await expect(page.getByTestId(`generate-poster-${id}`)).toBeVisible();
  await page.getByTestId(`generate-poster-${id}`).click();
  await expect(page.getByText(t.posterEditorTitle, { exact: false })).toBeVisible();
};

Given('I open the poster editor for canton {string}', async ({ page }, canton: string) => {
  await openPosterEditor(page, canton);
});

Given('I open the poster editor for Verband {string}', async ({ page }, name: string) => {
  const id = verbandId(name);
  await page.getByTestId(`group-${teilverbandOf(id)}`).click();
  await openPosterEditor(page, id);
});

// The preview is 540px wide from a 700px screen up and 270px below (previewSizeFor in
// PosterEditorModal.tsx).
Then('the preview is {int} pixels wide', async ({ page }, width: number) => {
  await expect.poll(async () => Math.round((await page.locator(PREVIEW).boundingBox())?.width ?? 0)).toBe(width);
});

// The preview map's zoom: the level in its tiles' URLs, plus the scale Leaflet gives the tile layer
// at a fractional zoom (log2 of it). Read once the map has settled on one tile level.
Then('the preview shows the map at zoom {int}', async ({ page }, zoom: number) => {
  await expect
    .poll(async () => {
      const layers = await page.locator(`${PREVIEW} .leaflet-tile-container`).evaluateAll((els) =>
        els
          .filter((el) => el.querySelector('img.leaflet-tile-loaded'))
          .map((el) => ({
            src: el.querySelector('img.leaflet-tile')!.getAttribute('src')!,
            scale: Number(/scale\(([\d.]+)\)/.exec((el as HTMLElement).style.transform)?.[1] ?? 1),
          })));
      if (layers.length !== 1) return NaN;
      return tileZoomOf(layers[0].src)! + Math.log2(layers[0].scale);
    })
    .toBe(zoom);
});

Then('the formats square, portrait and landscape are offered', async ({ page }) => {
  for (const name of Object.values(FORMATS)) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
});

Then('the {word} format is selected', async ({ page }, format: Format) => {
  for (const [option, name] of Object.entries(FORMATS)) {
    await expect(page.getByRole('button', { name }))
      .toHaveAttribute('aria-pressed', option === format ? 'true' : 'false');
  }
});

When('I choose the {word} format', async ({ page }, format: Format) => {
  await page.getByRole('button', { name: FORMATS[format] }).click();
});

// Compared as ratios, not pixels: the modal animates in with a scale transform, so a box measured
// while that is still running is uniformly smaller. A ratio is unaffected by it.
Then('the preview has an aspect ratio of {int}:{int}', async ({ page }, width: number, height: number) => {
  const preview = page.locator(PREVIEW);
  await expect
    .poll(async () => {
      const box = (await preview.boundingBox())!;
      return box.height / box.width;
    })
    .toBeCloseTo(height / width, 1);
});

Then('the format options are on a single row', async ({ page }) => {
  // Measured in one evaluation: sequential boundingBox() calls catch the animating modal at
  // different sizes and report different tops for options that are side by side.
  const tops = await page.getByRole('button', { name: t.posterFormatSquare })
    .evaluate((button) => [...button.parentElement!.children]
      .map((option) => option.getBoundingClientRect().top));
  // Guards the assumption that the parent is the options container holding exactly the three.
  expect(tops).toHaveLength(3);
  // A segmented control that wraps drops an option onto a second row.
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(2);
});

Then('{int} venue names label the pins', async ({ page }, count: number) => {
  const labels = page.locator(LABEL);
  await expect(labels.first()).toBeVisible();
  // Exact rather than bounded: with tiles stubbed the framing is deterministic, so a change means
  // placement regressed or the seed changed, and both are worth being told about.
  await expect(labels).toHaveCount(count);
});

Then('no two names overlap', async ({ page }) => {
  const { items: placed } = await readRects(page, LABEL);
  expect(placed.length, 'no labels to compare').toBeGreaterThan(1);
  placed.forEach((a, i) => {
    placed.slice(i + 1).forEach((b, j) => {
      const overlaps = a.x < b.x + b.width && b.x < a.x + a.width
        && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlaps, `labels ${i} and ${i + j + 1} overlap`).toBe(false);
    });
  });
});

Then('every venue name lies inside the preview', async ({ page }) => {
  await expect(page.locator(LABEL).first()).toBeVisible();
  // Frame and labels in the same evaluation, so mid-animation they share one scale.
  const { items, frame } = await readRects(page, LABEL, PREVIEW);
  expect(frame).not.toBeNull();
  for (const label of items) {
    expect(label.x).toBeGreaterThanOrEqual(frame!.x - 1);
    expect(label.y).toBeGreaterThanOrEqual(frame!.y - 1);
    expect(label.x + label.width).toBeLessThanOrEqual(frame!.x + frame!.width + 1);
    expect(label.y + label.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1);
  }
});

Given('the venue names are shown', async ({ page }) => {
  await expect(page.locator(LABEL).first()).toBeVisible();
  await expect(page.getByRole('checkbox', { name: t.posterToggleLabels })).toBeChecked();
});

When('I switch the venue names off', async ({ page }) => {
  await page.getByRole('checkbox', { name: t.posterToggleLabels }).uncheck();
});

Then('no venue names are shown', async ({ page }) => {
  await expect(page.getByRole('checkbox', { name: t.posterToggleLabels })).not.toBeChecked();
  await expect(page.locator(LABEL)).toHaveCount(0);
});

// The step renders the QR code it expects with the app's own options and compares it with the one
// in the preview. Node's qrcode writes its PNG with pngjs and the browser's with a canvas, so the
// bytes differ even for the same link, but the pixels don't: both images are decoded in the page and
// compared pixel by pixel.
Then('the QR code links to {string}', async ({ page, baseURL }, path: string) => {
  expect(baseURL, 'the project sets no baseURL').toBeDefined();
  const qr = page.getByRole('img', { name: 'QR', exact: true });
  await expect(qr).toBeVisible();
  const shown = (await qr.getAttribute('src'))!;
  const expected = await QRCode.toDataURL(new URL(path, baseURL).href, POSTER_QR_OPTIONS);
  const { sizes, differing } = await page.evaluate(async ([a, b]) => {
    const decode = async (src: string) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return { size: `${canvas.width}x${canvas.height}`, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
    };
    const [x, y] = await Promise.all([decode(a), decode(b)]);
    let count = 0;
    if (x.data.length === y.data.length) x.data.forEach((v, i) => { if (v !== y.data[i]) count += 1; });
    return { sizes: [x.size, y.size], differing: count };
  }, [shown, expected] as const);
  expect(sizes[0], 'size of the QR code').toBe(sizes[1]);
  expect(differing, 'pixel values that differ from the expected QR code').toBe(0);
});

When('I download the poster', async ({ page, posterDownload, tileZooms }) => {
  // The editor closes once the file is saved, so the preview's zoom is read now. Every tile on the
  // page has to have loaded first: the stub notes a tile when its request reaches it, which can be
  // later than the img appears, and a late preview tile would count as one of the export's.
  const previewTiles = page.locator(`${PREVIEW} img.leaflet-tile`);
  await expect(previewTiles.first()).toBeVisible();
  await expect(page.locator('img.leaflet-tile:not(.leaflet-tile-loaded)')).toHaveCount(0);
  const sources = await previewTiles.evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).src));
  posterDownload.previewZooms = [...new Set(sources.map(tileZoomOf))];
  posterDownload.tilesBefore = tileZooms.length;
  const started = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: t.posterDownload }).click();
  posterDownload.current = await started;
  posterDownload.tilesAfter = tileZooms.length;
});

Then('I get the file {string}', async ({ posterDownload }, name: string) => {
  expect(posterDownload.current, 'no download was started').toBeDefined();
  expect(posterDownload.current!.suggestedFilename()).toBe(name);
});

// Asserting the exported pixels is the only check that the chosen format survives the whole trip:
// editor state, the off-screen capture map and the canvas. A file size would not catch an export
// that came out square.
Then('it is a {int}x{int} PNG', async ({ posterDownload }, width: number, height: number) => {
  expect(pngSize(await posterDownload.current!.path())).toEqual({ width, height });
});

// The export map is the preview drawn 1080px wide, so it has to sit log2(1080 / preview width)
// zoom levels above the preview: 1 at the 540px preview, 2 at the 270px one on a phone. The tiles
// requested between the download click and the file are the export's. The download step read the
// preview's.
Then(/^the export draws its map (\d+) zoom levels? above the preview$/, async ({ posterDownload, tileZooms }, levels: string) => {
  const { previewZooms, tilesBefore, tilesAfter } = posterDownload;
  expect(previewZooms, 'zoom of the preview tiles').toHaveLength(1);
  const exportZooms = [...new Set(tileZooms.slice(tilesBefore, tilesAfter))];
  expect(exportZooms, 'zoom of the tiles fetched for the export').toEqual([previewZooms![0]! + Number(levels)]);
});
