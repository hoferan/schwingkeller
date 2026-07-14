import { describe, it, expect, vi, afterEach } from 'vitest';
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
import type { SortMode } from '../venues/grouping';
import type { LatLng } from '../venues/distance';
import type { GeoStatus } from '../geo/useGeolocation';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '3000 Bern', lat: 0, lng: 0,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photo_url: null, ...over,
});

// Distances: venue '1' Emmental in BE, '2'/'3' in LU. Given coords so distance is meaningful.
const venues = [
  v({ id: '1', name: 'Emmental', canton: 'BE', lat: 46.9, lng: 7.6 }),
  v({ id: '2', name: 'Willisau', canton: 'LU', lat: 47.1, lng: 8.0 }),
  v({ id: '3', name: 'Allmend', canton: 'LU', lat: 47.05, lng: 8.3 }),
];

interface HarnessProps {
  isMobile?: boolean;
  isTablet?: boolean;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onSetSidebarOpen?: (open: boolean) => void;
  venuesData?: Venue[];
  sortModeInit?: SortMode;
  userPosition?: LatLng | null;
  geoStatus?: GeoStatus;
  onRequestLocation?: () => void;
}

const Harness = ({
  isMobile = false,
  isTablet = false,
  sidebarOpen = true,
  onToggleSidebar = () => {},
  onSetSidebarOpen = () => {},
  venuesData = venues,
  sortModeInit = 'canton',
  userPosition = null,
  geoStatus = 'idle',
  onRequestLocation = () => {},
}: HarnessProps) => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(sortModeInit);
  return (
    <Sidebar
      venues={venuesData}
      search={search}
      onSearch={setSearch}
      expanded={expanded}
      onToggleCanton={(code) => setExpanded((e) => ({ ...e, [code]: !e[code] }))}
      selectedId={selectedId}
      onSelect={setSelectedId}
      isMobile={isMobile}
      isTablet={isTablet}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={onToggleSidebar}
      onSetSidebarOpen={onSetSidebarOpen}
      onAdd={vi.fn()}
      onExportJSON={vi.fn()}
      onExportCSV={vi.fn()}
      onImport={vi.fn()}
      sortMode={sortMode}
      onSortMode={setSortMode}
      userPosition={userPosition}
      geoStatus={geoStatus}
      onRequestLocation={onRequestLocation}
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders canton group names', async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());
    expect(screen.getByText('Luzern')).toBeInTheDocument();
  });

  it('shows the empty-state message for a canton with no venues when expanded', async () => {
    renderSidebar();
    // Zug has no venues in the fixture, but must still render as one of all 26 cantons.
    await waitFor(() => expect(screen.getByText('Zug')).toBeInTheDocument());
    expect(screen.queryByText(STR.de.cantonEmpty)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Zug'));

    await waitFor(() => expect(screen.getByText(STR.de.cantonEmpty)).toBeInTheDocument());
  });

  it('does not show the no-results banner when idle with no venues at all', async () => {
    renderSidebar({ venuesData: [] });
    // Empty cantons still render when idle (not searching), even with zero venues overall.
    await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());
    expect(screen.queryByText(STR.de.noResults)).not.toBeInTheDocument();
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

  it('keeps the full handle and header visible when the mobile sheet is collapsed', async () => {
    renderSidebar({ isMobile: true, sidebarOpen: false });
    await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());
    const sheet = screen.getByTestId('sidebar-root');
    // 116px = handle zone (8px+4px+8px = 20px) + header block (18px padding top/bottom = 36px,
    // + 19px/1.15 title line ≈ 21.85px, + 10px gap, + 12px/"normal" count-pill line + 12px
    // padding ≈ 26.4px), rounded up for font-metric slack — see the PEEK_HEIGHT comment.
    expect(sheet.style.height).toBe('116px');
  });

  it('renders the tablet panel off-screen to the left when collapsed', async () => {
    renderSidebar({ isTablet: true, sidebarOpen: false });
    await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());
    const panel = screen.getByTestId('sidebar-root');
    expect(panel.style.left).toBe('-344px');
  });

  it('slides the tablet panel fully into view when open', async () => {
    renderSidebar({ isTablet: true, sidebarOpen: true });
    await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());
    const panel = screen.getByTestId('sidebar-root');
    expect(panel.style.left).toBe('0px');
  });

  it('toggles the tablet panel via the floating arrow tab', async () => {
    const onToggleSidebar = vi.fn();
    renderSidebar({ isTablet: true, sidebarOpen: false, onToggleSidebar });
    const tab = await screen.findByTestId('sidebar-tablet-tab');

    fireEvent.click(tab);

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('closes the tablet panel on tap outside it', async () => {
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isTablet: true, sidebarOpen: true, onSetSidebarOpen });
    await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());

    fireEvent.pointerDown(document.body);

    expect(onSetSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('does not close the tablet panel on tap inside it', async () => {
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isTablet: true, sidebarOpen: true, onSetSidebarOpen });
    const bern = await screen.findByText('Bern');

    fireEvent.pointerDown(bern);

    expect(onSetSidebarOpen).not.toHaveBeenCalled();
  });

  it('commits to opening the tablet panel once dragged right past 25% of its width', async () => {
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isTablet: true, sidebarOpen: false, onSetSidebarOpen });
    const tab = await screen.findByTestId('sidebar-tablet-tab');

    fireEvent.touchStart(tab, { touches: [{ clientX: 100 }] });
    fireEvent.touchMove(tab, { touches: [{ clientX: 190 }] }); // 90px right, past 86px (25% of 344)
    fireEvent.touchEnd(tab, { changedTouches: [{ clientX: 190 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('snaps the tablet panel back to closed when dragged right just short of 25%', async () => {
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isTablet: true, sidebarOpen: false, onSetSidebarOpen });
    const tab = await screen.findByTestId('sidebar-tablet-tab');

    fireEvent.touchStart(tab, { touches: [{ clientX: 100 }] });
    fireEvent.touchMove(tab, { touches: [{ clientX: 180 }] }); // 80px right, short of 86px
    fireEvent.touchEnd(tab, { changedTouches: [{ clientX: 180 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('commits to closing the tablet panel once dragged left past 25% of its width', async () => {
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isTablet: true, sidebarOpen: true, onSetSidebarOpen });
    const header = await screen.findByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(header, { touches: [{ clientX: 110 }] }); // 90px left, past 86px
    fireEvent.touchEnd(header, { changedTouches: [{ clientX: 110 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('snaps the tablet panel back to open when dragged left just short of 25%', async () => {
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isTablet: true, sidebarOpen: true, onSetSidebarOpen });
    const header = await screen.findByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(header, { touches: [{ clientX: 120 }] }); // 80px left, short of 86px
    fireEvent.touchEnd(header, { changedTouches: [{ clientX: 120 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('does not start a tablet drag from the venue list body', async () => {
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isTablet: true, sidebarOpen: true, onSetSidebarOpen });
    const list = screen.getByTestId('sidebar-list');

    fireEvent.touchStart(list, { touches: [{ clientX: 200 }] });
    const dispatched = fireEvent.touchMove(list, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(list, { changedTouches: [{ clientX: 100 }] });

    expect(onSetSidebarOpen).not.toHaveBeenCalled();
    // Not cancelled — the panel didn't intercept the gesture, so native list scrolling proceeds.
    expect(dispatched).toBe(true);
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
    // the (cancelable) touchend — proving the compat-click suppression ran.
    expect(dispatched).toBe(false);
  });

  it('still treats a header tap with tiny jitter as a tap toggle', () => {
    const onToggleSidebar = vi.fn();
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: false, onToggleSidebar, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(header, { touches: [{ clientY: 103 }] }); // 3px finger roll — real taps do this
    fireEvent.touchEnd(header, { changedTouches: [{ clientY: 103 }] });

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
    expect(onSetSidebarOpen).not.toHaveBeenCalled();
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

  it('opens the drawer on a large upward drag from the header', () => {
    const onToggleSidebar = vi.fn();
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: false, onToggleSidebar, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 200 }] });
    fireEvent.touchMove(header, { touches: [{ clientY: 50 }] });
    fireEvent.touchEnd(header, { changedTouches: [{ clientY: 50 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(true);
    expect(onToggleSidebar).not.toHaveBeenCalled();
  });

  it('closes the drawer on a large downward drag from the header', () => {
    const onToggleSidebar = vi.fn();
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: true, onToggleSidebar, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(header, { touches: [{ clientY: 250 }] });
    fireEvent.touchEnd(header, { changedTouches: [{ clientY: 250 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(false);
    expect(onToggleSidebar).not.toHaveBeenCalled();
  });

  it('commits to closing once dragged just past 25% of the peek-to-open range', () => {
    vi.stubGlobal('innerHeight', 800); // open height = 640px, range = 524px, 25% = 131px
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: true, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(header, { touches: [{ clientY: 240 }] }); // 140px down, past 133px
    fireEvent.touchEnd(header, { changedTouches: [{ clientY: 240 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('snaps back to open when dragged just short of 25% of the range', () => {
    vi.stubGlobal('innerHeight', 800); // open height = 640px, range = 524px, 25% = 131px
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: true, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(header, { touches: [{ clientY: 225 }] }); // 125px down, short of 133px
    fireEvent.touchEnd(header, { changedTouches: [{ clientY: 225 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('commits to opening once dragged just past 25% of the peek-to-open range', () => {
    vi.stubGlobal('innerHeight', 800); // open height = 640px, range = 524px, 25% = 131px
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: false, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 300 }] });
    fireEvent.touchMove(header, { touches: [{ clientY: 160 }] }); // 140px up, past 133px
    fireEvent.touchEnd(header, { changedTouches: [{ clientY: 160 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('snaps back to peek when dragged just short of 25% of the range upward', () => {
    vi.stubGlobal('innerHeight', 800); // open height = 640px, range = 524px, 25% = 131px
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: false, onSetSidebarOpen });
    const header = screen.getByTestId('sidebar-header');

    fireEvent.touchStart(header, { touches: [{ clientY: 300 }] });
    fireEvent.touchMove(header, { touches: [{ clientY: 175 }] }); // 125px up, short of 133px
    fireEvent.touchEnd(header, { changedTouches: [{ clientY: 175 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('starts dragging from the list body immediately when the sheet is in peek state', () => {
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: false, onSetSidebarOpen });
    const list = screen.getByTestId('sidebar-list');

    fireEvent.touchStart(list, { touches: [{ clientY: 200 }] });
    fireEvent.touchMove(list, { touches: [{ clientY: 50 }] });
    fireEvent.touchEnd(list, { changedTouches: [{ clientY: 50 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('does not intercept a list-body drag when open and not scrolled to the top', () => {
    const onToggleSidebar = vi.fn();
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: true, onToggleSidebar, onSetSidebarOpen });
    const list = screen.getByTestId('sidebar-list');
    list.scrollTop = 50;

    fireEvent.touchStart(list, { touches: [{ clientY: 100 }] });
    const dispatched = fireEvent.touchMove(list, { touches: [{ clientY: 250 }] });
    fireEvent.touchEnd(list, { changedTouches: [{ clientY: 250 }] });

    expect(onToggleSidebar).not.toHaveBeenCalled();
    expect(onSetSidebarOpen).not.toHaveBeenCalled();
    // Not cancelled — the sheet didn't intercept the gesture, so native list scrolling proceeds.
    expect(dispatched).toBe(true);
  });

  it('starts a close-drag from the list body once scrolled to the top and dragging down', () => {
    const onSetSidebarOpen = vi.fn();
    renderSidebar({ isMobile: true, sidebarOpen: true, onSetSidebarOpen });
    const list = screen.getByTestId('sidebar-list');
    list.scrollTop = 0;

    fireEvent.touchStart(list, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(list, { touches: [{ clientY: 250 }] });
    fireEvent.touchEnd(list, { changedTouches: [{ clientY: 250 }] });

    expect(onSetSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('renders the sort control', async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText(STR.de.sortName)).toBeInTheDocument());
    expect(screen.getByText(STR.de.sortDistance)).toBeInTheDocument();
  });

  it('flattens the list when sorting by name (no canton expand needed)', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await waitFor(() => expect(screen.getByText(STR.de.sortName)).toBeInTheDocument());
    await user.click(screen.getByText(STR.de.sortName));
    // All venue names visible without expanding any canton group:
    expect(screen.getByText('Allmend')).toBeInTheDocument();
    expect(screen.getByText('Emmental')).toBeInTheDocument();
    expect(screen.getByText('Willisau')).toBeInTheDocument();
  });

  it('requests location when Distance is picked without a position', async () => {
    const onRequestLocation = vi.fn();
    const user = userEvent.setup();
    renderSidebar({ onRequestLocation });
    await waitFor(() => expect(screen.getByText(STR.de.sortDistance)).toBeInTheDocument());
    await user.click(screen.getByText(STR.de.sortDistance));
    expect(onRequestLocation).toHaveBeenCalledTimes(1);
  });

  it('shows distance badges only when sorting by distance with a position', async () => {
    const user = userEvent.setup();
    renderSidebar({ userPosition: { lat: 46.95, lng: 7.45 } });
    await waitFor(() => expect(screen.getByText(STR.de.sortDistance)).toBeInTheDocument());
    // No badges in canton mode:
    expect(screen.queryByText(/km$/)).not.toBeInTheDocument();
    await user.click(screen.getByText(STR.de.sortDistance));
    // Nearest (Emmental, closest to origin) appears with a km badge:
    await waitFor(() => expect(screen.getAllByText(/km$/).length).toBeGreaterThan(0));
  });

  it('hides the Distance option when geolocation is unsupported', async () => {
    renderSidebar({ geoStatus: 'unsupported' });
    await waitFor(() => expect(screen.getByText(STR.de.sortName)).toBeInTheDocument());
    expect(screen.queryByText(STR.de.sortDistance)).not.toBeInTheDocument();
  });
});
