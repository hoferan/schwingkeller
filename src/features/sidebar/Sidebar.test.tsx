import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

interface HarnessProps {
  isMobile?: boolean;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onSetSidebarOpen?: (open: boolean) => void;
}

const Harness = ({
  isMobile = false,
  sidebarOpen = true,
  onToggleSidebar = () => {},
  onSetSidebarOpen = () => {},
}: HarnessProps) => {
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
      isMobile={isMobile}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={onToggleSidebar}
      onSetSidebarOpen={onSetSidebarOpen}
      onAdd={vi.fn()}
      onExportJSON={vi.fn()}
      onExportCSV={vi.fn()}
      onImport={vi.fn()}
    />
  );
};

const renderSidebar = (props: HarnessProps = {}) =>
  render(
    <AuthProvider>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <Harness {...props} />
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

  it('closes the mobile drawer on tap outside it', async () => {
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: true, onSetSidebarOpen });
    await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());

    fireEvent.pointerDown(document.body);

    expect(onSetSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('does not close the mobile drawer on tap inside it', async () => {
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: true, onSetSidebarOpen });
    const bern = await screen.findByText('Bern');

    fireEvent.pointerDown(bern);

    expect(onSetSidebarOpen).not.toHaveBeenCalled();
  });

  it('treats a small header touch as a tap toggle', () => {
    const onToggleSidebar = vi.fn();
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: false, onToggleSidebar, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 100 }] });
    const dispatched = fireEvent.touchEnd(header, { changedTouches: [{ clientY: 104 }] });

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
    expect(onSetSidebarOpen).not.toHaveBeenCalled();
    // fireEvent returns dispatchEvent's result, which is false when preventDefault() was called on
    // the (cancelable) touchend — proving the compat-click suppression in handleHeaderTouchEnd ran.
    expect(dispatched).toBe(false);
  });

  it('opens the drawer on an upward swipe past the threshold', () => {
    const onToggleSidebar = vi.fn();
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: false, onToggleSidebar, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 200 }] });
    fireEvent.touchEnd(header, { changedTouches: [{ clientY: 150 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(true);
    expect(onToggleSidebar).not.toHaveBeenCalled();
  });

  it('closes the drawer on a downward swipe past the threshold', () => {
    const onToggleSidebar = vi.fn();
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: true, onToggleSidebar, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(header, { changedTouches: [{ clientY: 160 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(false);
    expect(onToggleSidebar).not.toHaveBeenCalled();
  });

  it('does nothing in the dead zone between tap and swipe thresholds', () => {
    const onToggleSidebar = vi.fn();
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: false, onToggleSidebar, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(header, { changedTouches: [{ clientY: 118 }] });

    expect(onToggleSidebar).not.toHaveBeenCalled();
    expect(onSetSidebarOpen).not.toHaveBeenCalled();
  });

  it('treats exactly 10px as the dead zone, not a tap', () => {
    const onToggleSidebar = vi.fn();
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: false, onToggleSidebar, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(header, { changedTouches: [{ clientY: 110 }] });

    expect(onToggleSidebar).not.toHaveBeenCalled();
    expect(onSetSidebarOpen).not.toHaveBeenCalled();
  });

  it('treats exactly 30px downward as the swipe-close boundary', () => {
    const onToggleSidebar = vi.fn();
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: true, onToggleSidebar, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(header, { changedTouches: [{ clientY: 130 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(false);
    expect(onToggleSidebar).not.toHaveBeenCalled();
  });

  it('treats exactly -30px upward as the swipe-open boundary', () => {
    const onToggleSidebar = vi.fn();
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: false, onToggleSidebar, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(header, { changedTouches: [{ clientY: 70 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(true);
    expect(onToggleSidebar).not.toHaveBeenCalled();
  });
});
