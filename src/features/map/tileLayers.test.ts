import { describe, it, expect } from 'vitest';
import { createTileLayer, TILE_URLS, TILE_ATTRIBUTION, TILE_MAX_ZOOM } from './tileLayers';

describe('TILE_URLS', () => {
  it('points at the OSM and Esri tile endpoints already used by the app', () => {
    expect(TILE_URLS.map).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(TILE_URLS.sat).toBe(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    );
  });
});

describe('createTileLayer', () => {
  it('builds the street layer with the OSM attribution and max zoom', () => {
    const layer = createTileLayer('map');
    expect(layer.options.attribution).toBe(TILE_ATTRIBUTION.map);
    expect(layer.options.maxZoom).toBe(TILE_MAX_ZOOM.map);
  });

  it('builds the satellite layer with the Esri attribution and max zoom', () => {
    const layer = createTileLayer('sat');
    expect(layer.options.attribution).toBe(TILE_ATTRIBUTION.sat);
    expect(layer.options.maxZoom).toBe(TILE_MAX_ZOOM.sat);
  });
});
