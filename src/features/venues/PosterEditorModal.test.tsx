import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import type { Venue } from './types';

// Mock the heavy capture path — we assert wiring, not real canvas output.
// NB: vi.mock(...) factories are hoisted above all top-level statements in this file, so a plain
// `const` referenced inside a factory would be read in its temporal-dead-zone. vi.hoisted() lifts
// the variable itself alongside the mock registration (same pattern as cantonPoster.test.ts).
const { generateCantonPosterBlob } = vi.hoisted(() => ({
  generateCantonPosterBlob: vi.fn().mockResolvedValue({
    blob: new Blob(['x'], { type: 'image/png' }), filename: 'schwingkeller-be.png',
  }),
}));
vi.mock('./cantonPoster', () => ({ generateCantonPosterBlob }));

// Mock QR hook so no real qrcode/canvas runs.
vi.mock('./usePosterQr', () => ({
  usePosterQr: () => ({ url: 'https://x.app/?ctn=BE', dataUrl: 'data:image/png;base64,QR' }),
}));

// Mock Leaflet: a fake map that records center/zoom and supports the calls the editor makes.
const { fakeMap } = vi.hoisted(() => ({
  fakeMap: {
    setView: vi.fn().mockReturnThis(),
    fitBounds: vi.fn().mockReturnThis(),
    getCenter: vi.fn().mockReturnValue({ lat: 46.9, lng: 7.4 }),
    getZoom: vi.fn().mockReturnValue(11),
    setZoom: vi.fn(),
    setMaxZoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  },
}));
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => fakeMap),
    marker: vi.fn(() => ({ addTo: vi.fn() })),
    divIcon: vi.fn(() => ({})),
    layerGroup: vi.fn(() => ({ addTo: vi.fn(), clearLayers: vi.fn(), addLayer: vi.fn() })),
    // The live editor map builds its base layer via createTileLayer() (features/map/tileLayers.ts),
    // which calls L.tileLayer(...).addTo(map) — stub it so that real wiring doesn't throw. We don't
    // assert anything about tile behavior here, only that the editor renders/downloads correctly.
    tileLayer: vi.fn(() => ({ addTo: vi.fn(), once: vi.fn() })),
    // venueBoundsForCanton (posterFraming.ts, real/unmocked) calls L.latLngBounds — stub it so the
    // default-framing helper can run inside these tests. Bounds identity round-trips through the
    // points passed in, which is all the assertions below need.
    latLngBounds: vi.fn((points: [number, number][]) => ({ points })),
  },
}));

import { PosterEditorModal } from './PosterEditorModal';
import { boundsForCanton } from '../../data/cantonBounds';
import { CANTON_POSTER_MAX_DEFAULT_ZOOM } from './posterFraming';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], ...over,
});

const renderEditor = (props: Partial<Parameters<typeof PosterEditorModal>[0]> = {}) =>
  render(
    <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
      <PosterEditorModal
        code="BE"
        venues={[v({ id: '1' })]}
        initialBaseKind="map"
        unitLabel="Schwingkeller"
        onClose={vi.fn()}
        onSave={vi.fn()}
        {...props}
      />
    </I18nContext.Provider>,
  );

describe('PosterEditorModal', () => {
  beforeEach(() => { generateCantonPosterBlob.mockClear(); });

  it('renders the controls and the QR image', () => {
    renderEditor();
    expect(screen.getByLabelText(STR.de.posterTitleLabel)).toHaveValue('Bern');
    expect(screen.getByRole('img', { name: /qr/i })).toBeInTheDocument();
  });

  it('captures the preview center with a pixel-scaled zoom and reports the blob via onSave', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderEditor({ onSave });

    await user.click(screen.getByRole('button', { name: STR.de.posterDownload }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    // jsdom's window is 1024px wide, so the preview locks to 540; the export zoom is the preview
    // zoom (11) bumped by log2(1080/540) = 1, i.e. an exact integer 12, framing the same area.
    expect(generateCantonPosterBlob).toHaveBeenCalledWith('BE', expect.any(Array), expect.objectContaining({
      baseKind: 'map',
      unitLabel: 'Schwingkeller',
      view: { center: [46.9, 7.4], zoom: 12 },
      title: 'Bern',
      showHeader: true,
      showFooter: true,
      qrDataUrl: 'data:image/png;base64,QR',
    }));
    expect(onSave).toHaveBeenCalledWith(expect.any(Blob), 'schwingkeller-be.png');
  });

  it('omits qrDataUrl when the QR toggle is off', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByLabelText(STR.de.posterToggleQr));
    await user.click(screen.getByRole('button', { name: STR.de.posterDownload }));
    await waitFor(() => expect(generateCantonPosterBlob).toHaveBeenCalled());
    expect(generateCantonPosterBlob.mock.calls[0][2].qrDataUrl).toBeNull();
  });

  it('reports capture failures via onError and resets the busy state', async () => {
    generateCantonPosterBlob.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onError = vi.fn();
    renderEditor({ onSave, onError });

    const downloadButton = screen.getByRole('button', { name: STR.de.posterDownload });
    await user.click(downloadButton);

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(Error)));
    expect(onSave).not.toHaveBeenCalled();
    await waitFor(() => expect(downloadButton).not.toBeDisabled());
  });
});

describe('default framing', () => {
  // clearAllMocks (not just generateCantonPosterBlob.mockClear) — these tests assert on fakeMap
  // call counts, and fakeMap's vi.fn()s accumulate calls across every render in this file. It
  // clears recorded calls only; the mock implementations (mockReturnValue etc.) stay intact.
  beforeEach(() => { vi.clearAllMocks(); });

  it('frames the map with setView (not fitBounds) when the canton has exactly one venue', () => {
    renderEditor(); // default: 1 venue at (46.9, 7.4)
    expect(fakeMap.setView).toHaveBeenCalledWith([46.9, 7.4], CANTON_POSTER_MAX_DEFAULT_ZOOM);
    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
  });

  it('falls back to the canton bounds fit when there are no venues', () => {
    renderEditor({ venues: [] });
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(boundsForCanton('BE'), { padding: [20, 20] });
    expect(fakeMap.setView).not.toHaveBeenCalled();
  });

  it('fits to venue bounds with chrome-aware padding when there are 2+ venues', () => {
    const venues2 = [
      v({ id: '1', lat: 46.9, lng: 7.4 }),
      v({ id: '2', lat: 46.95, lng: 7.45 }),
    ];
    renderEditor({ venues: venues2 });

    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    const [bounds, options] = fakeMap.fitBounds.mock.calls[0];
    expect(bounds).toEqual({ points: [[46.9, 7.4], [46.95, 7.45]] });
    // jsdom's window is 1024px wide, so previewSize locks to 540 (see previewSizeFor); scale =
    // 540/1080 = 0.5, so headerH(190)*0.5=95 and footerH(46)*0.5=23, each plus the base 20px pad.
    expect(options).toEqual({
      paddingTopLeft: [20, 115],
      paddingBottomRight: [20, 43],
    });
    expect(fakeMap.setView).not.toHaveBeenCalled();
    expect(fakeMap.setZoom).not.toHaveBeenCalled(); // default mocked getZoom() (11) is under the cap
  });

  it('reset framing re-applies the same three-way logic as the initial mount', async () => {
    const user = userEvent.setup();
    renderEditor(); // default: 1 venue at (46.9, 7.4)
    expect(fakeMap.setView).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: STR.de.posterResetFraming }));

    expect(fakeMap.setView).toHaveBeenCalledTimes(2);
    expect(fakeMap.setView).toHaveBeenLastCalledWith([46.9, 7.4], CANTON_POSTER_MAX_DEFAULT_ZOOM);
  });

  it('caps the zoom after fitBounds overshoots for tightly clustered venues', () => {
    const venues2 = [
      v({ id: '1', lat: 46.9, lng: 7.4 }),
      v({ id: '2', lat: 46.9001, lng: 7.4001 }),
    ];
    fakeMap.getZoom.mockReturnValueOnce(16); // fitBounds would zoom in past the cap for this tight cluster
    renderEditor({ venues: venues2 });

    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(fakeMap.setZoom).toHaveBeenCalledWith(CANTON_POSTER_MAX_DEFAULT_ZOOM);
  });
});
