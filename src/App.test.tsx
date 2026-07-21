import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { STR } from './i18n/translations';
import type { Venue } from './features/venues/types';

// App is the composition root. We stub the heavy children/hooks and drive the poster-editor wiring
// (Sidebar's onGeneratePoster → open editor → onSave downloads + closes → onError flashes).
const venue: Venue = {
  id: '1', name: 'Emmental', canton: 'BE', address: '', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [],
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
vi.mock('./features/venues/useVenues', () => ({
  useVenues: () => ({ data: [venue], isSuccess: true }),
  useVenueMutations: () => ({}),
}));
vi.mock('./features/geo/useGeolocation', () => ({
  useGeolocation: () => ({ status: 'idle', position: null, request: vi.fn(), supported: false }),
}));
vi.mock('./features/venues/useVenuePermalink', () => ({ useVenuePermalink: () => {} }));
vi.mock('./lib/sentry', () => ({ captureAndFormat: (_e: unknown, fallback: string) => fallback }));
vi.mock('./components/Topbar', () => ({ Topbar: () => <div data-testid="topbar" /> }));
vi.mock('./features/map/MapView', () => ({ MapView: () => <div data-testid="mapview" /> }));
vi.mock('./features/sidebar/Sidebar', () => ({
  Sidebar: ({ onGeneratePoster }: { onGeneratePoster: (code: string) => void }) => (
    <button onClick={() => onGeneratePoster('BE')}>gen-poster</button>
  ),
}));
vi.mock('./features/venues/PosterEditorModal', () => ({
  PosterEditorModal: ({ code, onSave, onError, onClose }: {
    code: string; onSave: (b: Blob, f: string) => void; onError: (e: unknown) => void; onClose: () => void;
  }) => (
    <div data-testid="poster-editor">
      <span>editor:{code}</span>
      <button onClick={() => onSave(new Blob(['x'], { type: 'image/png' }), 'schwingkeller-be.png')}>ed-save</button>
      <button onClick={() => onError(new Error('boom'))}>ed-error</button>
      <button onClick={onClose}>ed-close</button>
    </div>
  ),
}));

import App from './App';

describe('App — poster editor wiring', () => {
  beforeEach(() => { localStorage.clear(); });

  it('opens the poster editor for the canton the sidebar requests', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByTestId('poster-editor')).not.toBeInTheDocument();

    await user.click(screen.getByText('gen-poster'));

    expect(await screen.findByTestId('poster-editor')).toBeInTheDocument();
    expect(screen.getByText('editor:BE')).toBeInTheDocument();
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
