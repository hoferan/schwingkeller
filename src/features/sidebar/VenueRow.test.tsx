import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Venue } from '../venues/types';
import { VenueRow } from './VenueRow';

const v = (id: string, name: string): Venue => ({
  id, name, canton: 'FR', address: 'Weg 1, 1700 Fribourg', lat: 0, lng: 0,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: 'freiburg',
});

describe('VenueRow', () => {
  it('marks only the selected row as current', () => {
    render(
      <>
        <VenueRow venue={v('1', 'Halle Düdingen')} selected onSelect={() => {}} />
        <VenueRow venue={v('2', 'Keller Plaffeien')} selected={false} onSelect={() => {}} />
      </>,
    );
    const [selected, other] = screen.getAllByTestId('venue-row');
    expect(selected).toHaveAttribute('aria-current', 'true');
    expect(other).not.toHaveAttribute('aria-current');
  });
});
