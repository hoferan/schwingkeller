import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import L from 'leaflet';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { MapView } from './MapView';
import { USER_PIN_SIZE } from './markers';
import type { Venue } from '../venues/types';

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
) => (
    <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
      <MapView
        venues={venues}
        selectedId={selectedId}
        onSelect={vi.fn()}
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

const venueAt = (id: string, associationId: string | null, lat: number, lng: number): Venue => ({
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
    expect(icons(container).some((html) => html.includes('#9B2C1F'))).toBe(true);
  });

  it('sizes and centres the icon box of the larger selected pin', () => {
    const venues = [venueAt('1', 'emmental', 46.9, 7.7)];
    const { container, rerender } = render(mapView(null, venues));
    vi.advanceTimersByTime(200);
    rerender(mapView(null, venues, '1'));
    const icon = container.querySelector<HTMLElement>('.leaflet-marker-icon');
    expect(icon?.style.width).toBe('34px');
    expect(icon?.style.marginLeft).toBe('-17px');
  });

  it("hands each venue's association to the cluster icon", () => {
    const { container } = render(mapView(null, [venueAt('1', 'emmental', 46.9, 7.7), venueAt('2', 'freiburg', 46.9, 7.7)]));
    vi.advanceTimersByTime(200);
    expect(icons(container).some((html) => html.includes('conic-gradient(#9B2C1F 0% 50%, #8A5A12 50% 100%)'))).toBe(true);
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
