import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import L from 'leaflet';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { MapView } from './MapView';

const BE_BOUNDS: [[number, number], [number, number]] = [[46.33, 6.86], [47.35, 8.46]];

// jsdom never lays anything out, so every map container measures 0×0 — the same state as a
// page rendered in a hidden in-app browser, where production hit SCHWINGKELLER-4/-5.
// Leaflet reads its size from clientWidth/clientHeight; these let a test give it one.
const setContainerSize = (width: number, height: number) => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => height });
};

const renderMap = (initialFocusBounds: [[number, number], [number, number]] | null) =>
  render(
    <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
      <MapView
        venues={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onOpenDetail={vi.fn()}
        baseKind="map"
        onChangeBase={vi.fn()}
        placing={false}
        onPickLocation={vi.fn()}
        initialFocusBounds={initialFocusBounds}
        userPosition={null}
        geoStatus="unsupported"
        onRequestLocation={vi.fn()}
      />
    </I18nContext.Provider>,
  );

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
