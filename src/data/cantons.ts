// `w` is the Wikimedia Commons source basename: the bundled coat-of-arms SVG in
// public/wappen/<code>.svg was fetched from Special:FilePath/Wappen_<w>_matt.svg (following
// redirects). Kept as provenance for re-fetching, not used at runtime.
export interface Canton { code: string; name: string; w: string }

export const CANTONS: Canton[] = [
  { code: 'ZH', name: 'Zürich', w: 'Zürich' }, { code: 'BE', name: 'Bern', w: 'Bern' },
  { code: 'LU', name: 'Luzern', w: 'Luzern' }, { code: 'UR', name: 'Uri', w: 'Uri' },
  { code: 'SZ', name: 'Schwyz', w: 'Schwyz' }, { code: 'OW', name: 'Obwalden', w: 'Obwalden' },
  { code: 'NW', name: 'Nidwalden', w: 'Nidwalden' }, { code: 'GL', name: 'Glarus', w: 'Glarus' },
  { code: 'ZG', name: 'Zug', w: 'Zug' }, { code: 'FR', name: 'Fribourg', w: 'Freiburg' },
  { code: 'SO', name: 'Solothurn', w: 'Solothurn' }, { code: 'BS', name: 'Basel-Stadt', w: 'Basel-Stadt' },
  { code: 'BL', name: 'Basel-Landschaft', w: 'Basel-Landschaft' }, { code: 'SH', name: 'Schaffhausen', w: 'Schaffhausen' },
  { code: 'AR', name: 'Appenzell Ausserrhoden', w: 'Appenzell_Ausserrhoden' },
  { code: 'AI', name: 'Appenzell Innerrhoden', w: 'Appenzell_Innerrhoden' },
  { code: 'SG', name: 'St. Gallen', w: 'St._Gallen' }, { code: 'GR', name: 'Graubünden', w: 'Graubünden' },
  { code: 'AG', name: 'Aargau', w: 'Aargau' }, { code: 'TG', name: 'Thurgau', w: 'Thurgau' },
  { code: 'TI', name: 'Ticino', w: 'Tessin' }, { code: 'VD', name: 'Vaud', w: 'Waadt' },
  { code: 'VS', name: 'Valais', w: 'Wallis' }, { code: 'NE', name: 'Neuchâtel', w: 'Neuenburg' },
  { code: 'GE', name: 'Genève', w: 'Genf' }, { code: 'JU', name: 'Jura', w: 'Jura' },
];

export const cantonByCode = (code: string): Canton | undefined =>
  CANTONS.find((c) => c.code === code);

// Served from public/wappen/<code>.svg — a same-origin bundled asset, so the off-screen poster
// canvas can draw it without tainting (Wikimedia's commons.wikimedia.org redirect endpoint does
// not send CORS headers on its 302, which blocked crossOrigin loads). BASE_URL keeps it correct
// under any deploy base path.
export const wappenUrl = (code: string): string => {
  const c = cantonByCode(code);
  return c ? `${import.meta.env.BASE_URL}wappen/${c.code}.svg` : '';
};
