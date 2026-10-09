import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Venue } from './types';
import { boundsForCanton } from '../../data/cantonBounds';

const { tileLayerOnceMock, createTileLayerMock, fakeMap } = vi.hoisted(() => {
  const tileLayerOnceMock = vi.fn();
  return {
    tileLayerOnceMock,
    createTileLayerMock: vi.fn(() => ({ addTo: vi.fn(), once: tileLayerOnceMock })),
    fakeMap: {
      fitBounds: vi.fn(),
      setView: vi.fn(),
      getPane: vi.fn(),
      latLngToContainerPoint: vi.fn().mockReturnValue({ x: 10, y: 20 }),
      remove: vi.fn(),
    },
  };
});

vi.mock('leaflet', () => ({
  default: { map: vi.fn(() => fakeMap) },
}));

vi.mock('../map/tileLayers', async () => {
  const actual = await vi.importActual<typeof import('../map/tileLayers')>('../map/tileLayers');
  return { ...actual, createTileLayer: createTileLayerMock };
});

const {
  drawTilesMock, drawPinMock, drawPinLabelsMock, drawPosterOverlayMock, extractTileDrawsMock,
  loadImageMock,
} = vi.hoisted(() => ({
  loadImageMock: vi.fn().mockResolvedValue(null),
  drawTilesMock: vi.fn(),
  drawPinMock: vi.fn(),
  drawPinLabelsMock: vi.fn().mockReturnValue([]),
  drawPosterOverlayMock: vi.fn(),
  extractTileDrawsMock: vi.fn().mockReturnValue([]),
}));
vi.mock('./posterCanvas', async () => {
  const actual = await vi.importActual<typeof import('./posterCanvas')>('./posterCanvas');
  return {
    ...actual,
    loadImage: loadImageMock,
    drawTiles: drawTilesMock,
    drawPin: drawPinMock,
    drawPinLabels: drawPinLabelsMock,
    drawPosterOverlay: drawPosterOverlayMock,
    extractTileDraws: extractTileDrawsMock,
  };
});

import L from 'leaflet';
import { generatePosterBlob, waitForTilesLoad } from './generatePoster';
import { associationPosterSubject, cantonPosterSubject } from './posterSubject';
import { associationsFor } from '../associations/useAssociations';
import { ASSOCIATION_HOME_BOUNDS } from '../../data/associationBounds';
import { POSTER_SIZE } from './posterLayout';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: 'emmental', ...over,
});
const venues = [
  v({ id: '1', canton: 'BE', name: 'Bern Ost' }),
  v({ id: '2', canton: 'BE', name: 'Thun' }),
  v({ id: '3', canton: 'LU', name: 'Luzern' }),
];

describe('waitForTilesLoad', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves once the layer fires "load"', async () => {
    const handlers: Record<string, () => void> = {};
    const layer = { once: (evt: string, cb: () => void) => { handlers[evt] = cb; } };

    const promise = waitForTilesLoad(layer, 5000);
    handlers.load();

    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects with a [TILE_TIMEOUT] error if "load" never fires in time', async () => {
    vi.useFakeTimers();
    const layer = { once: vi.fn() };

    const promise = waitForTilesLoad(layer, 5000);
    vi.advanceTimersByTime(5000);

    await expect(promise).rejects.toThrow('[TILE_TIMEOUT]');
  });
});

describe('generatePosterBlob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    fakeMap.getPane.mockReturnValue(document.createElement('div'));
    fakeMap.latLngToContainerPoint.mockReturnValue({ x: 10, y: 20 });
    tileLayerOnceMock.mockImplementation((evt: string, cb: () => void) => { if (evt === 'load') cb(); });
    extractTileDrawsMock.mockReturnValue([]);
    loadImageMock.mockResolvedValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement, cb: BlobCallback,
    ) {
      cb(new Blob(['x'], { type: 'image/png' }));
    });
  });

  it("builds the tile layer for the given base kind and fits the map to the canton's bounds by default", async () => {
    await generatePosterBlob(cantonPosterSubject('BE', venues), { baseKind: 'map', unitLabel: 'Schwingkeller' });

    // 'anonymous' so the tile <img>s are fetched as CORS requests — otherwise drawing them
    // onto the export canvas taints it and canvas.toBlob() throws a SecurityError in the browser.
    expect(createTileLayerMock).toHaveBeenCalledWith('map', 'anonymous');
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(boundsForCanton('BE'), { padding: [40, 40] });
    expect(fakeMap.setView).not.toHaveBeenCalled();
  });

  it("plots a pin for each of the canton's venues and none from other cantons", async () => {
    await generatePosterBlob(cantonPosterSubject('BE', venues), { baseKind: 'map', unitLabel: 'Schwingkeller' });

    // Fixture has 2 BE venues and 1 LU venue — only the 2 BE ones should be projected/drawn.
    expect(fakeMap.latLngToContainerPoint).toHaveBeenCalledTimes(2);
    expect(drawPinMock).toHaveBeenCalledTimes(2);
    expect(drawTilesMock).toHaveBeenCalledTimes(1);
  });

  it('returns a PNG blob and the lowercase-canton filename', async () => {
    const result = await generatePosterBlob(cantonPosterSubject('BE', venues), { baseKind: 'sat', unitLabel: 'Schwingkeller' });

    expect(createTileLayerMock).toHaveBeenCalledWith('sat', 'anonymous');
    expect(result.filename).toBe('schwingkeller-be.png');
    expect(result.blob.type).toBe('image/png');
  });

  it('waits for document.fonts.ready when the Font Loading API is available', async () => {
    const original = Object.getOwnPropertyDescriptor(document, 'fonts');
    let awaited = false;
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve().then(() => { awaited = true; }) },
      configurable: true,
    });
    try {
      const result = await generatePosterBlob(cantonPosterSubject('BE', venues), { baseKind: 'map', unitLabel: 'Schwingkeller' });
      expect(awaited).toBe(true); // the fonts.ready promise was awaited before encoding
      expect(result.blob.type).toBe('image/png');
    } finally {
      if (original) Object.defineProperty(document, 'fonts', original);
      else delete (document as unknown as { fonts?: unknown }).fonts;
    }
  });

  it('tears down the off-screen map and detaches the container on success', async () => {
    await generatePosterBlob(cantonPosterSubject('BE', venues), { baseKind: 'map', unitLabel: 'Schwingkeller' });

    expect(fakeMap.remove).toHaveBeenCalledTimes(1);
    expect(document.body.children.length).toBe(0);
  });

  it('tears down the off-screen map and container on failure too (tile timeout)', async () => {
    vi.useFakeTimers();
    tileLayerOnceMock.mockImplementation(() => {}); // 'load' never fires

    const promise = generatePosterBlob(cantonPosterSubject('BE', venues), { baseKind: 'map', unitLabel: 'Schwingkeller' });
    vi.advanceTimersByTime(8000);

    await expect(promise).rejects.toThrow('[TILE_TIMEOUT]');
    expect(fakeMap.remove).toHaveBeenCalledTimes(1);
    expect(document.body.children.length).toBe(0);
    vi.useRealTimers();
  });

  describe('for a Verband', () => {
    const opts = { baseKind: 'map', unitLabel: 'Schwingkeller' } as const;
    const fr = [
      v({ id: 'f1', canton: 'FR', association_id: 'freiburg' }),
      v({ id: 'f2', canton: 'FR', association_id: 'freiburg' }),
      v({ id: 'e1', canton: 'LU', association_id: 'emmental' }),
    ];
    const freiburg = (vs: Venue[]) => associationPosterSubject('freiburg', vs, associationsFor('de'));

    it('names the file after the subject id', async () => {
      expect((await generatePosterBlob(freiburg(fr), opts)).filename).toBe('schwingkeller-freiburg.png');
      expect((await generatePosterBlob(cantonPosterSubject('FR', fr), opts)).filename).toBe('schwingkeller-fr.png');
    });

    it('loads no image for an association mark', async () => {
      await generatePosterBlob(freiburg(fr), { ...opts, qrDataUrl: null });
      expect(loadImageMock).not.toHaveBeenCalled();
    });

    it('passes the association mark and a null count to the overlay', async () => {
      await generatePosterBlob(freiburg(fr), opts);
      expect(drawPosterOverlayMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        name: 'Freiburg',
        count: null,
        mark: { kind: 'association', tint: '#5D6B80', badge: { text: 'SWSV', colour: '#5D6B80' } },
      }));
    });

    it('fits the home bounds and draws no pins when the Verband has no venues', async () => {
      const empty = associationPosterSubject('berner-jura', [], associationsFor('de'));
      await generatePosterBlob(empty, opts);
      expect(fakeMap.fitBounds).toHaveBeenCalledWith(ASSOCIATION_HOME_BOUNDS['berner-jura'], { padding: [40, 40] });
      expect(drawPinMock).not.toHaveBeenCalled();
    });

    it('pins exactly the subject venues, whatever their canton', async () => {
      await generatePosterBlob(associationPosterSubject('emmental', fr, associationsFor('de')), opts);
      expect(drawPinMock).toHaveBeenCalledTimes(1);
    });
  });

  it('uses setView (not fitBounds) when an explicit view is supplied', async () => {
    await generatePosterBlob(cantonPosterSubject('BE', venues), {
      baseKind: 'map', unitLabel: 'Schwingkeller', view: { center: [46.9, 7.4], zoom: 11 },
    });
    expect(fakeMap.setView).toHaveBeenCalledWith([46.9, 7.4], 11);
    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
  });

  it('sizes the canvas to POSTER_SIZE x POSTER_SIZE when aspectRatio is omitted (defaults to square)', async () => {
    const widthSpy = vi.spyOn(HTMLCanvasElement.prototype, 'width', 'set');
    const heightSpy = vi.spyOn(HTMLCanvasElement.prototype, 'height', 'set');

    await generatePosterBlob(cantonPosterSubject('BE', venues), { baseKind: 'map', unitLabel: 'Schwingkeller' });

    expect(widthSpy).toHaveBeenCalledWith(POSTER_SIZE);
    expect(heightSpy).toHaveBeenCalledWith(POSTER_SIZE);
    expect(drawPosterOverlayMock).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ posterHeight: POSTER_SIZE }),
    );
  });

  it('sizes the canvas to POSTER_SIZE x 1620 for aspectRatio "portrait"', async () => {
    const widthSpy = vi.spyOn(HTMLCanvasElement.prototype, 'width', 'set');
    const heightSpy = vi.spyOn(HTMLCanvasElement.prototype, 'height', 'set');

    await generatePosterBlob(cantonPosterSubject('BE', venues), {
      baseKind: 'map', unitLabel: 'Schwingkeller', aspectRatio: 'portrait',
    });

    expect(widthSpy).toHaveBeenCalledWith(POSTER_SIZE);
    expect(heightSpy).toHaveBeenCalledWith(1620);
    expect(drawPosterOverlayMock).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ posterHeight: 1620 }),
    );
  });

  it('accepts a fractional view zoom without snapping, for soft-zoom framing', async () => {
    await generatePosterBlob(cantonPosterSubject('BE', venues), {
      baseKind: 'map', unitLabel: 'Schwingkeller', view: { center: [46.9, 7.4], zoom: 12.25 },
    });
    // zoomSnap: 0 lets the off-screen map hold the editor's exact fractional zoom — otherwise
    // Leaflet would snap it to a whole level and the export would show a different area.
    expect(L.map).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ zoomSnap: 0 }));
    expect(fakeMap.setView).toHaveBeenCalledWith([46.9, 7.4], 12.25);
  });

  it('sizes the canvas to POSTER_SIZE x 720 for aspectRatio "landscape"', async () => {
    const widthSpy = vi.spyOn(HTMLCanvasElement.prototype, 'width', 'set');
    const heightSpy = vi.spyOn(HTMLCanvasElement.prototype, 'height', 'set');

    await generatePosterBlob(cantonPosterSubject('BE', venues), {
      baseKind: 'map', unitLabel: 'Schwingkeller', aspectRatio: 'landscape',
    });

    expect(widthSpy).toHaveBeenCalledWith(POSTER_SIZE);
    expect(heightSpy).toHaveBeenCalledWith(720);
    expect(drawPosterOverlayMock).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ posterHeight: 720 }),
    );
  });

  it("labels each of the canton's pins with its venue name by default", async () => {
    await generatePosterBlob(cantonPosterSubject('BE', venues), { baseKind: 'map', unitLabel: 'Schwingkeller' });

    expect(drawPinLabelsMock).toHaveBeenCalledWith(
      expect.anything(),
      [{ x: 10, y: 20, text: 'Bern Ost' }, { x: 10, y: 20, text: 'Thun' }],
      expect.objectContaining({ posterHeight: POSTER_SIZE }),
    );
  });

  it('keeps the labels clear of the chrome bands and the QR code', async () => {
    // Only a QR that actually loaded is drawn, so only that one takes space away from the labels.
    loadImageMock.mockImplementation((src: string) =>
      Promise.resolve(src.startsWith('data:') ? ({} as HTMLImageElement) : null));

    await generatePosterBlob(cantonPosterSubject('BE', venues), {
      baseKind: 'map', unitLabel: 'Schwingkeller', qrDataUrl: 'data:image/png;base64,x',
    });

    const [, , opts] = drawPinLabelsMock.mock.calls[0];
    // Header band (0..190), footer band (1034..1080), and the bottom-right QR box.
    expect(opts.obstacles).toEqual([
      { x: 0, y: 0, w: POSTER_SIZE, h: 190 },
      { x: 0, y: 1034, w: POSTER_SIZE, h: 46 },
      { x: 1080 - 150 - 28, y: 856, w: 150, h: 150 },
    ]);
  });

  it('draws no labels when showLabels is false', async () => {
    await generatePosterBlob(cantonPosterSubject('BE', venues), {
      baseKind: 'map', unitLabel: 'Schwingkeller', showLabels: false,
    });

    expect(drawPinMock).toHaveBeenCalledTimes(2);
    expect(drawPinLabelsMock).not.toHaveBeenCalled();
  });

  it('forwards the chrome position/style/size and QR corner options to drawPosterOverlay', async () => {
    await generatePosterBlob(cantonPosterSubject('BE', venues), {
      baseKind: 'map', unitLabel: 'Schwingkeller',
      headerPosition: 'bottom', footerPosition: 'top', chromeStyle: 'light', chromeSize: 'compact',
      qrCorner: 'top-left',
    });

    expect(drawPosterOverlayMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      headerPosition: 'bottom', footerPosition: 'top', chromeStyle: 'light', chromeSize: 'compact',
      qrCorner: 'top-left',
    }));
  });

});
