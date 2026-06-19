import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

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

import { AuthProvider } from '../auth/AuthProvider';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import type { Venue } from '../venues/types';
import { DetailModal } from './DetailModal';

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
  photo_url: null,
};

const noop = () => {};

const renderModal = () =>
  render(
    <AuthProvider>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <DetailModal
          venue={venue}
          onClose={noop}
          onNavigate={noop}
          onEdit={noop}
          onDelete={noop}
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
});
