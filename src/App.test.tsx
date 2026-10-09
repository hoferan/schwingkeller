import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { STR } from './i18n/translations';
import type { Venue } from './features/venues/types';
import type { CantonalId } from './data/associations';
import { ASSOCIATION_HOME_BOUNDS } from './data/associationBounds';
import { boundsForCanton } from './data/cantonBounds';

// App is the composition root. We stub the heavy children/hooks and drive the poster-editor wiring
// (Sidebar's onGeneratePoster → open editor → onSave downloads + closes → onError flashes).
const venue: Venue = {
  id: '1', name: 'Emmental', canton: 'BE', address: '', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: 'emmental',
};

// supabase.ts calls createClient at import time and throws without env vars — stub it (App's
// import graph pulls it in via the auth modules, even though this test never exercises auth).
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));
const mocked = vi.hoisted(() => ({ venues: null as Venue[] | null, loaded: true }));
vi.mock('./features/venues/useVenues', () => ({
  useVenues: () => ({ data: mocked.loaded ? (mocked.venues ?? [venue]) : undefined, isSuccess: mocked.loaded }),
  useVenueMutations: () => ({}),
}));
vi.mock('./features/geo/useGeolocation', () => ({
  useGeolocation: () => ({ status: 'idle', position: null, request: vi.fn(), supported: false }),
}));
vi.mock('./features/venues/useVenuePermalink', () => ({ useVenuePermalink: () => {} }));
vi.mock('./lib/sentry', () => ({ captureAndFormat: (_e: unknown, fallback: string) => fallback }));
vi.mock('./components/Topbar', () => ({ Topbar: () => <div data-testid="topbar" /> }));
vi.mock('./features/map/MapView', () => ({
  MapView: ({ initialFocusBounds }: { initialFocusBounds: unknown }) => (
    <div data-testid="mapview">
      <span data-testid="focus-bounds">{JSON.stringify(initialFocusBounds ?? null)}</span>
    </div>
  ),
}));
vi.mock('./features/sidebar/Sidebar', () => ({
  Sidebar: ({ onGeneratePoster, expanded, sortMode }: {
    onGeneratePoster: (target: { kind: 'canton'; code: string } | { kind: 'association'; id: string }) => void;
    expanded: Record<string, boolean>; sortMode: string;
  }) => (
    <div>
      <button onClick={() => onGeneratePoster({ kind: 'canton', code: 'BE' })}>gen-poster</button>
      <button onClick={() => onGeneratePoster({ kind: 'association', id: 'freiburg' })}>gen-poster-vb</button>
      <button onClick={() => onGeneratePoster({ kind: 'association', id: 'nope' })}>gen-poster-bad</button>
      <span data-testid="expanded-state">{JSON.stringify(expanded)}</span>
      <span data-testid="sort-mode">{sortMode}</span>
    </div>
  ),
}));
vi.mock('./features/venues/PosterEditorModal', () => ({
  PosterEditorModal: ({ subject, onSave, onError, onClose }: {
    subject: { id: string; venues: unknown[] };
    onSave: (b: Blob, f: string) => void; onError: (e: unknown) => void; onClose: () => void;
  }) => (
    <div data-testid="poster-editor">
      <span>editor:{subject.id}</span>
      <span data-testid="poster-editor-venues">{subject.venues.length}</span>
      <button onClick={() => onSave(new Blob(['x'], { type: 'image/png' }), 'schwingkeller-be.png')}>ed-save</button>
      <button onClick={() => onError(new Error('boom'))}>ed-error</button>
      <button onClick={onClose}>ed-close</button>
    </div>
  ),
}));

import App from './App';

describe('App — sidebar default state', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('starts with no canton expanded with the flag off', () => {
    vi.stubEnv('VITE_APP_ENV', 'production');
    render(<App />);
    expect(screen.getByTestId('expanded-state')).toHaveTextContent('{}');
  });

  it('sorts by canton by default with the flag off', () => {
    vi.stubEnv('VITE_APP_ENV', 'production');
    render(<App />);
    expect(screen.getByTestId('sort-mode')).toHaveTextContent('canton');
  });

  // VITE_APP_ENV unset reads as development, where the verband flag is on.
  it('opens the Teilverbände by default with the flag on', () => {
    render(<App />);
    expect(JSON.parse(screen.getByTestId('expanded-state').textContent!)).toEqual({
      bksv: true, isv: true, nosv: true, nwsv: true, swsv: true,
    });
  });

  it('sorts by association by default with the flag on', () => {
    render(<App />);
    expect(screen.getByTestId('sort-mode')).toHaveTextContent('association');
  });
});

describe('App — permalinks', () => {
  const at = (lat: number, lng: number, association_id: CantonalId, canton: string, id: string): Venue => ({
    ...venue, id, lat, lng, association_id, canton,
  });
  const expandedState = () => JSON.parse(screen.getByTestId('expanded-state').textContent!) as Record<string, boolean>;
  const focusBounds = () => JSON.parse(screen.getByTestId('focus-bounds').textContent!) as unknown;
  const openAt = (search: string) => window.history.replaceState(null, '', '/' + search);

  beforeEach(() => {
    mocked.venues = [
      at(46.95, 7.6, 'emmental', 'BE', 'e1'),
      at(47.05, 7.8, 'emmental', 'BE', 'e2'),
      at(46.6, 7.9, 'oberland', 'BE', 'o1'),
      at(47.4, 8.5, 'zuerich', 'ZH', 'z1'),
      at(47.45, 8.6, 'zuerich', 'AG', 'z2'),
      at(47.33, 9.41, 'appenzell', 'AI', 'a1'),
    ];
  });
  afterEach(() => {
    mocked.venues = null;
    openAt('');
    vi.unstubAllEnvs();
  });

  describe('with the verband flag on', () => {
    it("expands BKSV and Emmental for ?vb=emmental and frames Emmental's venues", () => {
      openAt('?vb=emmental');
      render(<App />);
      expect(expandedState()).toMatchObject({ bksv: true, emmental: true });
      expect(focusBounds()).toEqual([[46.95, 7.6], [47.05, 7.8]]);
    });

    it('reads ?vb= case-insensitively', () => {
      openAt('?vb=EMMENTAL');
      render(<App />);
      expect(expandedState()).toMatchObject({ emmental: true });
    });

    it('frames the home bounds for ?vb=berner-jura, which has no venues', () => {
      openAt('?vb=berner-jura');
      render(<App />);
      expect(expandedState()).toMatchObject({ bksv: true, 'berner-jura': true });
      expect(focusBounds()).toEqual(ASSOCIATION_HOME_BOUNDS['berner-jura']);
    });

    it('frames all venues of a Teilverband for ?vb=bksv', () => {
      openAt('?vb=bksv');
      render(<App />);
      expect(expandedState()).toMatchObject({ bksv: true });
      expect(focusBounds()).toEqual([[46.6, 7.6], [47.05, 7.9]]);
    });

    it('ignores an unknown ?vb= id', () => {
      openAt('?vb=nowhere');
      render(<App />);
      expect(expandedState()).not.toHaveProperty('nowhere');
      expect(focusBounds()).toBeNull();
    });

    it('lands ?ctn=BE on BKSV', () => {
      openAt('?ctn=BE');
      render(<App />);
      expect(expandedState()).toMatchObject({ bksv: true });
      expect(expandedState()).not.toHaveProperty('BE');
      expect(focusBounds()).toEqual([[46.6, 7.6], [47.05, 7.9]]);
    });

    it('lands ?ctn=AI on Appenzell', () => {
      openAt('?ctn=ai');
      render(<App />);
      expect(expandedState()).toMatchObject({ nosv: true, appenzell: true });
      expect(focusBounds()).toEqual([[47.33, 9.41], [47.33, 9.41]]);
    });

    it("lands ?ctn=ZH on Zürich and frames its venues, including one outside the canton", () => {
      openAt('?ctn=ZH');
      render(<App />);
      expect(expandedState()).toMatchObject({ nosv: true, zuerich: true });
      expect(focusBounds()).toEqual([[47.4, 8.5], [47.45, 8.6]]);
    });

    it('prefers ?vb= over ?ctn=', () => {
      openAt('?ctn=ZH&vb=emmental');
      render(<App />);
      expect(expandedState()).toMatchObject({ emmental: true });
      expect(expandedState()).not.toHaveProperty('zuerich');
    });

    it('lets ?venue= beat ?vb=', () => {
      openAt('?venue=e1&vb=zuerich');
      render(<App />);
      expect(expandedState()).not.toHaveProperty('zuerich');
      expect(focusBounds()).toBeNull();
    });
  });

  describe('with the verband flag off', () => {
    beforeEach(() => { vi.stubEnv('VITE_APP_ENV', 'production'); });

    it.each(['BE', 'AI', 'ZH'])('opens canton %s for ?ctn= and frames its bounds, as before', (code) => {
      openAt('?ctn=' + code.toLowerCase());
      render(<App />);
      expect(expandedState()).toEqual({ [code]: true });
      expect(focusBounds()).toEqual(boundsForCanton(code));
    });

    it('ignores ?vb=', () => {
      openAt('?vb=emmental');
      render(<App />);
      expect(expandedState()).toEqual({});
      expect(focusBounds()).toBeNull();
    });

    it('lets ?venue= beat ?ctn=', () => {
      openAt('?venue=e1&ctn=BE');
      render(<App />);
      expect(expandedState()).toEqual({});
      expect(focusBounds()).toBeNull();
    });
  });
});

describe('App — poster editor wiring', () => {
  beforeEach(() => { localStorage.clear(); mocked.loaded = true; });

  it('opens the poster editor for the canton the sidebar requests', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByTestId('poster-editor')).not.toBeInTheDocument();

    await user.click(screen.getByText('gen-poster'));

    expect(await screen.findByTestId('poster-editor')).toBeInTheDocument();
    expect(screen.getByText('editor:BE')).toBeInTheDocument();
  });

  it('opens a poster asked for before the venues loaded once they have, with the venues in it', async () => {
    // The editor frames the map and places its pins when it opens, so it must not open on an empty
    // list that fills in a moment later.
    const user = userEvent.setup();
    mocked.loaded = false;
    const { rerender } = render(<App />);
    await user.click(screen.getByText('gen-poster'));
    expect(screen.queryByTestId('poster-editor')).not.toBeInTheDocument();

    mocked.loaded = true;
    mocked.venues = [venue];
    rerender(<App />);

    expect(await screen.findByTestId('poster-editor-venues')).toHaveTextContent('1');
    mocked.venues = null;
  });

  it('opens the poster editor for the Verband the sidebar requests', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('gen-poster-vb'));

    expect(await screen.findByText('editor:freiburg')).toBeInTheDocument();
  });

  it('flashes the poster error and opens no editor for an unknown Verband', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('gen-poster-bad'));

    expect(await screen.findByText(STR.de.posterGenerateFailed)).toBeInTheDocument();
    expect(screen.queryByTestId('poster-editor')).not.toBeInTheDocument();
  });

  it('downloads the blob and closes the editor on save', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('gen-poster'));
    await user.click(await screen.findByText('ed-save'));

    expect(clickSpy).toHaveBeenCalled(); // downloadBlob triggered the anchor
    await waitFor(() => expect(screen.queryByTestId('poster-editor')).not.toBeInTheDocument());
    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('shows an error flash and keeps the editor open when capture fails', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('gen-poster'));
    await user.click(await screen.findByText('ed-error'));

    expect(await screen.findByText(STR.de.posterGenerateFailed)).toBeInTheDocument();
    expect(screen.getByTestId('poster-editor')).toBeInTheDocument();
  });

  it('closes the editor via onClose', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('gen-poster'));
    await user.click(await screen.findByText('ed-close'));

    await waitFor(() => expect(screen.queryByTestId('poster-editor')).not.toBeInTheDocument());
  });
});
