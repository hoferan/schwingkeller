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
    invalidateSize: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
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
  },
}));

import { PosterEditorModal } from './PosterEditorModal';

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
