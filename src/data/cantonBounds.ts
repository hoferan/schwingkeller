export type CantonBounds = [[number, number], [number, number]];

// Precomputed once, offline, from the official swisstopo swissBOUNDARIES3D
// dataset (TLM_KANTONSGEBIET layer, January 2026 release, EPSG:2056/LV95),
// reprojected to WGS84 (EPSG:4326) and rounded to 5 decimal places (~1m
// precision — matches the rounding already used for hand-picked venue
// coordinates in MapView.tsx's onMapClick). Licensed for reuse under
// swisstopo's free-geodata license. Cantonal borders essentially never
// change, so this isn't regenerated automatically as part of the build.
export const CANTON_BOUNDS: Record<string, CantonBounds> = {
  ZH: [[47.15944, 8.35769], [47.69447, 8.98495]],
  BE: [[46.32647, 6.86149], [47.34531, 8.45516]],
  LU: [[46.77499, 7.83642], [47.28719, 8.51406]],
  UR: [[46.52761, 8.39736], [46.99341, 8.95781]],
  SZ: [[46.88528, 8.38875], [47.22256, 9.00472]],
  OW: [[46.75317, 8.0422], [46.98036, 8.50689]],
  NW: [[46.77151, 8.2181], [47.01995, 8.57495]],
  GL: [[46.79647, 8.87124], [47.17399, 9.25259]],
  ZG: [[47.08103, 8.39485], [47.24837, 8.70117]],
  FR: [[46.43791, 6.74187], [47.00681, 7.38021]],
  SO: [[47.07434, 7.34042], [47.5027, 8.03138]],
  BS: [[47.5193, 7.55466], [47.60092, 7.6938]],
  BL: [[47.33788, 7.32519], [47.56437, 7.96184]],
  SH: [[47.55236, 8.40464], [47.80845, 8.87623]],
  AR: [[47.24702, 9.1911], [47.46904, 9.63097]],
  AI: [[47.23399, 9.30972], [47.44369, 9.6184]],
  SG: [[46.87288, 8.79562], [47.54974, 9.67414]],
  GR: [[46.16915, 8.65107], [47.06515, 10.49217]],
  AG: [[47.13748, 7.71353], [47.62108, 8.45511]],
  TG: [[47.37592, 8.66799], [47.69541, 9.50695]],
  TI: [[45.81796, 8.38219], [46.63248, 9.15969]],
  VD: [[46.18707, 6.06386], [46.98691, 7.24918]],
  VS: [[45.85819, 6.77058], [46.65405, 8.47852]],
  NE: [[46.84659, 6.43269], [47.16574, 7.08765]],
  GE: [[46.12855, 5.9559], [46.36458, 6.31028]],
  JU: [[47.15041, 6.84073], [47.50447, 7.55835]],
};

export const boundsForCanton = (code: string): CantonBounds | null =>
  CANTON_BOUNDS[code] ?? null;
