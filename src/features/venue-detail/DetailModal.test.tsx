import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { getSession, onAuthStateChange } = vi.hoisted(() => {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi
      .fn()
      .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  };
});
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession, onAuthStateChange } },
}));
// The carousel measures the DOM, which jsdom can't; a stub is enough for the layout tests here.
vi.mock('embla-carousel-react', () => ({
  default: () => [vi.fn(), { selectedScrollSnap: () => 0, on: vi.fn(), off: vi.fn() }],
}));

import { AuthProvider } from '../auth/AuthProvider';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import type { Venue } from '../venues/types';
import { DetailModal } from './DetailModal';
import { theme } from '../../theme';

const venue: Venue = {
  id: 'v1',
  name: 'Schwingkeller Bern',
  canton: 'BE',
  address: 'Mattenweg 3, 3000 Bern',
  lat: 46.95,
  lng: 7.45,
  indoor: true,
  outdoor: false,
  person: 'Hans Muster',
  phone: '+41 31 123 45 67',
  website: 'schwingkeller-bern.ch',
  photos: [],
  association_id: 'emmental',
};

const noop = () => {};

const renderModal = (overrides: Partial<React.ComponentProps<typeof DetailModal>> = {}) =>
  render(
    <AuthProvider>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <DetailModal
          venue={venue}
          onClose={noop}
          onNavigate={noop}
          onShare={noop}
          onEdit={noop}
          onDelete={noop}
          {...overrides}
        />
      </I18nContext.Provider>
    </AuthProvider>,
  );

describe('DetailModal', () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ data: { session: null } });
  });

  it('renders venue details and hides admin actions when not admin', async () => {
    renderModal();
    expect(screen.getByText(venue.name)).toBeInTheDocument();
    expect(screen.getByText(venue.address)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(STR.de.edit)).not.toBeInTheDocument());
  });

  it('shows the edit button when admin is logged in', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'admin' } } } });
    renderModal();
    expect(await screen.findByText(STR.de.edit)).toBeInTheDocument();
  });

  it('calls onShare when the Share button is clicked, not onNavigate', async () => {
    const onNavigate = vi.fn();
    const onShare = vi.fn();
    renderModal({ onNavigate, onShare });
    await screen.findByText(venue.name);
    fireEvent.click(screen.getByRole('button', { name: STR.de.share }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('calls onNavigate when the Navigate button is clicked, not onShare', async () => {
    const onNavigate = vi.fn();
    const onShare = vi.fn();
    renderModal({ onNavigate, onShare });
    await screen.findByText(venue.name);
    fireEvent.click(screen.getByRole('button', { name: STR.de.navigate }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onShare).not.toHaveBeenCalled();
  });
});

describe('DetailModal association', () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ data: { session: null } });
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('shows the association with the flag on', () => {
    renderModal({ venue: { ...venue, association_id: 'emmental' } });
    expect(screen.getByTestId('venue-association')).toHaveTextContent('Emmental');
  });

  it('shows nothing with the flag off', () => {
    vi.stubEnv('VITE_APP_ENV', 'production');
    renderModal({ venue: { ...venue, association_id: 'emmental' } });
    expect(screen.queryByTestId('venue-association')).toBeNull();
  });
});

describe('DetailModal layout', () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ data: { session: null } });
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  const withPhotos: Venue = { ...venue, photos: [{ id: 'p1', url: 'https://example.com/a.jpg', position: 0 }] };

  it('shows no photo area when the venue has no photos', () => {
    renderModal();
    expect(screen.queryByTestId('venue-photos')).toBeNull();
    expect(screen.queryByText(/FOTO/)).toBeNull();
  });

  it('shows the photos above the name when there are some', () => {
    renderModal({ venue: withPhotos });
    expect(screen.getByTestId('venue-photos')).toBeInTheDocument();
  });

  it('puts a light close button in the header when there are no photos', () => {
    renderModal();
    const close = screen.getByRole('button', { name: STR.de.close });
    expect(screen.getByTestId('venue-header')).toContainElement(close);
    expect(close).toHaveStyle({ backgroundColor: theme.color.paper });
  });

  it('puts a dark close button over the photos when there are some', () => {
    renderModal({ venue: withPhotos });
    const close = screen.getByRole('button', { name: STR.de.close });
    expect(screen.getByTestId('venue-photos')).toContainElement(close);
    expect(close).toHaveStyle({ backgroundColor: 'rgba(17, 17, 17, 0.7)' });
  });

  it('shows the outlined canton arms next to the name, with or without photos', () => {
    for (const v of [venue, withPhotos]) {
      const { unmount } = renderModal({ venue: v });
      const arms = screen.getByTestId('venue-header').querySelector('img');
      expect(arms).not.toBeNull();
      expect(arms).toHaveStyle({ filter: theme.armsOutline });
      unmount();
    }
  });

  // VITE_APP_ENV is unset here, which reads as development, where the verband flag is on.
  it('leads the Verband line with the Teilverband badge, with the full name on hover', () => {
    renderModal({ venue: { ...venue, association_id: 'freiburg' } });
    const line = screen.getByTestId('venue-association');
    const badge = screen.getByText('SWSV');
    expect(line.firstElementChild).toBe(badge);
    expect(badge).toHaveAttribute('title', 'Südwestschweizer Schwingerverband');
    expect(line).toHaveTextContent('Freiburg');
  });

  it('shows only the contact rows that have a value', () => {
    renderModal({ venue: { ...venue, person: '', website: '' } });
    expect(screen.getByText(STR.de.contact)).toBeInTheDocument();
    expect(screen.queryByText(STR.de.person)).toBeNull();
    expect(screen.getByText(STR.de.phone)).toBeInTheDocument();
    expect(screen.queryByText(STR.de.website)).toBeNull();
  });

  it('leaves out the contact section when there is nothing to show', () => {
    renderModal({ venue: { ...venue, person: '', phone: '', website: '' } });
    expect(screen.queryByText(STR.de.contact)).toBeNull();
  });
});
