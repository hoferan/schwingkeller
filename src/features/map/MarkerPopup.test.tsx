import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { STR } from '../../i18n/translations';
import type { Venue } from '../venues/types';
import { MarkerPopup } from './MarkerPopup';

const venue: Venue = {
  id: '1',
  name: 'Emmental',
  canton: 'BE',
  address: '3550 Langnau',
  lat: 46.9,
  lng: 7.7,
  indoor: true,
  outdoor: false,
  person: '',
  phone: '',
  website: '',
  photos: [],
};

describe('MarkerPopup', () => {
  it('renders the venue name, address, and indoor/outdoor tags', () => {
    render(<MarkerPopup venue={venue} t={STR.de} />);
    expect(screen.getByText('Emmental')).toBeInTheDocument();
    expect(screen.getByText('3550 Langnau')).toBeInTheDocument();
    expect(screen.getByText(STR.de.indoor)).toBeInTheDocument();
    expect(screen.queryByText(STR.de.outdoor)).not.toBeInTheDocument();
  });

  it('marks the details button with the venue id for click delegation', () => {
    render(<MarkerPopup venue={venue} t={STR.de} />);
    expect(screen.getByRole('button', { name: STR.de.details })).toHaveAttribute('data-detail', '1');
  });

  it('renders a photo when available, not the placeholder', () => {
    const venueWithPhoto: Venue = {
      ...venue,
      photos: [{ id: 'p1', url: 'https://example.com/photo.jpg', position: 0 }],
    };
    const { container } = render(<MarkerPopup venue={venueWithPhoto} t={STR.de} />);

    // Check that the photo URL is rendered in the background-image style
    // Note: quotes are HTML-encoded as &quot; in the innerHTML
    expect(container.innerHTML).toContain('url(&quot;https://example.com/photo.jpg&quot;)');

    // Check that the placeholder "FOTO" label is NOT present when photo is available
    expect(screen.queryByText('FOTO')).not.toBeInTheDocument();
  });
});
