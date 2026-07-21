import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
    invalidateSize: vi.fn(),
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
// Real (unmocked) modules — computeChromeLayout has no Leaflet dependency, so importing it
// directly alongside this file's `leaflet` mock is safe.
import { computeChromeLayout } from './posterCanvas';
import { cqw, POSTER_SIZE } from './posterLayout';

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

describe('aspect ratio', () => {
  // clearAllMocks for the same reason as the 'default framing' block above: these tests assert on
  // fakeMap call counts, which otherwise accumulate across every render in this file.
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders Square and Portrait controls, defaulting to Square', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: STR.de.posterFormatSquare })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: STR.de.posterFormatPortrait })).toHaveAttribute('aria-pressed', 'false');
  });

  it('resizes the preview container height when switching to Portrait, without moving the map', async () => {
    const user = userEvent.setup();
    renderEditor();
    const previewSquare = screen.getByTestId('poster-preview-square');
    expect(previewSquare).toHaveStyle({ width: '540px', height: '540px' });

    // Mount-time default framing (sub-project A) legitimately calls setView/fitBounds once; clear
    // those so the assertions below isolate what the Portrait toggle itself does.
    fakeMap.setView.mockClear();
    fakeMap.fitBounds.mockClear();

    await user.click(screen.getByRole('button', { name: STR.de.posterFormatPortrait }));

    expect(previewSquare).toHaveStyle({ width: '540px', height: '810px' });
    expect(fakeMap.invalidateSize).toHaveBeenCalledTimes(1);
    expect(fakeMap.setView).not.toHaveBeenCalled();
    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
  });

  it('forwards the current aspectRatio to generateCantonPosterBlob', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: STR.de.posterFormatPortrait }));
    await user.click(screen.getByRole('button', { name: STR.de.posterDownload }));
    await waitFor(() => expect(generateCantonPosterBlob).toHaveBeenCalled());
    expect(generateCantonPosterBlob.mock.calls[0][2]).toMatchObject({ aspectRatio: 'portrait' });
  });
});

describe('header/footer customization controls', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders position, style, size, and QR-corner controls with today's defaults selected", () => {
    renderEditor();
    // Both the header-position and footer-position pickers render a "Oben" (Top) button, so this
    // just confirms both pickers are present rather than asserting on a single ambiguous match.
    expect(screen.getAllByRole('button', { name: STR.de.posterPositionTop })).toHaveLength(2);
    expect(screen.getByRole('button', { name: STR.de.posterStyleSolid })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: STR.de.posterSizeNormal })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: STR.de.posterQrCornerBottomRight })).toHaveAttribute('aria-pressed', 'true');
  });

  it('forwards the current header/footer/style/size/QR-corner selections to generateCantonPosterBlob', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: STR.de.posterStyleTransparent }));
    await user.click(screen.getByRole('button', { name: STR.de.posterSizeCompact }));
    await user.click(screen.getByRole('button', { name: STR.de.posterQrCornerTopLeft }));
    await user.click(screen.getByRole('button', { name: STR.de.posterDownload }));

    await waitFor(() => expect(generateCantonPosterBlob).toHaveBeenCalled());
    expect(generateCantonPosterBlob.mock.calls[0][2]).toMatchObject({
      chromeStyle: 'transparent', chromeSize: 'compact', qrCorner: 'top-left',
      headerPosition: 'top', footerPosition: 'bottom',
    });
  });

  it('positions the DOM preview header/footer to match computeChromeLayout for a non-default combination', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: STR.de.posterSizeCompact }));
    // Both the header-position and footer-position pickers have a "Oben" (Top) button, so the
    // plain screen-wide query would match two elements — scope it to the footer picker via its
    // preceding label instead.
    const footerPositionGroup = screen.getByText(STR.de.posterFooterPositionLabel).parentElement as HTMLElement;
    await user.click(within(footerPositionGroup).getByRole('button', { name: STR.de.posterPositionTop }));

    // Both header and footer now share the top edge (header stacked closer to it) at compact
    // size. `cqw()` renders a CSS container-query-width unit string, not a pixel value, so compute
    // the expected style with the same functions the component uses rather than hand-computing a
    // decimal string (which would be brittle against floating-point stringification).
    const expected = computeChromeLayout({
      showHeader: true, showFooter: true, headerPosition: 'top', footerPosition: 'top',
      chromeSize: 'compact', posterHeight: POSTER_SIZE,
    });
    const header = screen.getByTestId('poster-preview-header');
    const footer = screen.getByTestId('poster-preview-footer');
    expect(header).toHaveStyle({ top: cqw(expected.headerY as number) });
    expect(footer).toHaveStyle({ top: cqw(expected.footerY as number) });
  });

  it('reset framing pads for the actual chrome edges (footer moved to top), not fixed header/footer constants', async () => {
    const user = userEvent.setup();
    const venues2 = [
      v({ id: '1', lat: 46.9, lng: 7.4 }),
      v({ id: '2', lat: 46.95, lng: 7.45 }),
    ];
    renderEditor({ venues: venues2 });

    const footerPositionGroup = screen.getByText(STR.de.posterFooterPositionLabel).parentElement as HTMLElement;
    await user.click(within(footerPositionGroup).getByRole('button', { name: STR.de.posterPositionTop }));
    await user.click(screen.getByRole('button', { name: STR.de.posterResetFraming }));

    // Header (190) and footer (46) both occupy the top edge at normal size; scale 0.5 →
    // top pad = 20 + 236*0.5 = 138, bottom pad drops to the base 20 (nothing occupies that edge).
    const [, options] = fakeMap.fitBounds.mock.calls[fakeMap.fitBounds.mock.calls.length - 1];
    expect(options).toEqual({ paddingTopLeft: [20, 138], paddingBottomRight: [20, 20] });
  });

  it('renders the QR corner picker as a 4-corner grid with one button per corner', () => {
    renderEditor();
    const cornerPicker = screen.getByTestId('qr-corner-picker');
    const buttons = within(cornerPicker).getAllByRole('button');
    expect(buttons).toHaveLength(4);
    expect(within(cornerPicker).getByRole('button', { name: STR.de.posterQrCornerTopLeft })).toBeInTheDocument();
    expect(within(cornerPicker).getByRole('button', { name: STR.de.posterQrCornerBottomRight })).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables the position and QR-corner pickers while their element is toggled off', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByLabelText(STR.de.posterToggleHeader));
    const headerPositionGroup = screen.getByText(STR.de.posterHeaderPositionLabel).parentElement as HTMLElement;
    within(headerPositionGroup).getAllByRole('button').forEach((b) => expect(b).toBeDisabled());

    // The footer is still on, so its picker stays enabled.
    const footerPositionGroup = screen.getByText(STR.de.posterFooterPositionLabel).parentElement as HTMLElement;
    within(footerPositionGroup).getAllByRole('button').forEach((b) => expect(b).toBeEnabled());

    await user.click(screen.getByLabelText(STR.de.posterToggleQr));
    const cornerPicker = screen.getByTestId('qr-corner-picker');
    within(cornerPicker).getAllByRole('button').forEach((b) => expect(b).toBeDisabled());
  });
});
