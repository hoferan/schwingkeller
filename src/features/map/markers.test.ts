import { describe, it, expect } from 'vitest';
import { pinHtml, popupHtml } from './markers';
import { STR } from '../../i18n/translations';
import type { Venue } from '../venues/types';

const venue: Venue = {
  id: '1', name: 'Emmental', canton: 'BE', address: '3550 Langnau', lat: 46.9, lng: 7.7,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photo_url: null,
};

describe('markers html', () => {
  it('pinHtml differs for selected', () => {
    expect(pinHtml(true)).not.toBe(pinHtml(false));
  });
  it('popupHtml includes name and a data-detail hook', () => {
    const html = popupHtml(venue, STR.de);
    expect(html).toContain('Emmental');
    expect(html).toContain('data-detail="1"');
  });
});
