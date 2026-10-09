import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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
import { STR, type Lang } from '../../i18n/translations';
import { Sidebar } from './Sidebar';
import type { Venue } from '../venues/types';
import type { PosterTarget } from '../venues/posterSubject';
import type { SortMode } from '../venues/grouping';
import type { LatLng } from '../venues/distance';
import type { GeoStatus } from '../geo/useGeolocation';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '3000 Bern', lat: 0, lng: 0,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: 'emmental', ...over,
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
  onAdd?: () => void;
  onGeneratePoster?: (target: PosterTarget) => void;
  onSelect?: (id: string) => void;
  expandedInit?: Record<string, boolean>;
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
  onAdd = () => {},
  onGeneratePoster = () => {},
  onSelect = () => {},
  expandedInit = {},
}: HarnessProps) => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>(expandedInit);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(sortModeInit);
  return (
    <Sidebar
      venues={venuesData}
      search={search}
      onSearch={setSearch}
      expanded={expanded}
      onToggleGroup={(key) => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
      selectedId={selectedId}
      onSelect={(id) => { setSelectedId(id); onSelect(id); }}
      isMobile={isMobile}
      isTablet={isTablet}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={onToggleSidebar}
      onSetSidebarOpen={onSetSidebarOpen}
      onAdd={onAdd}
      sortMode={sortMode}
      onSortMode={setSortMode}
      userPosition={userPosition}
      geoStatus={geoStatus}
      onRequestLocation={onRequestLocation}
      onGeneratePoster={onGeneratePoster}
    />
  );
};

const renderSidebar = (props: HarnessProps = {}, lang: Lang = 'de') =>
  render(
    <AuthProvider>
      <I18nContext.Provider value={{ lang, t: STR[lang] as typeof STR.de, setLang: vi.fn() }}>
        <Harness {...props} />
      </I18nContext.Provider>
    </AuthProvider>,
  );

const renderAdminSidebar = (props: HarnessProps = {}) => {
  getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'admin' } } } });
  return renderSidebar(props);
};

describe('Sidebar', () => {
  // These tests describe the canton view, which is what production shows until the verband flag
  // goes on there.
  beforeEach(() => { vi.stubEnv('VITE_APP_ENV', 'production'); });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    localStorage.clear();
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

  it('filters the list to outdoor venues when the Outdoor chip is toggled', async () => {
    const user = userEvent.setup();
    const mixed = [
      v({ id: '1', name: 'InnenKeller', canton: 'BE', indoor: true, outdoor: false }),
      v({ id: '2', name: 'AussenPlatz', canton: 'LU', indoor: false, outdoor: true }),
    ];
    renderSidebar({ venuesData: mixed });
    const outdoor = await screen.findByRole('button', { name: STR.de.outdoor });
    expect(outdoor).toHaveAttribute('aria-pressed', 'false');

    await user.click(outdoor);

    expect(outdoor).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getByText('AussenPlatz')).toBeInTheDocument());
    expect(screen.queryByText('InnenKeller')).not.toBeInTheDocument();
  });

  it('shows the union when both chips are active', async () => {
    const user = userEvent.setup();
    const mixed = [
      v({ id: '1', name: 'InnenKeller', canton: 'BE', indoor: true, outdoor: false }),
      v({ id: '2', name: 'AussenPlatz', canton: 'LU', indoor: false, outdoor: true }),
      v({ id: '3', name: 'Nirgends', canton: 'ZH', indoor: false, outdoor: false }),
    ];
    renderSidebar({ venuesData: mixed });

    await user.click(await screen.findByRole('button', { name: STR.de.indoor }));
    await user.click(await screen.findByRole('button', { name: STR.de.outdoor }));

    await waitFor(() => expect(screen.getByText('InnenKeller')).toBeInTheDocument());
    expect(screen.getByText('AussenPlatz')).toBeInTheDocument();
    expect(screen.queryByText('Nirgends')).not.toBeInTheDocument();
  });

  it('clears the facet when an active chip is toggled off again', async () => {
    const user = userEvent.setup();
    const mixed = [
      v({ id: '1', name: 'InnenKeller', canton: 'BE', indoor: true, outdoor: false }),
      v({ id: '2', name: 'AussenPlatz', canton: 'LU', indoor: false, outdoor: true }),
    ];
    renderSidebar({ venuesData: mixed });
    const outdoor = await screen.findByRole('button', { name: STR.de.outdoor });

    await user.click(outdoor); // on
    await user.click(outdoor); // off

    expect(outdoor).toHaveAttribute('aria-pressed', 'false');
    // Idle again: groups collapse, so no venue rows are visible and no no-results banner shows.
    expect(screen.queryByText(STR.de.noResults)).not.toBeInTheDocument();
  });

  it('shows the no-results banner when a facet matches nothing', async () => {
    const user = userEvent.setup();
    const indoorOnly = [
      v({ id: '1', name: 'InnenKeller', canton: 'BE', indoor: true, outdoor: false }),
    ];
    renderSidebar({ venuesData: indoorOnly });

    await user.click(await screen.findByRole('button', { name: STR.de.outdoor }));

    await waitFor(() => expect(screen.getByText(STR.de.noResults)).toBeInTheDocument());
  });

  it('hides admin tools when not admin', async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());
    expect(screen.queryByTestId('admin-section')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: STR.de.add })).not.toBeInTheDocument();
  });

  it('renders the Verwaltung band above the search box when admin', async () => {
    renderAdminSidebar();
    const band = await screen.findByTestId('admin-section');
    const searchInput = screen.getByPlaceholderText(STR.de.search);
    // Band must appear before the search input in document order.
    expect(band.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('adds a venue in one click', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderAdminSidebar({ onAdd });
    // Add is the band's only action and is reachable directly.
    const addBtn = await screen.findByRole('button', { name: STR.de.add });
    expect(screen.queryByText('JSON')).not.toBeInTheDocument();

    await user.click(addBtn);

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows no import or export to the admin, even with an old open-band setting', async () => {
    // The band once had an expand toggle that revealed export and import; both are gone, and a value
    // a browser kept from then must not bring anything back.
    localStorage.setItem('sk-verwaltung-open', 'true');
    renderAdminSidebar();
    await screen.findByRole('button', { name: STR.de.add });
    expect(screen.queryByText('JSON')).toBeNull();
    expect(screen.queryByText('CSV')).toBeNull();
    expect(screen.queryByText('Import')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Verwaltung ein-/ausblenden' })).toBeNull();
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

  it('labels the list section by canton in canton sort mode', async () => {
    renderSidebar({ sortModeInit: 'canton' });
    await waitFor(() => expect(screen.getByText(STR.de.byCanton)).toBeInTheDocument());
    expect(screen.queryByText(STR.de.byName)).not.toBeInTheDocument();
  });

  it('relabels the list section when sorting by name', async () => {
    renderSidebar({ sortModeInit: 'name' });
    await waitFor(() => expect(screen.getByText(STR.de.byName)).toBeInTheDocument());
    expect(screen.queryByText(STR.de.byCanton)).not.toBeInTheDocument();
  });

  it('relabels the list section when sorting by distance', async () => {
    renderSidebar({ sortModeInit: 'distance', userPosition: { lat: 46.95, lng: 7.45 } });
    await waitFor(() => expect(screen.getByText(STR.de.byDistance)).toBeInTheDocument());
    expect(screen.queryByText(STR.de.byCanton)).not.toBeInTheDocument();
  });

  it('selects a venue when its row is clicked in the canton list', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderSidebar({ onSelect });
    await user.type(screen.getByPlaceholderText(STR.de.search), 'willi');

    const row = await screen.findByTestId('venue-row');
    expect(row).toHaveTextContent('Willisau');
    await user.click(row);

    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('selects a venue when its row is clicked in the list sorted by name', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderSidebar({ sortModeInit: 'name', onSelect });

    const rows = await screen.findAllByTestId('venue-row');
    // The flat list shows every venue, alphabetically, without expanding a canton first.
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Allmend'),
      expect.stringContaining('Emmental'),
      expect.stringContaining('Willisau'),
    ]);
    await user.click(rows[0]);

    expect(onSelect).toHaveBeenCalledWith('3');
  });

  it('shows the total count only once (header pill, not the section header)', async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());
    // "3 Schwingkeller" (venues fixture has 3) must appear exactly once — the dark header pill.
    expect(screen.getAllByText(`3 ${STR.de.unitTotal}`)).toHaveLength(1);
  });

  it('does not show a generate-poster icon for non-admins', async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: STR.de.generatePoster })).not.toBeInTheDocument();
  });

  it('shows the generate-poster icon even for a canton with zero venues when admin', async () => {
    renderAdminSidebar();
    const row = (await screen.findByText('Zug')).closest('div')!;
    expect(
      await within(row).findByRole('button', { name: STR.de.generatePoster }),
    ).toBeInTheDocument();
  });

  it('tags each generate-poster button with its canton code, so a browser test can address one', async () => {
    renderAdminSidebar();
    await screen.findByText('Bern');

    expect(screen.getByTestId('generate-poster-BE')).toHaveAccessibleName(STR.de.generatePoster);
    expect(screen.getByTestId('generate-poster-FR')).toBeInTheDocument();
  });

  it('calls onGeneratePoster with the canton code and does not toggle the group', async () => {
    const user = userEvent.setup();
    const onGeneratePoster = vi.fn();
    renderAdminSidebar({ onGeneratePoster });
    const row = (await screen.findByText('Bern')).closest('div')!;
    const button = await within(row).findByRole('button', { name: STR.de.generatePoster });

    await user.click(button);

    expect(onGeneratePoster).toHaveBeenCalledWith({ kind: 'canton', code: 'BE' });
    expect(screen.queryByText('Emmental')).not.toBeInTheDocument();
  });
});

describe('Sidebar width handle', () => {
  // The handle doesn't depend on the verband flag; production's value keeps the canton list, whose
  // names the tests wait for.
  beforeEach(() => { vi.stubEnv('VITE_APP_ENV', 'production'); });
  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  // jsdom's window is 1024px wide, so the widest the column may get is 40% of that: 410px.
  const handle = () => screen.getByRole('separator', { name: STR.de.resizeSidebar });
  const columnWidth = () => screen.getByTestId('sidebar-root').style.width;

  it('shows a handle on the desktop column, at the default width', async () => {
    renderSidebar();
    await screen.findByText('Bern');
    expect(handle()).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle()).toHaveAttribute('aria-valuenow', '344');
    expect(handle()).toHaveAttribute('aria-valuemin', '280');
    expect(handle()).toHaveAttribute('aria-valuemax', '410');
    expect(columnWidth()).toBe('344px');
  });

  it('shows no handle on the tablet panel or the mobile drawer', async () => {
    const { unmount } = renderSidebar({ isTablet: true });
    await screen.findByText('Bern');
    expect(screen.queryByRole('separator')).toBeNull();
    unmount();
    renderSidebar({ isMobile: true });
    await screen.findByText('Bern');
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('starts at the width stored by an earlier visit', async () => {
    localStorage.setItem('sk-sidebar-width', '400');
    renderSidebar();
    await screen.findByText('Bern');
    expect(columnWidth()).toBe('400px');
  });

  it('follows a pointer drag and stores the width when the drag ends', async () => {
    renderSidebar();
    await screen.findByText('Bern');
    fireEvent.pointerDown(handle(), { pointerId: 1, button: 0, clientX: 344 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 390 });
    expect(columnWidth()).toBe('390px');
    expect(localStorage.getItem('sk-sidebar-width')).toBeNull();
    fireEvent.pointerUp(handle(), { pointerId: 1, clientX: 390 });
    expect(localStorage.getItem('sk-sidebar-width')).toBe('390');
  });

  it('ignores pointer moves when no drag is going on', async () => {
    renderSidebar();
    await screen.findByText('Bern');
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 390 });
    expect(columnWidth()).toBe('344px');
  });

  it('keeps a dragged width within the range', async () => {
    renderSidebar();
    await screen.findByText('Bern');
    fireEvent.pointerDown(handle(), { pointerId: 1, button: 0, clientX: 344 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 900 });
    expect(columnWidth()).toBe('410px');
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 50 });
    expect(columnWidth()).toBe('280px');
  });

  it('widens and narrows with the arrow keys', async () => {
    renderSidebar();
    await screen.findByText('Bern');
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(columnWidth()).toBe('360px');
    expect(localStorage.getItem('sk-sidebar-width')).toBe('360');
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
    expect(columnWidth()).toBe('328px');
  });

  it('goes back to the default width on a double-click', async () => {
    localStorage.setItem('sk-sidebar-width', '400');
    renderSidebar();
    await screen.findByText('Bern');
    fireEvent.doubleClick(handle());
    expect(columnWidth()).toBe('344px');
    expect(localStorage.getItem('sk-sidebar-width')).toBe('344');
  });
});

// VITE_APP_ENV is unset here, which reads as development, where the verband flag is on.
describe('Sidebar with the verband flag', () => {
  const REGIONAL_OPEN = { bksv: true, isv: true, nosv: true, nwsv: true, swsv: true };
  const flagVenues = [
    v({ id: 'f1', name: 'Halle Düdingen', canton: 'FR', association_id: 'freiburg', indoor: true, outdoor: false }),
    v({ id: 'f2', name: 'Keller Plaffeien', canton: 'FR', association_id: 'freiburg', indoor: false, outdoor: true }),
    v({ id: 'b1', name: 'Keller Langnau', canton: 'BE', association_id: 'emmental' }),
    v({ id: 'l1', name: 'Keller Willisau', canton: 'LU', association_id: 'luzern' }),
  ];
  const renderFlagged = (props: HarnessProps = {}, lang: Lang = 'de') =>
    renderSidebar({ venuesData: flagVenues, sortModeInit: 'association', expandedInit: REGIONAL_OPEN, ...props }, lang);
  const rowNames = () => screen.queryAllByTestId('venue-row').map((r) => r.textContent);

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('groups by Teilverband and Verband', async () => {
    renderFlagged();
    expect(await screen.findByTestId('group-bksv')).toBeInTheDocument();
    expect(screen.getByTestId('group-emmental')).toBeInTheDocument();
    expect(screen.queryByText('Bern')).toBeNull();
  });

  it('offers Verband instead of Kanton in the sort control and labels the section', async () => {
    renderFlagged();
    expect(await screen.findByRole('radio', { name: STR.de.sortAssociation })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('radio', { name: STR.de.sortCanton })).toBeNull();
    expect(screen.getByText(STR.de.byAssociation)).toBeInTheDocument();
  });

  it('finds venues by Verband name', async () => {
    const user = userEvent.setup();
    renderFlagged();
    await user.type(screen.getByPlaceholderText(STR.de.search), 'Emmental');
    expect(rowNames()).toEqual([expect.stringContaining('Keller Langnau')]);
  });

  it('finds venues by Teilverband abbreviation, ignoring case and spaces', async () => {
    const user = userEvent.setup();
    renderFlagged();
    await user.type(screen.getByPlaceholderText(STR.de.search), '  bksv ');
    expect(rowNames()).toEqual([expect.stringContaining('Keller Langnau')]);
  });

  it('finds venues by canton name', async () => {
    const user = userEvent.setup();
    renderFlagged();
    await user.type(screen.getByPlaceholderText(STR.de.search), 'Luzern');
    expect(rowNames()).toEqual([expect.stringContaining('Keller Willisau')]);
  });

  it('finds venues by the French abbreviation in French', async () => {
    const user = userEvent.setup();
    renderFlagged({}, 'fr');
    await user.type(screen.getByPlaceholderText(STR.fr.search), 'ARLS');
    expect(rowNames()).toEqual([
      expect.stringContaining('Halle Düdingen'),
      expect.stringContaining('Keller Plaffeien'),
    ]);
  });

  it('closes the forced-open groups again when the search is cleared', async () => {
    const user = userEvent.setup();
    renderFlagged();
    await user.type(screen.getByPlaceholderText(STR.de.search), 'Emmental');
    expect(rowNames()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'clear' }));
    expect(rowNames()).toEqual([]);
    expect(screen.getByTestId('group-emmental')).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows only matching groups, open, for a facet filter alone', async () => {
    const user = userEvent.setup();
    renderFlagged();
    await user.click(screen.getByRole('button', { name: STR.de.outdoor }));
    expect(screen.getByTestId('group-freiburg')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByTestId('group-bksv')).toBeNull();
    expect(rowNames()).toEqual([expect.stringContaining('Keller Plaffeien')]);
  });

  it('shows the association dot next to the arms when sorted by name', async () => {
    renderFlagged({ sortModeInit: 'name' });
    const rows = await screen.findAllByTestId('venue-row');
    expect(rows).toHaveLength(4);
    rows.forEach((row) => {
      expect(row.querySelector('img')).not.toBeNull();
      expect(row.querySelector('span[aria-hidden="true"]')).not.toBeNull();
    });
  });

  it('asks admins for a Verband poster from its row with the flag on', async () => {
    const user = userEvent.setup();
    const onGeneratePoster = vi.fn();
    renderAdminSidebar({
      venuesData: flagVenues, sortModeInit: 'association', expandedInit: REGIONAL_OPEN, onGeneratePoster,
    });
    await user.click(await screen.findByTestId('generate-poster-freiburg'));
    expect(onGeneratePoster).toHaveBeenCalledWith({ kind: 'association', id: 'freiburg' });
    expect(screen.queryByTestId('generate-poster-FR')).toBeNull();
  });

  it('shows non-admins no poster button with the flag on', async () => {
    renderFlagged();
    expect(await screen.findByTestId('group-freiburg')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: STR.de.generatePoster })).toBeNull();
  });
});
