import type { Lang } from '../i18n/translations';

// The ESV association tree as the frontend sees it. It mirrors supabase/migrations/0008_associations.sql,
// which stays the authority for foreign keys and RLS; integration/association-parity.test.ts fails when
// the two drift apart. Components reach it through useAssociations() only, so loading it from the
// database later would change that hook and nothing else.
//
// The integration tests import this file, so it must not read import.meta.env.

export type AssociationLevel = 'federation' | 'regional' | 'cantonal';

export const ASSOCIATIONS = [
  { id: 'esv', parentId: null, level: 'federation', sortOrder: 1 },
  { id: 'bksv', parentId: 'esv', level: 'regional', sortOrder: 1 },
  { id: 'isv', parentId: 'esv', level: 'regional', sortOrder: 2 },
  { id: 'nosv', parentId: 'esv', level: 'regional', sortOrder: 3 },
  { id: 'nwsv', parentId: 'esv', level: 'regional', sortOrder: 4 },
  { id: 'swsv', parentId: 'esv', level: 'regional', sortOrder: 5 },
  { id: 'berner-jura', parentId: 'bksv', level: 'cantonal', sortOrder: 1 },
  { id: 'emmental', parentId: 'bksv', level: 'cantonal', sortOrder: 2 },
  { id: 'mittelland', parentId: 'bksv', level: 'cantonal', sortOrder: 3 },
  { id: 'oberaargau', parentId: 'bksv', level: 'cantonal', sortOrder: 4 },
  { id: 'oberland', parentId: 'bksv', level: 'cantonal', sortOrder: 5 },
  { id: 'seeland', parentId: 'bksv', level: 'cantonal', sortOrder: 6 },
  { id: 'luzern', parentId: 'isv', level: 'cantonal', sortOrder: 1 },
  { id: 'ob-nidwalden', parentId: 'isv', level: 'cantonal', sortOrder: 2 },
  { id: 'schwyz', parentId: 'isv', level: 'cantonal', sortOrder: 3 },
  { id: 'tessin', parentId: 'isv', level: 'cantonal', sortOrder: 4 },
  { id: 'uri', parentId: 'isv', level: 'cantonal', sortOrder: 5 },
  { id: 'zug', parentId: 'isv', level: 'cantonal', sortOrder: 6 },
  { id: 'appenzell', parentId: 'nosv', level: 'cantonal', sortOrder: 1 },
  { id: 'glarus', parentId: 'nosv', level: 'cantonal', sortOrder: 2 },
  { id: 'graubuenden', parentId: 'nosv', level: 'cantonal', sortOrder: 3 },
  { id: 'schaffhausen', parentId: 'nosv', level: 'cantonal', sortOrder: 4 },
  { id: 'st-gallen', parentId: 'nosv', level: 'cantonal', sortOrder: 5 },
  { id: 'thurgau', parentId: 'nosv', level: 'cantonal', sortOrder: 6 },
  { id: 'zuerich', parentId: 'nosv', level: 'cantonal', sortOrder: 7 },
  { id: 'aargau', parentId: 'nwsv', level: 'cantonal', sortOrder: 1 },
  { id: 'baselland', parentId: 'nwsv', level: 'cantonal', sortOrder: 2 },
  { id: 'baselstadt', parentId: 'nwsv', level: 'cantonal', sortOrder: 3 },
  { id: 'solothurn', parentId: 'nwsv', level: 'cantonal', sortOrder: 4 },
  { id: 'freiburg', parentId: 'swsv', level: 'cantonal', sortOrder: 1 },
  { id: 'genf', parentId: 'swsv', level: 'cantonal', sortOrder: 2 },
  { id: 'jura', parentId: 'swsv', level: 'cantonal', sortOrder: 3 },
  { id: 'neuenburg', parentId: 'swsv', level: 'cantonal', sortOrder: 4 },
  { id: 'waadt', parentId: 'swsv', level: 'cantonal', sortOrder: 5 },
  { id: 'wallis', parentId: 'swsv', level: 'cantonal', sortOrder: 6 },
] as const satisfies readonly {
  id: string;
  parentId: string | null;
  level: AssociationLevel;
  sortOrder: number;
}[];

type Entry = (typeof ASSOCIATIONS)[number];
export type AssociationId = Entry['id'];
export type RegionalId = Extract<Entry, { level: 'regional' }>['id'];
export type CantonalId = Extract<Entry, { level: 'cantonal' }>['id'];

const IDS: ReadonlySet<string> = new Set(ASSOCIATIONS.map((a) => a.id));
export const isAssociationId = (x: unknown): x is AssociationId => typeof x === 'string' && IDS.has(x);

const CANTONAL_IDS: ReadonlySet<string> = new Set(ASSOCIATIONS.filter((a) => a.level === 'cantonal').map((a) => a.id));
// The only ids a venue may carry (the database guard enforces the same).
export const isCantonalId = (x: unknown): x is CantonalId => typeof x === 'string' && CANTONAL_IDS.has(x);

// Suggests an association for a venue: by canton, or inside Bern by Verwaltungskreis. The value stored
// on the venue is the truth, so a club across a border can pick another one.
export const HOME_AREAS: readonly { canton: string; bernDistrict: string | null; associationId: CantonalId }[] = [
  { canton: 'ZH', bernDistrict: null, associationId: 'zuerich' },
  { canton: 'LU', bernDistrict: null, associationId: 'luzern' },
  { canton: 'UR', bernDistrict: null, associationId: 'uri' },
  { canton: 'SZ', bernDistrict: null, associationId: 'schwyz' },
  { canton: 'OW', bernDistrict: null, associationId: 'ob-nidwalden' },
  { canton: 'NW', bernDistrict: null, associationId: 'ob-nidwalden' },
  { canton: 'GL', bernDistrict: null, associationId: 'glarus' },
  { canton: 'ZG', bernDistrict: null, associationId: 'zug' },
  { canton: 'FR', bernDistrict: null, associationId: 'freiburg' },
  { canton: 'SO', bernDistrict: null, associationId: 'solothurn' },
  { canton: 'BS', bernDistrict: null, associationId: 'baselstadt' },
  { canton: 'BL', bernDistrict: null, associationId: 'baselland' },
  { canton: 'SH', bernDistrict: null, associationId: 'schaffhausen' },
  { canton: 'AR', bernDistrict: null, associationId: 'appenzell' },
  { canton: 'AI', bernDistrict: null, associationId: 'appenzell' },
  { canton: 'SG', bernDistrict: null, associationId: 'st-gallen' },
  { canton: 'GR', bernDistrict: null, associationId: 'graubuenden' },
  { canton: 'AG', bernDistrict: null, associationId: 'aargau' },
  { canton: 'TG', bernDistrict: null, associationId: 'thurgau' },
  { canton: 'TI', bernDistrict: null, associationId: 'tessin' },
  { canton: 'VD', bernDistrict: null, associationId: 'waadt' },
  { canton: 'VS', bernDistrict: null, associationId: 'wallis' },
  { canton: 'NE', bernDistrict: null, associationId: 'neuenburg' },
  { canton: 'GE', bernDistrict: null, associationId: 'genf' },
  { canton: 'JU', bernDistrict: null, associationId: 'jura' },
  { canton: 'BE', bernDistrict: 'Berner Jura', associationId: 'berner-jura' },
  { canton: 'BE', bernDistrict: 'Biel/Bienne', associationId: 'seeland' },
  { canton: 'BE', bernDistrict: 'Seeland', associationId: 'seeland' },
  { canton: 'BE', bernDistrict: 'Oberaargau', associationId: 'oberaargau' },
  { canton: 'BE', bernDistrict: 'Emmental', associationId: 'emmental' },
  { canton: 'BE', bernDistrict: 'Bern-Mittelland', associationId: 'mittelland' },
  { canton: 'BE', bernDistrict: 'Thun', associationId: 'oberland' },
  { canton: 'BE', bernDistrict: 'Frutigen-Niedersimmental', associationId: 'oberland' },
  { canton: 'BE', bernDistrict: 'Interlaken-Oberhasli', associationId: 'oberland' },
  { canton: 'BE', bernDistrict: 'Obersimmental-Saanen', associationId: 'oberland' },
];

type Names = Record<AssociationId, { name: string; short?: string }>;

// Confirmed 2026-10-06. German and French names of the ESV and its regional associations are the
// official ones on esv.ch; the ESV has no Italian site, so the Italian ones follow the closest usage
// found (RSI, the Ticino association). The 29 cantonal associations carry their place names.
const CANTONAL_DE = {
  'berner-jura': 'Berner Jura', emmental: 'Emmental', mittelland: 'Mittelland', oberaargau: 'Oberaargau',
  oberland: 'Oberland', seeland: 'Seeland', luzern: 'Luzern', 'ob-nidwalden': 'Ob- und Nidwalden',
  schwyz: 'Schwyz', tessin: 'Tessin', uri: 'Uri', zug: 'Zug', appenzell: 'Appenzell', glarus: 'Glarus',
  graubuenden: 'Graubünden', schaffhausen: 'Schaffhausen', 'st-gallen': 'St. Gallen', thurgau: 'Thurgau',
  zuerich: 'Zürich', aargau: 'Aargau', baselland: 'Baselland', baselstadt: 'Baselstadt',
  solothurn: 'Solothurn', freiburg: 'Freiburg', genf: 'Genf', jura: 'Jura', neuenburg: 'Neuenburg',
  waadt: 'Waadt', wallis: 'Wallis',
} as const satisfies Record<CantonalId, string>;

const CANTONAL_FR = {
  'berner-jura': 'Jura bernois', emmental: 'Emmental', mittelland: 'Mittelland', oberaargau: 'Haute-Argovie',
  oberland: 'Oberland', seeland: 'Seeland', luzern: 'Lucerne', 'ob-nidwalden': 'Obwald et Nidwald',
  schwyz: 'Schwytz', tessin: 'Tessin', uri: 'Uri', zug: 'Zoug', appenzell: 'Appenzell', glarus: 'Glaris',
  graubuenden: 'Grisons', schaffhausen: 'Schaffhouse', 'st-gallen': 'Saint-Gall', thurgau: 'Thurgovie',
  zuerich: 'Zurich', aargau: 'Argovie', baselland: 'Bâle-Campagne', baselstadt: 'Bâle-Ville',
  solothurn: 'Soleure', freiburg: 'Fribourg', genf: 'Genève', jura: 'Jura', neuenburg: 'Neuchâtel',
  waadt: 'Vaud', wallis: 'Valais',
} as const satisfies Record<CantonalId, string>;

const CANTONAL_IT = {
  'berner-jura': 'Giura bernese', emmental: 'Emmental', mittelland: 'Mittelland', oberaargau: 'Alta Argovia',
  oberland: 'Oberland', seeland: 'Seeland', luzern: 'Lucerna', 'ob-nidwalden': 'Obvaldo e Nidvaldo',
  schwyz: 'Svitto', tessin: 'Ticino', uri: 'Uri', zug: 'Zugo', appenzell: 'Appenzello', glarus: 'Glarona',
  graubuenden: 'Grigioni', schaffhausen: 'Sciaffusa', 'st-gallen': 'San Gallo', thurgau: 'Turgovia',
  zuerich: 'Zurigo', aargau: 'Argovia', baselland: 'Basilea Campagna', baselstadt: 'Basilea Città',
  solothurn: 'Soletta', freiburg: 'Friburgo', genf: 'Ginevra', jura: 'Giura', neuenburg: 'Neuchâtel',
  waadt: 'Vaud', wallis: 'Vallese',
} as const satisfies Record<CantonalId, string>;

const named = (names: Record<CantonalId, string>) =>
  Object.fromEntries(Object.entries(names).map(([id, name]) => [id, { name }])) as Record<
    CantonalId,
    { name: string }
  >;

export const ASSOCIATION_NAMES: Record<Lang, Names> = {
  de: {
    esv: { name: 'Eidgenössischer Schwingerverband', short: 'ESV' },
    bksv: { name: 'Bernisch-Kantonaler Schwingerverband', short: 'BKSV' },
    isv: { name: 'Innerschweizer Schwingerverband', short: 'ISV' },
    nosv: { name: 'Nordostschweizer Schwingerverband', short: 'NOSV' },
    nwsv: { name: 'Nordwestschweizerischer Schwingerverband', short: 'NWSV' },
    swsv: { name: 'Südwestschweizer Schwingerverband', short: 'SWSV' },
    ...named(CANTONAL_DE),
  },
  fr: {
    esv: { name: 'Association fédérale de lutte suisse', short: 'AFLS' },
    bksv: { name: 'Association cantonale bernoise', short: 'BKSV' },
    isv: { name: 'Association de la Suisse centrale', short: 'ISV' },
    nosv: { name: 'Association du nord-est', short: 'NOSV' },
    nwsv: { name: 'Association du nord-ouest', short: 'NWSV' },
    swsv: { name: 'Association romande de lutte suisse', short: 'ARLS' },
    ...named(CANTONAL_FR),
  },
  it: {
    esv: { name: 'Associazione federale di lotta svizzera', short: 'AFLS' },
    bksv: { name: 'Associazione cantonale bernese', short: 'BKSV' },
    isv: { name: 'Associazione di lotta della Svizzera centrale', short: 'ISV' },
    nosv: { name: 'Associazione della Svizzera nordorientale', short: 'NOSV' },
    nwsv: { name: 'Associazione della Svizzera nordoccidentale', short: 'NWSV' },
    swsv: { name: 'Associazione romanda di lotta svizzera', short: 'ARLS' },
    ...named(CANTONAL_IT),
  },
};
