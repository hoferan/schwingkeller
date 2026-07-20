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

const { drawTilesMock, drawPinMock, drawPosterOverlayMock, extractTileDrawsMock } = vi.hoisted(() => ({
  drawTilesMock: vi.fn(),
  drawPinMock: vi.fn(),
  drawPosterOverlayMock: vi.fn(),
  extractTileDrawsMock: vi.fn().mockReturnValue([]),
}));
vi.mock('./posterCanvas', async () => {
  const actual = await vi.importActual<typeof import('./posterCanvas')>('./posterCanvas');
  return {
    ...actual,
    loadImage: vi.fn().mockResolvedValue(null),
    drawTiles: drawTilesMock,
    drawPin: drawPinMock,
    drawPosterOverlay: drawPosterOverlayMock,
    extractTileDraws: extractTileDrawsMock,
  };
});

import { generateCantonPosterBlob, waitForTilesLoad } from './cantonPoster';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], ...over,
});
const venues = [v({ id: '1', canton: 'BE' }), v({ id: '2', canton: 'BE' }), v({ id: '3', canton: 'LU' })];

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

describe('generateCantonPosterBlob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    fakeMap.getPane.mockReturnValue(document.createElement('div'));
    fakeMap.latLngToContainerPoint.mockReturnValue({ x: 10, y: 20 });
    tileLayerOnceMock.mockImplementation((evt: string, cb: () => void) => { if (evt === 'load') cb(); });
    extractTileDrawsMock.mockReturnValue([]);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement, cb: BlobCallback,
    ) {
      cb(new Blob(['x'], { type: 'image/png' }));
    });
  });

  it("builds the tile layer for the given base kind and fits the map to the canton's bounds by default", async () => {
    await generateCantonPosterBlob('BE', venues, { baseKind: 'map', unitLabel: 'Schwingkeller' });

    // 'anonymous' so the tile <img>s are fetched as CORS requests — otherwise drawing them
    // onto the export canvas taints it and canvas.toBlob() throws a SecurityError in the browser.
    expect(createTileLayerMock).toHaveBeenCalledWith('map', 'anonymous');
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(boundsForCanton('BE'), { padding: [40, 40] });
    expect(fakeMap.setView).not.toHaveBeenCalled();
  });

  it("plots a pin for each of the canton's venues and none from other cantons", async () => {
    await generateCantonPosterBlob('BE', venues, { baseKind: 'map', unitLabel: 'Schwingkeller' });

    // Fixture has 2 BE venues and 1 LU venue — only the 2 BE ones should be projected/drawn.
    expect(fakeMap.latLngToContainerPoint).toHaveBeenCalledTimes(2);
    expect(drawPinMock).toHaveBeenCalledTimes(2);
    expect(drawTilesMock).toHaveBeenCalledTimes(1);
  });

  it('returns a PNG blob and the lowercase-canton filename', async () => {
    const result = await generateCantonPosterBlob('BE', venues, { baseKind: 'sat', unitLabel: 'Schwingkeller' });

    expect(createTileLayerMock).toHaveBeenCalledWith('sat', 'anonymous');
    expect(result.filename).toBe('schwingkeller-be.png');
    expect(result.blob.type).toBe('image/png');
  });

  it('tears down the off-screen map and detaches the container on success', async () => {
    await generateCantonPosterBlob('BE', venues, { baseKind: 'map', unitLabel: 'Schwingkeller' });

    expect(fakeMap.remove).toHaveBeenCalledTimes(1);
    expect(document.body.children.length).toBe(0);
  });

  it('tears down the off-screen map and container on failure too (tile timeout)', async () => {
    vi.useFakeTimers();
    tileLayerOnceMock.mockImplementation(() => {}); // 'load' never fires

    const promise = generateCantonPosterBlob('BE', venues, { baseKind: 'map', unitLabel: 'Schwingkeller' });
    vi.advanceTimersByTime(8000);

    await expect(promise).rejects.toThrow('[TILE_TIMEOUT]');
    expect(fakeMap.remove).toHaveBeenCalledTimes(1);
    expect(document.body.children.length).toBe(0);
    vi.useRealTimers();
  });

  it('rejects with [UNKNOWN_CANTON] for an unrecognized code', async () => {
    await expect(generateCantonPosterBlob('XX', venues, { baseKind: 'map', unitLabel: 'Schwingkeller' }))
      .rejects.toThrow('[UNKNOWN_CANTON]');
  });

  it('uses setView (not fitBounds) when an explicit view is supplied', async () => {
    await generateCantonPosterBlob('BE', venues, {
      baseKind: 'map', unitLabel: 'Schwingkeller', view: { center: [46.9, 7.4], zoom: 11 },
    });
    expect(fakeMap.setView).toHaveBeenCalledWith([46.9, 7.4], 11);
    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
  });

  it('fits the supplied viewBounds exactly (padding 0) and does not setView, when viewBounds given', async () => {
    const viewBounds: [[number, number], [number, number]] = [[46.5, 7.0], [47.2, 7.9]];
    await generateCantonPosterBlob('BE', venues, {
      baseKind: 'map', unitLabel: 'Schwingkeller', viewBounds,
    });
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(viewBounds, { padding: [0, 0] });
    expect(fakeMap.setView).not.toHaveBeenCalled();
  });
});
