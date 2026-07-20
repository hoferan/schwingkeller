import { describe, it, expect, vi, afterEach } from 'vitest';
import { POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage, extractTileDraws, drawTiles, drawPin, drawPosterOverlay } from './posterCanvas';

describe('posterFilename', () => {
  it('lowercases the canton code into the filename', () => {
    expect(posterFilename('BE')).toBe('schwingkeller-be.png');
  });
});

describe('createOffscreenContainer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('appends a fixed, off-viewport container sized to POSTER_SIZE by default', () => {
    const el = createOffscreenContainer();
    expect(document.body.contains(el)).toBe(true);
    expect(el.style.position).toBe('fixed');
    expect(el.style.left).toBe('-9999px');
    expect(el.style.width).toBe(`${POSTER_SIZE}px`);
    expect(el.style.height).toBe(`${POSTER_SIZE}px`);
  });

  it('honors a custom size', () => {
    const el = createOffscreenContainer(500);
    expect(el.style.width).toBe('500px');
    expect(el.style.height).toBe('500px');
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
      attribution: '© OpenStreetMap contributors',
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
    });
    expect(ctx.fillText).toHaveBeenCalledWith('EMMENTAL 2026', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).not.toHaveBeenCalledWith('BERN', expect.any(Number), expect.any(Number));
  });

  it('skips the header (name + count pill) when showHeader is false', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', showHeader: false,
    });
    expect(ctx.fillText).not.toHaveBeenCalledWith('BERN', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).not.toHaveBeenCalledWith('5 Schwingkeller', expect.any(Number), expect.any(Number));
  });

  it('still draws attribution when the footer is hidden', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', showFooter: false,
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
      attribution: '© Esri, Maxar, Earthstar Geographics', qrImg,
    });
    expect(ctx.drawImage).toHaveBeenCalledWith(
      wappenImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number),
    );
    expect(ctx.drawImage).toHaveBeenCalledWith(
      qrImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number),
    );
  });
});
