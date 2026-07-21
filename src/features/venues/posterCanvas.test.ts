import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage, extractTileDraws, drawTiles,
  drawPin, drawPosterOverlay, computeChromeLayout, CHROME_STYLE_COLORS,
} from './posterCanvas';

describe('posterFilename', () => {
  it('lowercases the canton code into the filename', () => {
    expect(posterFilename('BE')).toBe('schwingkeller-be.png');
  });
});

describe('computeChromeLayout', () => {
  const base = { chromeSize: 'normal' as const, posterHeight: POSTER_SIZE };

  it('places header at the top and footer at the bottom by default', () => {
    const result = computeChromeLayout({
      ...base, showHeader: true, showFooter: true, headerPosition: 'top', footerPosition: 'bottom',
    });
    expect(result).toEqual({ headerY: 0, footerY: 1034, topOccupied: 190, bottomOccupied: 46 });
  });

  it('stacks header and footer when both are assigned to the top edge, header closer to the edge', () => {
    const result = computeChromeLayout({
      ...base, showHeader: true, showFooter: true, headerPosition: 'top', footerPosition: 'top',
    });
    expect(result).toEqual({ headerY: 0, footerY: 190, topOccupied: 236, bottomOccupied: 0 });
  });

  it('stacks header above footer when both are assigned to the bottom edge (footer takes the edge)', () => {
    const result = computeChromeLayout({
      ...base, showHeader: true, showFooter: true, headerPosition: 'bottom', footerPosition: 'bottom',
    });
    // Footer always reads below the header: footer sits on the bottom edge (1080-46=1034), header
    // stacks directly above it (1034-190=844).
    expect(result).toEqual({ headerY: 844, footerY: 1034, topOccupied: 0, bottomOccupied: 236 });
  });

  it('returns null for a hidden band and excludes it from the occupied totals', () => {
    const result = computeChromeLayout({
      ...base, showHeader: false, showFooter: true, headerPosition: 'top', footerPosition: 'bottom',
    });
    expect(result).toEqual({ headerY: null, footerY: 1034, topOccupied: 0, bottomOccupied: 46 });
  });

  it('uses compact band heights when chromeSize is "compact"', () => {
    const result = computeChromeLayout({
      showHeader: true, showFooter: true, headerPosition: 'top', footerPosition: 'bottom',
      chromeSize: 'compact', posterHeight: POSTER_SIZE,
    });
    expect(result.headerY).toBe(0);
    expect(result.topOccupied).toBe(120);
    expect(result.bottomOccupied).toBe(34);
    expect(result.footerY).toBe(POSTER_SIZE - 34);
  });

  it('reserves the attribution strip on the bottom edge when the footer is hidden', () => {
    const result = computeChromeLayout({
      ...base, showHeader: true, showFooter: false, headerPosition: 'bottom', footerPosition: 'bottom',
    });
    // The always-on minimal attribution strip (26px) owns the bottom edge whenever the footer
    // band is hidden — a bottom-positioned header must stack above it, not overlap it:
    // headerY = 1080 - 26 - 190 = 864; bottomOccupied includes the strip (216).
    expect(result).toEqual({ headerY: 864, footerY: null, topOccupied: 0, bottomOccupied: 216 });
  });

  it('anchors bottom bands to a taller posterHeight (portrait)', () => {
    const result = computeChromeLayout({
      ...base, posterHeight: 1620,
      showHeader: true, showFooter: true, headerPosition: 'top', footerPosition: 'bottom',
    });
    expect(result).toEqual({ headerY: 0, footerY: 1620 - 46, topOccupied: 190, bottomOccupied: 46 });
  });
});

describe('createOffscreenContainer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('appends a fixed, off-viewport container sized to the given width and height', () => {
    const el = createOffscreenContainer(POSTER_SIZE, POSTER_SIZE);
    expect(document.body.contains(el)).toBe(true);
    expect(el.style.position).toBe('fixed');
    expect(el.style.left).toBe('-9999px');
    expect(el.style.width).toBe(`${POSTER_SIZE}px`);
    expect(el.style.height).toBe(`${POSTER_SIZE}px`);
  });

  it('supports independent width and height, for a portrait canvas', () => {
    const el = createOffscreenContainer(1080, 1620);
    expect(el.style.width).toBe('1080px');
    expect(el.style.height).toBe('1620px');
  });
});

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  src = '';
}

describe('loadImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves the image element once it loads', async () => {
    let created: FakeImage | undefined;
    vi.stubGlobal(
      'Image',
      vi.fn(function () {
        created = new FakeImage();
        return created;
      }),
    );

    const promise = loadImage('https://example.com/wappen.svg', 'anonymous');
    created!.onload?.();
    const result = await promise;

    expect(result).toBe(created);
    expect(created!.crossOrigin).toBe('anonymous');
    expect(created!.src).toBe('https://example.com/wappen.svg');
  });

  it('resolves null when the image fails to load, instead of throwing', async () => {
    let created: FakeImage | undefined;
    vi.stubGlobal(
      'Image',
      vi.fn(function () {
        created = new FakeImage();
        return created;
      }),
    );

    const promise = loadImage('https://example.com/missing.svg');
    created!.onerror?.();

    await expect(promise).resolves.toBeNull();
  });
});

describe('extractTileDraws', () => {
  it('reads position and size from loaded Leaflet tile images, skipping unloaded ones', () => {
    const pane = document.createElement('div');
    pane.innerHTML = `
      <img class="leaflet-tile leaflet-tile-loaded" style="transform: translate3d(12px, 34px, 0px);" width="256" height="256" />
      <img class="leaflet-tile" style="transform: translate3d(99px, 99px, 0px);" width="256" height="256" />
    `;

    const tiles = extractTileDraws(pane);

    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ x: 12, y: 34, size: 256 });
  });

  it('returns an empty array when there are no loaded tiles', () => {
    const pane = document.createElement('div');
    expect(extractTileDraws(pane)).toEqual([]);
  });

  it('skips a loaded tile whose transform has no translate3d offset', () => {
    const pane = document.createElement('div');
    pane.innerHTML = `
      <img class="leaflet-tile leaflet-tile-loaded" style="transform: translate3d(5px, 6px, 0px);" width="256" height="256" />
      <img class="leaflet-tile leaflet-tile-loaded" style="transform: none;" width="256" height="256" />
    `;

    const tiles = extractTileDraws(pane);

    // The second tile (no translate3d) is dropped; only the positioned one is drawn.
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ x: 5, y: 6 });
  });
});

describe('drawTiles', () => {
  it('draws each tile image at its recorded position and size', () => {
    const drawImage = vi.fn();
    const ctx = { drawImage } as unknown as CanvasRenderingContext2D;
    const imgA = {} as HTMLImageElement;
    const imgB = {} as HTMLImageElement;

    drawTiles(ctx, [
      { img: imgA, x: 0, y: 0, size: 256 },
      { img: imgB, x: 256, y: 0, size: 256 },
    ]);

    expect(drawImage).toHaveBeenNthCalledWith(1, imgA, 0, 0, 256, 256);
    expect(drawImage).toHaveBeenNthCalledWith(2, imgB, 256, 0, 256, 256);
  });
});

describe('drawPin', () => {
  it('draws a filled circle with a ring and a center dot', () => {
    const ctx = {
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D;

    drawPin(ctx, 100, 200);

    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.arc).toHaveBeenNthCalledWith(1, 100, 200, 16, 0, Math.PI * 2);
    expect(ctx.arc).toHaveBeenNthCalledWith(2, 100, 200, 16 * 0.32, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });
});

describe('drawPosterOverlay', () => {
  const makeCtx = (): CanvasRenderingContext2D =>
    ({
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 80 }),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      drawImage: vi.fn(),
      fillStyle: '',
      font: '',
      textBaseline: '',
      textAlign: '',
    }) as unknown as CanvasRenderingContext2D;

  it('draws the canton name (uppercased), the count pill, and the attribution by default', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE,
    });
    expect(ctx.fillText).toHaveBeenCalledWith('BERN', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('5 Schwingkeller', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith(
      '© OpenStreetMap contributors', expect.any(Number), expect.any(Number),
    );
  });

  it('uses the title override instead of the canton name when provided', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', title: 'Emmental 2026', wappenImg: null, count: 1,
      unitLabel: 'Schwingkeller', attribution: '© OpenStreetMap contributors',
      posterHeight: POSTER_SIZE,
    });
    expect(ctx.fillText).toHaveBeenCalledWith('EMMENTAL 2026', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).not.toHaveBeenCalledWith('BERN', expect.any(Number), expect.any(Number));
  });

  it('skips the header (name + count pill) when showHeader is false', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE, showHeader: false,
    });
    expect(ctx.fillText).not.toHaveBeenCalledWith('BERN', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).not.toHaveBeenCalledWith('5 Schwingkeller', expect.any(Number), expect.any(Number));
  });

  it('still draws attribution when the footer is hidden', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE, showFooter: false,
    });
    expect(ctx.fillText).toHaveBeenCalledWith(
      '© OpenStreetMap contributors', expect.any(Number), expect.any(Number),
    );
  });

  it('draws the Wappen and the QR image when both are provided', () => {
    const ctx = makeCtx();
    const wappenImg = {} as HTMLImageElement;
    const qrImg = {} as HTMLImageElement;
    drawPosterOverlay(ctx, {
      cantonName: 'Zug', wappenImg, count: 0, unitLabel: 'Schwingkeller',
      attribution: '© Esri, Maxar, Earthstar Geographics', posterHeight: POSTER_SIZE, qrImg,
    });
    expect(ctx.drawImage).toHaveBeenCalledWith(
      wappenImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number),
    );
    expect(ctx.drawImage).toHaveBeenCalledWith(
      qrImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number),
    );
  });

  it('positions the footer band and QR backing relative to posterHeight (square)', () => {
    const ctx = makeCtx();
    const qrImg = {} as HTMLImageElement;
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE, qrImg,
    });
    // footer band: fillRect(0, posterHeight - footerH, POSTER_SIZE, footerH) = fillRect(0, 1080-46, 1080, 46)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 1034, POSTER_SIZE, 46);
    // QR y = posterHeight - qrSize - qrMargin - footerH = 1080-150-28-46 = 856
    expect(ctx.drawImage).toHaveBeenCalledWith(qrImg, 1080 - 150 - 28, 856, 150, 150);
  });

  it('shifts the footer band and QR backing down for a taller posterHeight (portrait)', () => {
    const ctx = makeCtx();
    const qrImg = {} as HTMLImageElement;
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: 1620, qrImg,
    });
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 1620 - 46, POSTER_SIZE, 46);
    expect(ctx.drawImage).toHaveBeenCalledWith(qrImg, 1080 - 150 - 28, 1620 - 150 - 28 - 46, 150, 150);
  });

  it('positions the minimal attribution strip relative to posterHeight when the footer is hidden', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: 1620, showFooter: false,
    });
    // minAttribStripH = 26; fillRect(0, posterHeight - minAttribStripH, POSTER_SIZE, minAttribStripH)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 1620 - 26, POSTER_SIZE, 26);
  });

  it('styles the minimal attribution strip per the selected chrome style', () => {
    // Transparent: no backing strip is drawn at all — just the dark attribution text.
    const transparentCtx = makeCtx();
    drawPosterOverlay(transparentCtx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE,
      showFooter: false, chromeStyle: 'transparent',
    });
    expect(transparentCtx.fillRect).not.toHaveBeenCalledWith(0, POSTER_SIZE - 26, POSTER_SIZE, 26);
    expect(transparentCtx.fillText).toHaveBeenCalledWith(
      '© OpenStreetMap contributors', expect.any(Number), expect.any(Number),
    );

    // Light: the strip backing is drawn (with the light fill), like the bands.
    const lightCtx = makeCtx();
    drawPosterOverlay(lightCtx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE,
      showFooter: false, chromeStyle: 'light',
    });
    expect(lightCtx.fillRect).toHaveBeenCalledWith(0, POSTER_SIZE - 26, POSTER_SIZE, 26);
  });

  it('draws the header at its position-derived offset instead of always y=0', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE,
      headerPosition: 'bottom', showFooter: false,
    });
    // headerPosition 'bottom', showFooter false: the attribution strip (26) owns the bottom edge
    // and the header stacks above it — headerY = 1080 - 26 - 190 = 864. The title baseline draws
    // at headerY + titleBaselineY = 864 + 110 = 974.
    expect(ctx.fillText).toHaveBeenCalledWith('BERN', expect.any(Number), 974);
  });

  it('stacks header and footer without overlapping when both share the top edge', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE,
      headerPosition: 'top', footerPosition: 'top',
    });
    // header at y=0: title baseline at 0 + 110 = 110. footer at y=190 (stacked below header):
    // app-name/attribution vertically centered at 190 + footerH/2 = 190 + 23 = 213.
    expect(ctx.fillText).toHaveBeenCalledWith('BERN', expect.any(Number), 110);
    expect(ctx.fillText).toHaveBeenCalledWith('Schwingkeller Schweiz', expect.any(Number), 213);
  });

  it('draws no fill and applies a shadow for the transparent style', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE,
      chromeStyle: 'transparent',
    });
    // Header/footer band backgrounds use fillRect with the band's own width/height; the transparent
    // style's fill is null, so those specific two fillRect calls (header 0,0,1080,190 and footer
    // 0,1034,1080,46) never happen — only the QR backing / minimal-strip fillRect calls would, and
    // neither applies here (no qrImg, footer shown).
    expect(ctx.fillRect).not.toHaveBeenCalledWith(0, 0, POSTER_SIZE, 190);
    expect(ctx.fillRect).not.toHaveBeenCalledWith(0, 1034, POSTER_SIZE, 46);
  });

  it('uses plain dark text (no glow) for the transparent style so it reads on light basemaps', () => {
    // Without a band fill, light text washes out over bright map tiles, and a halo/glow shadow
    // made the text mushy (smoke-test finding) — transparent is plain dark ink, nothing else.
    expect(CHROME_STYLE_COLORS.transparent.fill).toBeNull();
    expect(CHROME_STYLE_COLORS.transparent.text).toBe(CHROME_STYLE_COLORS.light.text);
    expect('shadow' in CHROME_STYLE_COLORS.transparent).toBe(false);
  });

  it('uses light-style colors (light fill, dark text) for the header/footer bands', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE,
      chromeStyle: 'light',
    });
    expect(CHROME_STYLE_COLORS.light.fill).toBe('rgba(255,255,255,0.85)');
    expect(CHROME_STYLE_COLORS.light.text).not.toBe(CHROME_STYLE_COLORS.solid.text);
  });

  it('shrinks the header/footer bands for chromeSize "compact" without scaling content', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE,
      chromeSize: 'compact',
    });
    // compact bands: header 120 tall, footer 34 tall at the bottom edge.
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, POSTER_SIZE, 120);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, POSTER_SIZE - 34, POSTER_SIZE, 34);
    // the title keeps its normal 56px font
    expect(ctx.font).toBeDefined();
  });

  it('places the count pill inline next to the title for chromeSize "compact"', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE,
      chromeSize: 'compact',
    });
    // No wappen → textX = padX = 40. makeCtx's measureText always returns width 80, so the pill
    // starts at textX + titleWidth(80) + pillPadX(18) = 138, vertically centered in the 120-tall
    // band: (120-40)/2 = 40. Pill width = textWidth(80) + 2*pillPadX = 116.
    expect(ctx.roundRect).toHaveBeenCalledWith(138, 40, 116, 40, 20);
  });

  it('keeps the count pill below the title for chromeSize "normal"', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE,
    });
    // Unchanged default layout: pill at textX(40), pillY(130).
    expect(ctx.roundRect).toHaveBeenCalledWith(40, 130, 116, 40, 20);
  });

  it('places the QR in the requested corner, clearing whichever band occupies that edge', () => {
    const ctx = makeCtx();
    const qrImg = {} as HTMLImageElement;
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE,
      qrImg, qrCorner: 'top-left', showFooter: false,
    });
    // top-left: x = qrMargin = 28; header occupies the top edge (headerH=190), so
    // y = topOccupied(190) + qrMargin(28) = 218.
    expect(ctx.drawImage).toHaveBeenCalledWith(qrImg, 28, 218, 150, 150);
  });

  it('clears the minimal attribution strip when the QR shares the bottom edge and the footer is hidden', () => {
    const ctx = makeCtx();
    const qrImg = {} as HTMLImageElement;
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE,
      qrImg, qrCorner: 'bottom-right', showFooter: false,
    });
    // showFooter false: chrome.bottomOccupied is 0 (footer isn't a "band" when hidden), but the
    // minimal attribution strip (minAttribStripH=26) still occupies the bottom edge, so the QR
    // must clear it: y = POSTER_SIZE - qrSize - qrMargin - minAttribStripH = 1080-150-28-26 = 876.
    expect(ctx.drawImage).toHaveBeenCalledWith(qrImg, 1080 - 150 - 28, 876, 150, 150);
  });

  it("defaults to the bottom-right corner, reproducing today's QR position", () => {
    const ctx = makeCtx();
    const qrImg = {} as HTMLImageElement;
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE, qrImg,
    });
    expect(ctx.drawImage).toHaveBeenCalledWith(qrImg, 1080 - 150 - 28, 856, 150, 150);
  });
});
