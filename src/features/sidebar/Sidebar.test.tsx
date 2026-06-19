import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
import { Sidebar } from './Sidebar';
import type { Venue } from '../venues/types';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '3000 Bern', lat: 0, lng: 0,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photo_url: null, ...over,
});

const venues = [
  v({ id: '1', name: 'Emmental', canton: 'BE' }),
  v({ id: '2', name: 'Willisau', canton: 'LU' }),
  v({ id: '3', name: 'Allmend', canton: 'LU' }),
];

const Harness = () => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <Sidebar
      venues={venues}
      search={search}
      onSearch={setSearch}
      expanded={expanded}
      onToggleCanton={(code) => setExpanded((e) => ({ ...e, [code]: !e[code] }))}
      selectedId={selectedId}
      onSelect={setSelectedId}
      isMobile={false}
      sidebarOpen={true}
      onToggleSidebar={vi.fn()}
      onAdd={vi.fn()}
      onExportJSON={vi.fn()}
      onExportCSV={vi.fn()}
      onImport={vi.fn()}
    />
  );
};

const renderSidebar = () =>
  render(
    <AuthProvider>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <Harness />
      </I18nContext.Provider>
    </AuthProvider>,
  );

describe('Sidebar', () => {
  it('renders canton group names', async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());
    expect(screen.getByText('Luzern')).toBeInTheDocument();
  });

  it('filters venues as the user types in the search box', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await waitFor(() => expect(screen.getByText('Luzern')).toBeInTheDocument());
    // Groups start collapsed, so no venue rows are visible yet.
    expect(screen.queryByText('Emmental')).not.toBeInTheDocument();

    // Searching expands all matching groups (prototype line ~479).
    await user.type(screen.getByPlaceholderText(STR.de.search), 'willi');

    await waitFor(() => expect(screen.getByText('Willisau')).toBeInTheDocument());
    expect(screen.queryByText('Emmental')).not.toBeInTheDocument();
    expect(screen.queryByText('Bern')).not.toBeInTheDocument();
  });

  it('hides admin tools when not admin', async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());
    expect(screen.queryByText(STR.de.add)).not.toBeInTheDocument();
  });
});
