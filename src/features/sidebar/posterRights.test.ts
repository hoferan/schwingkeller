import { describe, it, expect } from 'vitest';
import type { Venue } from '../venues/types';
import { canPrintCantonPoster } from './posterRights';

const v = (canton: string, association_id: Venue['association_id']): Venue => ({
  id: `${canton}-${association_id}`, name: 'A', canton, address: '', lat: 0, lng: 0,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id,
} as Venue);

// Stand-ins for canEditAssociation: BKSV edits its own Verbände, ESV edits everything.
const editsEmmental = (id: string) => id === 'emmental';
const bksv = (id: string) => ['emmental', 'oberland', 'bern'].includes(id);
const esv = () => true;

describe('canPrintCantonPoster', () => {
  it('is true when every venue of the canton is in the editor scope', () => {
    const venues = [v('BE', 'emmental'), v('BE', 'emmental')];
    expect(canPrintCantonPoster(venues, 'BE', editsEmmental, false)).toBe(true);
  });

  it('is false when one venue of the canton lies outside the scope', () => {
    const venues = [v('BE', 'emmental'), v('BE', 'oberland')];
    expect(canPrintCantonPoster(venues, 'BE', editsEmmental, false)).toBe(false);
    expect(canPrintCantonPoster(venues, 'BE', bksv, false)).toBe(true);
  });

  it('is false for a cross-border venue outside the scope, true for ESV', () => {
    const venues = [v('BE', 'emmental'), v('BE', 'luzern')];
    expect(canPrintCantonPoster(venues, 'BE', bksv, false)).toBe(false);
    expect(canPrintCantonPoster(venues, 'BE', esv, false)).toBe(true);
  });

  it('ignores venues of other cantons', () => {
    const venues = [v('BE', 'emmental'), v('LU', 'luzern')];
    expect(canPrintCantonPoster(venues, 'BE', editsEmmental, false)).toBe(true);
  });

  it('is true for a canton without venues only for a super-admin', () => {
    expect(canPrintCantonPoster([], 'UR', bksv, false)).toBe(false);
    expect(canPrintCantonPoster([], 'UR', bksv, true)).toBe(true);
  });
});
