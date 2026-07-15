import { describe, it, expect } from 'vitest';
import { pinHtml, popupHtml, userPinHtml } from './markers';
import { STR } from '../../i18n/translations';
import type { Venue } from '../venues/types';

const venue: Venue = {
  id: '1', name: 'Emmental', canton: 'BE', address: '3550 Langnau', lat: 46.9, lng: 7.7,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [],
};

describe('markers html', () => {
  it('pinHtml renders same color for both selected and unselected states with flat theme', () => {
    // With the flat theme, selected and unselected states render identically since there's only one accent color
    expect(pinHtml(true)).toBe(pinHtml(false));
  });
  it('popupHtml includes name and a data-detail hook', () => {
    const html = popupHtml(venue, STR.de);
    expect(html).toContain('Emmental');
    expect(html).toContain('data-detail="1"');
  });
});

describe('userPinHtml', () => {
  it('is a blue location dot, visually distinct from venue pins', () => {
    const html = userPinHtml();
    expect(html).toContain('#1a73e8');
    expect(html).not.toBe(pinHtml(false));
  });
});
