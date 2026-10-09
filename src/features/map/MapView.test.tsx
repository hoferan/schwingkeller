import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import L from 'leaflet';
import { I18nContext } from '../../i18n/useTranslation';
import { STR, type Lang } from '../../i18n/translations';
import { MapView } from './MapView';
import { USER_PIN_SIZE } from './markers';
import type { Venue } from '../venues/types';
import type { CantonalId } from '../../data/associations';

const BE_BOUNDS: [[number, number], [number, number]] = [[46.33, 6.86], [47.35, 8.46]];

// jsdom never lays anything out, so every map container measures 0×0 — the same state as a
// page rendered in a hidden in-app browser, where production hit SCHWINGKELLER-4/-5.
// Leaflet reads its size from clientWidth/clientHeight; these let a test give it one.
const setContainerSize = (width: number, height: number) => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => height });
};

const mapView = (
  initialFocusBounds: [[number, number], [number, number]] | null,
  venues: Venue[] = [],
  selectedId: string | null = null,
  userPosition: { lat: number; lng: number } | null = null,
  lang: Lang = 'de',
) => (
    <I18nContext.Provider value={{ lang, t: STR[lang] as typeof STR.de, setLang: vi.fn() }}>
      <MapView
        venues={venues}
        selectedId={selectedId}
        onSelect={vi.fn()}
        onDeselect={vi.fn()}
        onOpenDetail={vi.fn()}
        baseKind="map"
        onChangeBase={vi.fn()}
        placing={false}
        onPickLocation={vi.fn()}
        initialFocusBounds={initialFocusBounds}
        userPosition={userPosition}
        geoStatus="unsupported"
        onRequestLocation={vi.fn()}
        isMobile={false}
      />
    </I18nContext.Provider>
);

const renderMap = (initialFocusBounds: [[number, number], [number, number]] | null) => render(mapView(initialFocusBounds));

describe('MapView initial canton focus', () => {
  const browser = L.Browser as { any3d: boolean };
  const any3d = browser.any3d;

  beforeEach(() => {
    vi.useFakeTimers();
    // Real browsers animate flyTo; jsdom reports no 3D support, which makes Leaflet fall
    // back to setView and hides the crash.
    browser.any3d = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    browser.any3d = any3d;
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  });

  it('does not crash when the map container has no size yet', () => {
    setContainerSize(0, 0);
    expect(() => renderMap(BE_BOUNDS)).not.toThrow();
  });

  it('flies to the canton once the container gets a size', () => {
    setContainerSize(0, 0);
    const flyToBounds = vi.spyOn(L.Map.prototype, 'flyToBounds');
    renderMap(BE_BOUNDS);
    vi.advanceTimersByTime(500);
    expect(flyToBounds).not.toHaveBeenCalled();

    setContainerSize(800, 600);
    vi.advanceTimersByTime(500);
    expect(flyToBounds).toHaveBeenCalledTimes(1);
    expect(flyToBounds).toHaveBeenCalledWith(BE_BOUNDS, { padding: [40, 40], maxZoom: 15, duration: 0.8 });
  });

  it('flies to the canton right away when the container already has a size', () => {
    setContainerSize(800, 600);
    const flyToBounds = vi.spyOn(L.Map.prototype, 'flyToBounds');
    renderMap(BE_BOUNDS);
    expect(flyToBounds).toHaveBeenCalledTimes(1);
  });
});

describe('MapView container resize', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('tells Leaflet when its container changes size, as when the sidebar is dragged wider', () => {
    // jsdom has no ResizeObserver; this one hands the test the callback the map registers.
    const callbacks: ResizeObserverCallback[] = [];
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: ResizeObserverCallback) { callbacks.push(cb); }
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    const invalidateSize = vi.spyOn(L.Map.prototype, 'invalidateSize');
    renderMap(null);
    expect(callbacks).toHaveLength(1);
    invalidateSize.mockClear();

    callbacks[0]([], {} as ResizeObserver);

    expect(invalidateSize).toHaveBeenCalledTimes(1);
  });
});

const venueAt = (id: string, associationId: CantonalId, lat: number, lng: number): Venue => ({
  id, name: 'Keller ' + id, canton: 'BE', address: '', lat, lng,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: associationId,
});

// VITE_APP_ENV is unset here, which reads as development, where the verband flag is on.
describe('MapView venue pins', () => {
  beforeEach(() => { vi.useFakeTimers(); setContainerSize(800, 600); });

  afterEach(() => {
    vi.useRealTimers();
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  });

  const icons = (container: HTMLElement) =>
    [...container.querySelectorAll('.leaflet-marker-icon')].map((el) => el.innerHTML);

  it("draws a pin in its Teilverband's colour", () => {
    const { container } = render(mapView(null, [venueAt('1', 'emmental', 46.9, 7.7)]));
    vi.advanceTimersByTime(200);
    expect(icons(container).some((html) => html.includes('#1A1A1A'))).toBe(true);
  });

  it('sizes the selected pin to its teardrop and anchors it at the tip', () => {
    const venues = [venueAt('1', 'emmental', 46.9, 7.7)];
    const { container, rerender } = render(mapView(null, venues));
    vi.advanceTimersByTime(200);
    rerender(mapView(null, venues, '1'));
    const icon = container.querySelector<HTMLElement>('.leaflet-marker-icon');
    expect(icon?.style.width).toBe('30px');
    expect(icon?.style.height).toBe('42px');
    expect(icon?.style.marginLeft).toBe('-15px');
    expect(icon?.style.marginTop).toBe('-39px');
  });

  it('draws the selected pin over a neighbour just south of it, but under the location dot', () => {
    // Leaflet stacks markers by screen y, so a pin further south would paint over the teardrop's tip.
    const venues = [venueAt('1', 'emmental', 46.9001, 7.7), venueAt('2', 'luzern', 46.9, 7.7)];
    const { container, rerender } = render(mapView(null, venues));
    vi.advanceTimersByTime(200);
    rerender(mapView(null, venues, '1'));
    const pins = [...container.querySelectorAll<HTMLElement>('.leaflet-marker-icon')];
    const selected = pins.find((el) => el.querySelector('path'))!;
    const neighbour = pins.find((el) => !el.querySelector('path'))!;
    expect(Number(selected.style.zIndex)).toBeGreaterThan(Number(neighbour.style.zIndex));
    // The location dot sits 1000 above its own position; the selected pin must stay below that.
    expect(Number(selected.style.zIndex) - Number(neighbour.style.zIndex)).toBeLessThan(1000);
  });

  it("labels the popup's close button in the visitor's language", () => {
    const { container } = render(mapView(null, [venueAt('1', 'emmental', 46.9, 7.7)]));
    vi.advanceTimersByTime(200);
    fireEvent.click(container.querySelector('.leaflet-marker-icon')!);
    const close = container.querySelector('.leaflet-popup-close-button');
    expect(close).toHaveAttribute('aria-label', STR.de.close);
    expect(close).toHaveAttribute('title', STR.de.close);
  });

  it('rebuilds the popups in the new language when the language changes', () => {
    const venues = [venueAt('1', 'freiburg', 46.9, 7.7)];
    const { container, rerender } = render(mapView(null, venues));
    vi.advanceTimersByTime(200);
    rerender(mapView(null, venues, null, null, 'fr'));
    vi.advanceTimersByTime(200);
    fireEvent.click(container.querySelector('.leaflet-marker-icon')!);
    const popup = container.querySelector('.leaflet-popup')!;
    expect(popup.querySelector('.leaflet-popup-close-button')).toHaveAttribute('aria-label', STR.fr.close);
    expect(popup).toHaveTextContent('ARLS');
    expect(popup).toHaveTextContent('Fribourg');
  });

  it('names each pin after its venue', () => {
    const { container } = render(mapView(null, [venueAt('1', 'emmental', 46.9, 7.7)]));
    vi.advanceTimersByTime(200);
    expect(container.querySelector('.leaflet-marker-icon')).toHaveAttribute('title', 'Keller 1');
  });

  it("hands each venue's association to the cluster icon", () => {
    const { container } = render(mapView(null, [venueAt('1', 'emmental', 46.9, 7.7), venueAt('2', 'freiburg', 46.9, 7.7)]));
    vi.advanceTimersByTime(200);
    expect(icons(container).some((html) => html.includes('conic-gradient(#1A1A1A 0% 50%, #5D6B80 50% 100%)'))).toBe(true);
  });
});

describe('MapView location marker', () => {
  beforeEach(() => { vi.useFakeTimers(); setContainerSize(800, 600); });

  afterEach(() => {
    vi.useRealTimers();
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  });

  const markers = (container: HTMLElement) => {
    const all = [...container.querySelectorAll<HTMLElement>('.leaflet-marker-icon')];
    return {
      me: all.find((el) => el.title === STR.de.youAreHere),
      pin: all.find((el) => el.title !== STR.de.youAreHere),
    };
  };

  it('sizes and centres the icon box on the halo', () => {
    const { container } = render(mapView(null, [], null, { lat: 46.8, lng: 7.15 }));
    const { me } = markers(container);
    expect(me?.style.width).toBe(USER_PIN_SIZE + 'px');
    expect(me?.style.marginLeft).toBe(-USER_PIN_SIZE / 2 + 'px');
    expect(me?.style.marginTop).toBe(-USER_PIN_SIZE / 2 + 'px');
  });

  it('sits above a venue pin at the same spot', () => {
    const { container } = render(mapView(null, [venueAt('1', 'emmental', 46.8, 7.15)], null, { lat: 46.8, lng: 7.15 }));
    vi.advanceTimersByTime(200);
    const { me, pin } = markers(container);
    expect(Number(me?.style.zIndex)).toBeGreaterThan(Number(pin?.style.zIndex));
  });
});

describe('MapView legend', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('shows the legend when the verband flag is on', () => {
    const { getByRole } = render(mapView(null));
    expect(getByRole('button', { name: STR.de.legendHide })).toBeTruthy();
  });

  it('has no legend when the verband flag is off', () => {
    vi.stubEnv('VITE_APP_ENV', 'production');
    const { queryByRole } = render(mapView(null));
    expect(queryByRole('button', { name: STR.de.legendHide })).toBeNull();
  });
});

// Holds the selection the way App does, so a pin click or a closed popup round-trips through the
// props. The button stands in for a row in the venue list.
const SelectionHarness = ({ venues, lang = 'de', onSelect, onDeselect }: {
  venues: Venue[];
  lang?: Lang;
  onSelect: (id: string) => void;
  onDeselect: () => void;
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <I18nContext.Provider value={{ lang, t: STR[lang] as typeof STR.de, setLang: vi.fn() }}>
      <button onClick={() => setSelectedId(venues[0].id)}>pick from list</button>
      <output data-testid="selected">{selectedId ?? ''}</output>
      <MapView
        venues={venues}
        selectedId={selectedId}
        onSelect={(id) => { onSelect(id); setSelectedId(id); }}
        onDeselect={() => { onDeselect(); setSelectedId(null); }}
        onOpenDetail={vi.fn()}
        baseKind="map"
        onChangeBase={vi.fn()}
        placing={false}
        onPickLocation={vi.fn()}
        userPosition={null}
        geoStatus="unsupported"
        onRequestLocation={vi.fn()}
        isMobile={false}
      />
    </I18nContext.Provider>
  );
};

describe('MapView selection from the map', () => {
  // Geneva and St. Gallen: far enough apart that the two pins never share a cluster.
  const venues = [venueAt('1', 'freiburg', 46.2, 6.15), venueAt('2', 'luzern', 47.42, 9.37)];
  let onSelect: ReturnType<typeof vi.fn<(id: string) => void>>;
  let onDeselect: ReturnType<typeof vi.fn<() => void>>;

  const renderHarness = () => {
    const result = render(<SelectionHarness venues={venues} onSelect={onSelect} onDeselect={onDeselect} />);
    vi.advanceTimersByTime(200);
    return result;
  };
  const pin = (container: HTMLElement, name: string) =>
    container.querySelector<HTMLElement>(`.leaflet-marker-icon[title="${name}"]`)!;
  const teardrops = (container: HTMLElement) => container.querySelectorAll('.leaflet-marker-icon path');
  const closePopup = (container: HTMLElement) =>
    fireEvent.click(container.querySelector('.leaflet-popup-close-button')!);

  beforeEach(() => {
    vi.useFakeTimers();
    setContainerSize(800, 600);
    onSelect = vi.fn<(id: string) => void>();
    onDeselect = vi.fn<() => void>();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  });

  it('selects a venue when its pin is clicked', () => {
    const { container } = renderHarness();
    fireEvent.click(pin(container, 'Keller 1'));
    expect(onSelect).toHaveBeenCalledWith('1');
    expect(screen.getByTestId('selected')).toHaveTextContent('1');
  });

  it('clears the selection when the popup is closed', () => {
    const { container } = renderHarness();
    fireEvent.click(pin(container, 'Keller 1'));
    closePopup(container);
    expect(onDeselect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('selected')).toHaveTextContent('');
    expect(teardrops(container)).toHaveLength(0);
  });

  it('clears the selection when the open pin is clicked again', () => {
    const { container } = renderHarness();
    fireEvent.click(pin(container, 'Keller 1'));
    fireEvent.click(pin(container, 'Keller 1'));
    expect(container.querySelector('.leaflet-popup')).toBeNull();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onDeselect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('selected')).toHaveTextContent('');
  });

  it('moves the selection straight to a second pin', () => {
    const { container } = renderHarness();
    fireEvent.click(pin(container, 'Keller 1'));
    fireEvent.click(pin(container, 'Keller 2'));
    expect(onSelect).toHaveBeenLastCalledWith('2');
    expect(screen.getByTestId('selected')).toHaveTextContent('2');
    expect(teardrops(container)).toHaveLength(1);
    expect(pin(container, 'Keller 2').querySelector('path')).not.toBeNull();
  });

  it('keeps the selection when the pins are rebuilt in another language', () => {
    const { container, rerender } = renderHarness();
    fireEvent.click(pin(container, 'Keller 1'));
    rerender(<SelectionHarness venues={venues} lang="fr" onSelect={onSelect} onDeselect={onDeselect} />);
    vi.advanceTimersByTime(200);
    expect(onDeselect).not.toHaveBeenCalled();
    expect(screen.getByTestId('selected')).toHaveTextContent('1');
  });

  it('opens the popup without flying when a pin is clicked', () => {
    const flyTo = vi.spyOn(L.Map.prototype, 'flyTo');
    const { container } = renderHarness();
    fireEvent.click(pin(container, 'Keller 1'));
    vi.advanceTimersByTime(1000);
    expect(flyTo).not.toHaveBeenCalled();
    expect(container.querySelector('.leaflet-popup')).not.toBeNull();
  });

  it('still flies to a venue picked in the list', () => {
    const flyTo = vi.spyOn(L.Map.prototype, 'flyTo');
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'pick from list' }));
    expect(flyTo).toHaveBeenCalledTimes(1);
  });

  it('flies to a venue picked in the list after its pin was clicked and closed', () => {
    const flyTo = vi.spyOn(L.Map.prototype, 'flyTo');
    const { container } = renderHarness();
    fireEvent.click(pin(container, 'Keller 1'));
    closePopup(container);
    fireEvent.click(screen.getByRole('button', { name: 'pick from list' }));
    expect(flyTo).toHaveBeenCalledTimes(1);
  });

  it('keeps a venue picked in the list selected when its flight ends late', () => {
    // The zoom at the end of a flight makes markercluster take the pin off the map and put it back,
    // which closes any popup the pin has open at that moment.
    let land = () => {};
    vi.spyOn(L.Map.prototype, 'flyTo').mockImplementation(function (this: L.Map, center, zoom) {
      land = () => { this.setView(center, zoom); };
      return this;
    });
    const { container } = renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'pick from list' }));
    vi.advanceTimersByTime(1000);
    land();
    expect(container.querySelector('.leaflet-popup')).not.toBeNull();
    expect(onDeselect).not.toHaveBeenCalled();
    expect(screen.getByTestId('selected')).toHaveTextContent('1');
  });

  it('lifts the open popup onto the teardrop', () => {
    const popupBottom = (container: HTMLElement) =>
      parseFloat(container.querySelector<HTMLElement>('.leaflet-popup')!.style.bottom);
    // mapView's onSelect is a spy that never selects, so its popup stays on the round pin.
    const plain = render(mapView(null, venues));
    vi.advanceTimersByTime(200);
    fireEvent.click(pin(plain.container, 'Keller 1'));
    const overDisc = popupBottom(plain.container);
    plain.unmount();

    const { container } = renderHarness();
    fireEvent.click(pin(container, 'Keller 1'));
    // The teardrop's popupAnchor sits 42px above the spot, the disc's 20px.
    expect(popupBottom(container) - overDisc).toBe(22);
  });

  it('keeps autoPan on for venue popups, so a popup near the edge pans into view', () => {
    const bindPopup = vi.spyOn(L.Layer.prototype, 'bindPopup');
    const { container } = renderHarness();
    fireEvent.click(pin(container, 'Keller 1'));
    expect(bindPopup).toHaveBeenCalled();
    for (const [, options] of bindPopup.mock.calls) expect(options?.autoPan).not.toBe(false);
  });
});
