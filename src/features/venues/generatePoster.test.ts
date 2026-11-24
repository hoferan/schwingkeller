import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Venue } from './types';

const { tileLayerOnceMock, createTileLayerMock, fakeMap } = vi.hoisted(() => {
  const tileLayerOnceMock = vi.fn();
  return {
    tileLayerOnceMock,
    createTileLayerMock: vi.fn(() => ({ addTo: vi.fn(), once: tileLayerOnceMock })),
    fakeMap: {
      fitBounds: vi.fn(),
      setView: vi.fn(),
      getPane: vi.fn(),
      project: vi.fn().mockReturnValue({ x: 10, y: 20 }),
      getCenter: vi.fn().mockReturnValue({ lat: 46.9, lng: 7.4 }),
      getZoom: vi.fn().mockReturnValue(10),
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
import { associationPosterSubject } from './posterSubject';
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
  v({ id: '3', canton: 'LU', name: 'Luzern', association_id: 'luzern' }),
];
const emmental = (vs: Venue[]) => associationPosterSubject('emmental', vs, associationsFor('de'));

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
    fakeMap.project.mockReturnValue({ x: 10, y: 20 });
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

  it("builds the tile layer for the given base kind and fits the map to the home bounds by default", async () => {
    await generatePosterBlob(emmental(venues), { baseKind: 'map' });

    // 'anonymous' so the tile <img>s are fetched as CORS requests — otherwise drawing them
    // onto the export canvas taints it and canvas.toBlob() throws a SecurityError in the browser.
    expect(createTileLayerMock).toHaveBeenCalledWith('map', 'anonymous');
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(ASSOCIATION_HOME_BOUNDS.emmental, { padding: [40, 40] });
    expect(fakeMap.setView).not.toHaveBeenCalled();
  });

  it("plots a pin for each of the Verband's venues and none from other Verbände", async () => {
    await generatePosterBlob(emmental(venues), { baseKind: 'map' });

    // Fixture has 2 BE venues and 1 LU venue — only the 2 BE ones should be projected/drawn,
    // plus the view centre they are placed around.
    expect(fakeMap.project).toHaveBeenCalledTimes(3);
    expect(drawPinMock).toHaveBeenCalledTimes(2);
    expect(drawTilesMock).toHaveBeenCalledTimes(1);
  });

  it('returns a PNG blob named after the Verband', async () => {
    const result = await generatePosterBlob(emmental(venues), { baseKind: 'sat' });

    expect(createTileLayerMock).toHaveBeenCalledWith('sat', 'anonymous');
    expect(result.filename).toBe('schwingkeller-emmental.png');
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
      const result = await generatePosterBlob(emmental(venues), { baseKind: 'map' });
      expect(awaited).toBe(true); // the fonts.ready promise was awaited before encoding
      expect(result.blob.type).toBe('image/png');
    } finally {
      if (original) Object.defineProperty(document, 'fonts', original);
      else delete (document as unknown as { fonts?: unknown }).fonts;
    }
  });

  it('tears down the off-screen map and detaches the container on success', async () => {
    await generatePosterBlob(emmental(venues), { baseKind: 'map' });

    expect(fakeMap.remove).toHaveBeenCalledTimes(1);
    expect(document.body.children.length).toBe(0);
  });

  it('tears down the off-screen map and container on failure too (tile timeout)', async () => {
    vi.useFakeTimers();
    tileLayerOnceMock.mockImplementation(() => {}); // 'load' never fires

    const promise = generatePosterBlob(emmental(venues), { baseKind: 'map' });
    vi.advanceTimersByTime(8000);

    await expect(promise).rejects.toThrow('[TILE_TIMEOUT]');
    expect(fakeMap.remove).toHaveBeenCalledTimes(1);
    expect(document.body.children.length).toBe(0);
    vi.useRealTimers();
  });

  describe('for a Verband', () => {
    const opts = { baseKind: 'map' } as const;
    const fr = [
      v({ id: 'f1', canton: 'FR', association_id: 'freiburg' }),
      v({ id: 'f2', canton: 'FR', association_id: 'freiburg' }),
      v({ id: 'e1', canton: 'LU', association_id: 'emmental' }),
    ];
    const freiburg = (vs: Venue[]) => associationPosterSubject('freiburg', vs, associationsFor('de'));

    it('names the file after the subject id', async () => {
      expect((await generatePosterBlob(freiburg(fr), opts)).filename).toBe('schwingkeller-freiburg.png');
    });

    it('loads no image for an association mark', async () => {
      await generatePosterBlob(freiburg(fr), { ...opts, qrDataUrl: null });
      expect(loadImageMock).not.toHaveBeenCalled();
    });

    it('passes the association mark to the overlay', async () => {
      await generatePosterBlob(freiburg(fr), opts);
      expect(drawPosterOverlayMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        name: 'Freiburg',
        mark: { tint: '#5D6B80', badge: { text: 'SWSV', colour: '#5D6B80' } },
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
    await generatePosterBlob(emmental(venues), {
      baseKind: 'map', view: { center: [46.9, 7.4], zoom: 11 },
    });
    expect(fakeMap.setView).toHaveBeenCalledWith([46.9, 7.4], 11);
    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
  });

  it('sizes the canvas to POSTER_SIZE x POSTER_SIZE when aspectRatio is omitted (defaults to square)', async () => {
    const widthSpy = vi.spyOn(HTMLCanvasElement.prototype, 'width', 'set');
    const heightSpy = vi.spyOn(HTMLCanvasElement.prototype, 'height', 'set');

    await generatePosterBlob(emmental(venues), { baseKind: 'map' });

    expect(widthSpy).toHaveBeenCalledWith(POSTER_SIZE);
    expect(heightSpy).toHaveBeenCalledWith(POSTER_SIZE);
    expect(drawPosterOverlayMock).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ posterHeight: POSTER_SIZE }),
    );
  });

  it('sizes the canvas to POSTER_SIZE x 1620 for aspectRatio "portrait"', async () => {
    const widthSpy = vi.spyOn(HTMLCanvasElement.prototype, 'width', 'set');
    const heightSpy = vi.spyOn(HTMLCanvasElement.prototype, 'height', 'set');

    await generatePosterBlob(emmental(venues), {
      baseKind: 'map', aspectRatio: 'portrait',
    });

    expect(widthSpy).toHaveBeenCalledWith(POSTER_SIZE);
    expect(heightSpy).toHaveBeenCalledWith(1620);
    expect(drawPosterOverlayMock).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ posterHeight: 1620 }),
    );
  });

  it('accepts a fractional view zoom without snapping, for soft-zoom framing', async () => {
    await generatePosterBlob(emmental(venues), {
      baseKind: 'map', view: { center: [46.9, 7.4], zoom: 12.25 },
    });
    // zoomSnap: 0 lets the off-screen map hold the editor's exact fractional zoom — otherwise
    // Leaflet would snap it to a whole level and the export would show a different area.
    expect(L.map).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ zoomSnap: 0 }));
    expect(fakeMap.setView).toHaveBeenCalledWith([46.9, 7.4], 12.25);
  });

  it('sizes the canvas to POSTER_SIZE x 720 for aspectRatio "landscape"', async () => {
    const widthSpy = vi.spyOn(HTMLCanvasElement.prototype, 'width', 'set');
    const heightSpy = vi.spyOn(HTMLCanvasElement.prototype, 'height', 'set');

    await generatePosterBlob(emmental(venues), {
      baseKind: 'map', aspectRatio: 'landscape',
    });

    expect(widthSpy).toHaveBeenCalledWith(POSTER_SIZE);
    expect(heightSpy).toHaveBeenCalledWith(720);
    expect(drawPosterOverlayMock).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ posterHeight: 720 }),
    );
  });

  it("labels each of the Verband's pins with its venue name by default", async () => {
    await generatePosterBlob(emmental(venues), { baseKind: 'map' });

    expect(drawPinLabelsMock).toHaveBeenCalledWith(
      expect.anything(),
      // Every point projects to the same pixel as the centre, so both pins sit mid-poster.
      [{ x: 540, y: 540, text: 'Bern Ost' }, { x: 540, y: 540, text: 'Thun' }],
      expect.objectContaining({ posterHeight: POSTER_SIZE }),
    );
  });

  it("projects pins at the editor's view", async () => {
    // One degree is 2^zoom px, so the venues' offsets from the centre survive unrounded.
    fakeMap.project.mockImplementation(([lat, lng]: [number, number], z: number) => ({ x: lng * 2 ** z, y: -lat * 2 ** z }));
    const view = { center: [46.8, 7.3] as [number, number], zoom: 12.25 };
    await generatePosterBlob(emmental(venues), { baseKind: 'map', view });

    const scale = 2 ** 12.25;
    const expected = { x: 540 + 0.1 * scale, y: 540 - 0.1 * scale };
    expect(drawPinMock).toHaveBeenCalledTimes(2);
    drawPinMock.mock.calls.forEach(([, x, y]) => {
      expect(x).toBeCloseTo(expected.x);
      expect(y).toBeCloseTo(expected.y);
    });
    fakeMap.project.mock.calls.forEach(([, zoom]) => expect(zoom).toBe(12.25));
  });

  it('centres the pins on a portrait poster vertically on its own height', async () => {
    // Every point projects to the centre's pixel, so each pin lands mid-poster: y = 1620 / 2.
    await generatePosterBlob(emmental(venues), { baseKind: 'map', aspectRatio: 'portrait' });

    expect(drawPinMock).toHaveBeenCalledWith(expect.anything(), 540, 810);
  });

  it("projects from the capture map's own centre and zoom when no view is given", async () => {
    await generatePosterBlob(emmental(venues), { baseKind: 'map' });

    expect(fakeMap.project).toHaveBeenCalledWith([46.9, 7.4], 10);
    fakeMap.project.mock.calls.forEach(([, zoom]) => expect(zoom).toBe(10));
  });

  it('hands the label layout the same points it drew', async () => {
    fakeMap.project.mockImplementation(([lat, lng]: [number, number]) => ({ x: lng * 100, y: -lat * 100 }));
    const spread = [v({ id: '1', name: 'Bern Ost', lat: 46.95 }), v({ id: '2', name: 'Thun', lat: 46.75, lng: 7.6 })];
    await generatePosterBlob(emmental(spread), { baseKind: 'map' });

    const drawn = drawPinMock.mock.calls.map(([, x, y]) => [x, y]);
    const labelled = drawPinLabelsMock.mock.calls[0][1].map((p: { x: number; y: number }) => [p.x, p.y]);
    expect(labelled).toEqual(drawn);
    expect(drawn[0]).not.toEqual(drawn[1]);
  });

  it('keeps the labels clear of the chrome bands and the QR code', async () => {
    // Only a QR that actually loaded is drawn, so only that one takes space away from the labels.
    loadImageMock.mockImplementation((src: string) =>
      Promise.resolve(src.startsWith('data:') ? ({} as HTMLImageElement) : null));

    await generatePosterBlob(emmental(venues), {
      baseKind: 'map', qrDataUrl: 'data:image/png;base64,x',
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
    await generatePosterBlob(emmental(venues), {
      baseKind: 'map', showLabels: false,
    });

    expect(drawPinMock).toHaveBeenCalledTimes(2);
    expect(drawPinLabelsMock).not.toHaveBeenCalled();
  });

  it('forwards the chrome position/style/size and QR corner options to drawPosterOverlay', async () => {
    await generatePosterBlob(emmental(venues), {
      baseKind: 'map',
      headerPosition: 'bottom', footerPosition: 'top', chromeStyle: 'light', chromeSize: 'compact',
      qrCorner: 'top-left',
    });

    expect(drawPosterOverlayMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      headerPosition: 'bottom', footerPosition: 'top', chromeStyle: 'light', chromeSize: 'compact',
      qrCorner: 'top-left',
    }));
  });

});
