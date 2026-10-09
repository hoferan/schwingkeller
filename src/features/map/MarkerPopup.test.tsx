import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { STR } from '../../i18n/translations';
import type { Venue } from '../venues/types';
import { MarkerPopup } from './MarkerPopup';
import { associationsFor } from '../associations/useAssociations';
import { theme } from '../../theme';

const venue: Venue = {
  id: '1',
  name: 'Schwingkeller Langnau',
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
  association_id: 'emmental',
};

describe('MarkerPopup', () => {
  it('renders the venue name, address, and indoor/outdoor tags', () => {
    render(<MarkerPopup venue={venue} t={STR.de} associations={associationsFor('de')} />);
    expect(screen.getByText('Schwingkeller Langnau')).toBeInTheDocument();
    expect(screen.getByText('3550 Langnau')).toBeInTheDocument();
    expect(screen.getByText(STR.de.indoor)).toBeInTheDocument();
    expect(screen.queryByText(STR.de.outdoor)).not.toBeInTheDocument();
  });

  it('marks the details button with the venue id for click delegation', () => {
    render(<MarkerPopup venue={venue} t={STR.de} associations={associationsFor('de')} />);
    expect(screen.getByRole('button', { name: STR.de.details })).toHaveAttribute('data-detail', '1');
  });

  it('renders a photo when available, not the placeholder', () => {
    const venueWithPhoto: Venue = {
      ...venue,
      photos: [{ id: 'p1', url: 'https://example.com/photo.jpg', position: 0 }],
    };
    const { container } = render(<MarkerPopup venue={venueWithPhoto} t={STR.de} associations={associationsFor('de')} />);

    // Check that the photo URL is rendered in the background-image style
    // Note: quotes are HTML-encoded as &quot; in the innerHTML
    expect(container.innerHTML).toContain('url(&quot;https://example.com/photo.jpg&quot;)');

    // Check that the placeholder "FOTO" label is NOT present when photo is available
    expect(screen.queryByText('FOTO')).not.toBeInTheDocument();
  });

  const withPhoto: Venue = { ...venue, photos: [{ id: 'p1', url: 'https://example.com/photo.jpg', position: 0 }] };
  const popup = (v: Venue, lang: 'de' | 'fr' = 'de') =>
    render(<MarkerPopup venue={v} t={STR[lang] as typeof STR.de} associations={associationsFor(lang)} />);

  it('shows no photo area and no placeholder when the venue has no photo', () => {
    const { container } = popup(venue);
    expect(container.querySelector('[data-popup-photo]')).toBeNull();
    expect(screen.queryByText(/FOTO/)).toBeNull();
  });

  it('marks the photo area, so the close button can switch to its dark style over it', () => {
    const { container } = popup(withPhoto);
    expect(container.querySelector('[data-popup-photo]')).not.toBeNull();
  });

  it('keeps the name clear of the close button when there is no photo', () => {
    popup(venue);
    expect(screen.getByText('Schwingkeller Langnau').parentElement).toHaveStyle({ paddingRight: '28px' });
  });

  it('breaks a long single-word name instead of running under the close button', () => {
    popup({ ...venue, name: 'Schwingkellergenossenschaftsanlage' });
    expect(screen.getByText('Schwingkellergenossenschaftsanlage')).toHaveStyle({ overflowWrap: 'anywhere' });
  });

  it('aligns the outlined canton arms with the first line of the name', () => {
    const { container } = popup(venue);
    expect(screen.getByText('Schwingkeller Langnau').parentElement).toHaveStyle({ alignItems: 'flex-start' });
    expect(container.querySelector('img')).toHaveStyle({ filter: theme.armsOutline });
  });

  it('gives the tags 11.5px text and the Details button a 40px height', () => {
    popup(venue);
    expect(screen.getByText(STR.de.indoor)).toHaveStyle({ fontSize: '11.5px' });
    expect(screen.getByRole('button', { name: STR.de.details })).toHaveStyle({ height: '40px' });
  });

  // VITE_APP_ENV is unset here, which reads as development, where the verband flag is on.
  it('shows the Teilverband badge before the Verband, with the full name on hover', () => {
    popup({ ...venue, association_id: 'freiburg' });
    const badge = screen.getByText('SWSV');
    expect(badge).toHaveAttribute('title', 'Südwestschweizer Schwingerverband');
    expect(badge).toHaveStyle({ backgroundColor: '#5D6B80' });
    expect(badge.nextElementSibling).toHaveTextContent('Freiburg');
  });

  it("names the Teilverband and the Verband in the visitor's language", () => {
    popup({ ...venue, association_id: 'freiburg' }, 'fr');
    expect(screen.getByText('ARLS')).toBeInTheDocument();
    expect(screen.getByText('Fribourg')).toBeInTheDocument();
  });

  describe('with the verband flag off', () => {
    afterEach(() => { vi.unstubAllEnvs(); });

    it('shows no Verband line', () => {
      vi.stubEnv('VITE_APP_ENV', 'production');
      popup(venue);
      expect(screen.queryByText('BKSV')).toBeNull();
    });
  });
});
