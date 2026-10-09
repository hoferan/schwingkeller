import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { uploadMock } = vi.hoisted(() => ({
  uploadMock: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'v1', name: 'Testkeller' }, error: null }),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: uploadMock,
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
      }),
    },
  },
}));

vi.mock('../../lib/sentry', () => ({
  captureAndFormat: vi.fn((_err: unknown, fallback: string) => fallback),
}));

vi.mock('../venues/geocoding', () => ({
  forwardGeocode: vi.fn().mockResolvedValue(null),
}));

vi.mock('../venues/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../venues/api')>();
  return { ...actual, syncVenuePhotos: vi.fn().mockResolvedValue(undefined) };
});

import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { EditForm } from './EditForm';
import { captureAndFormat } from '../../lib/sentry';
import { syncVenuePhotos } from '../venues/api';
import { forwardGeocode } from '../venues/geocoding';
import { supabase } from '../../lib/supabase';
import type { Venue } from '../venues/types';

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

beforeEach(() => {
  vi.clearAllMocks();
  uploadMock.mockResolvedValue({ error: null });
});

const renderForm = (onError = vi.fn(), client = makeClient()) => ({
  client,
  ...render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <EditForm
          initial={null}
          onClose={vi.fn()}
          onSaved={vi.fn()}
          onStartPlacing={vi.fn()}
          pickedCoords={null}
          onError={onError}
        />
      </I18nContext.Provider>
    </QueryClientProvider>,
  ),
});

describe('EditForm onError prop', () => {
  it('accepts an onError callback without invoking it on a clean render', () => {
    const onError = vi.fn();
    renderForm(onError);
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onError with uploadError message when photo upload fails', async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: 'Storage error', code: '500' } });
    const onError = vi.fn();
    const { container } = renderForm(onError);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);

    await waitFor(() => expect(onError).toHaveBeenCalledWith(STR.de.uploadError));
    expect(captureAndFormat).toHaveBeenCalled();
  });

  it('calls syncVenuePhotos with the venue id and the current photo draft after save', async () => {
    renderForm();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Testkeller' } });
    fireEvent.change(screen.getByLabelText(STR.de.association), { target: { value: 'zuerich' } });
    fireEvent.click(screen.getByText(STR.de.saveClose));

    await waitFor(() => expect(syncVenuePhotos).toHaveBeenCalledWith('v1', [], []));
  });

  it('invalidates the venues query again after syncVenuePhotos resolves, not just after the venue save', async () => {
    // Hold syncVenuePhotos open so we can observe the invalidateQueries call count
    // before and after it resolves — this is what would have caught the staleness bug.
    let resolveSync: () => void = () => {};
    const syncPromise = new Promise<void>((resolve) => { resolveSync = resolve; });
    vi.mocked(syncVenuePhotos).mockImplementationOnce(() => syncPromise);

    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    renderForm(vi.fn(), client);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Testkeller' } });
    fireEvent.change(screen.getByLabelText(STR.de.association), { target: { value: 'zuerich' } });
    fireEvent.click(screen.getByText(STR.de.saveClose));

    // The venue-row create/update mutation has resolved and syncVenuePhotos has been
    // invoked (but not yet resolved) — at this point only the create mutation's own
    // onSuccess should have invalidated the ['venues'] query.
    await waitFor(() => expect(syncVenuePhotos).toHaveBeenCalledWith('v1', [], []));
    const callsBeforeSyncResolved = invalidateSpy.mock.calls.length;
    expect(callsBeforeSyncResolved).toBeGreaterThanOrEqual(1);

    resolveSync();

    // Once syncVenuePhotos resolves, the syncPhotos mutation's own onSuccess must fire
    // a further invalidation of ['venues'] — proving the gallery/marker data is
    // refetched with the post-sync photo state, not just the pre-sync venue row.
    await waitFor(() => expect(invalidateSpy.mock.calls.length).toBeGreaterThan(callsBeforeSyncResolved));
    expect(invalidateSpy).toHaveBeenLastCalledWith({ queryKey: ['venues'] });
  });
});

describe('EditForm field labels', () => {
  // Same defect the login dialog had: a visible label with no association gives its field no
  // accessible name, so a screen reader reaches an unnamed box and has to guess from position.
  it('ties the name, address and canton labels to their fields', () => {
    renderForm();

    expect(screen.getByLabelText(STR.de.name).tagName).toBe('INPUT');
    expect(screen.getByLabelText(STR.de.address).tagName).toBe('INPUT');
    expect(screen.getByLabelText(STR.de.canton).tagName).toBe('SELECT');
  });
});

describe('EditForm layout', () => {
  // The fields scroll; the title and the save buttons stay put, and the scrollbar runs only beside
  // the fields.
  it('keeps the title and the save buttons out of the scrolling area', () => {
    renderForm();
    const scroller = screen.getByLabelText(STR.de.name).closest('.sk-scroll');
    expect(scroller).not.toBeNull();
    expect(scroller).not.toContainElement(screen.getByRole('button', { name: STR.de.saveClose }));
    expect(scroller).not.toContainElement(screen.getByRole('button', { name: STR.de.close }));
  });
});

describe('EditForm association and address', () => {
  const base: Venue = {
    id: 'v9', name: 'Halle', canton: 'FR', address: '', lat: 46.8, lng: 7.16, indoor: true, outdoor: false,
    person: '', phone: '', website: '', photos: [], association_id: 'freiburg',
  };

  const form = (initial: Venue | null, pickedCoords: { lat: number; lng: number } | null = null, key = 1) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <EditForm key={key} initial={initial} onClose={vi.fn()} onSaved={vi.fn()} onStartPlacing={vi.fn()} pickedCoords={pickedCoords} />
      </I18nContext.Provider>
    </QueryClientProvider>
  );
  let client = makeClient();
  const renderWith = (initial: Venue | null, pickedCoords: { lat: number; lng: number } | null = null) => {
    client = makeClient();
    return render(form(initial, pickedCoords));
  };

  // The insert or update payload the form sent to Supabase. With fake timers the mutation only runs
  // once the clock moves, and waitFor can't move Vitest's clock, so this advances it directly.
  type Chain = { insert: Mock; update: Mock };
  const chain = () => vi.mocked(supabase.from).mock.results[0]?.value as Chain | undefined;
  const writes = () => (chain()?.insert.mock.calls.length ?? 0) + (chain()?.update.mock.calls.length ?? 0);
  const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(100); });
  const savedPayload = async () => {
    await flush();
    expect(writes()).toBe(1);
    return (chain()!.insert.mock.calls[0] ?? chain()!.update.mock.calls[0])[0] as Record<string, unknown>;
  };
  const save = () => fireEvent.click(screen.getByText(STR.de.saveClose));
  const association = () => screen.getByLabelText(STR.de.association) as HTMLSelectElement;
  const canton = () => screen.getByLabelText(STR.de.canton) as HTMLSelectElement;
  const address = () => screen.getByLabelText(STR.de.address) as HTMLInputElement;
  const search = () => screen.getByRole('button', { name: STR.de.addressSearch });

  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it('leaves canton and pin alone while typing', async () => {
    renderWith(base);
    fireEvent.change(address(), { target: { value: 'Bahnhofstrasse 31, 3186 Düdingen' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(canton().value).toBe('FR');
    expect(forwardGeocode).not.toHaveBeenCalled();
    save();
    expect(await savedPayload()).toMatchObject({ canton: 'FR', lat: 46.8, lng: 7.16 });
  });

  it('searches the address on click', async () => {
    renderWith({ ...base, canton: 'BE' });
    vi.mocked(forwardGeocode).mockResolvedValueOnce({ lat: 46.85, lng: 7.19, canton: 'FR' });
    fireEvent.change(address(), { target: { value: 'Bahnhofstrasse 31, 3186 Düdingen' } });
    fireEvent.click(search());
    await flush();
    expect(canton().value).toBe('FR');
    expect(screen.getByText(STR.de.cantonAuto)).toBeInTheDocument();
    save();
    expect(await savedPayload()).toMatchObject({ canton: 'FR', lat: 46.85, lng: 7.19 });
  });

  it('keeps the canton when the result has none', async () => {
    renderWith(base);
    vi.mocked(forwardGeocode).mockResolvedValueOnce({ lat: 47, lng: 7.5, canton: null });
    fireEvent.change(address(), { target: { value: 'Somewhere far away 1' } });
    fireEvent.click(search());
    await flush();
    expect(canton().value).toBe('FR');
    expect(screen.queryByText(STR.de.cantonAuto)).toBeNull();
    save();
    expect(await savedPayload()).toMatchObject({ canton: 'FR', lat: 47 });
  });

  it("says when the address isn't found", async () => {
    renderWith(base);
    vi.mocked(forwardGeocode).mockResolvedValueOnce(null);
    fireEvent.change(address(), { target: { value: 'Nirgendwo 99' } });
    fireEvent.click(search());
    await flush();
    expect(screen.getByText(STR.de.addressNotFound)).toBeInTheDocument();
    fireEvent.change(address(), { target: { value: 'Nirgendwo 98' } });
    expect(screen.queryByText(STR.de.addressNotFound)).toBeNull();
  });

  it('ignores a result for an address that has since changed', async () => {
    renderWith(base);
    let resolve: (r: { lat: number; lng: number; canton: string | null }) => void = () => {};
    vi.mocked(forwardGeocode).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    fireEvent.change(address(), { target: { value: 'Murtengasse 18, 1700 Fribourg' } });
    fireEvent.click(search());
    fireEvent.change(address(), { target: { value: 'Murtengasse 20, 1700 Fribourg' } });
    await act(async () => { resolve({ lat: 46.9, lng: 7.2, canton: 'BE' }); });
    expect(canton().value).toBe('FR');
    save();
    expect(await savedPayload()).toMatchObject({ lat: 46.8, lng: 7.16 });
  });

  it('disables the search for a short address', () => {
    renderWith(base);
    fireEvent.change(address(), { target: { value: 'Bern' } });
    expect(search()).toBeDisabled();
  });

  it('moves only the pin on a map pick', async () => {
    const { rerender } = renderWith({ ...base, address: 'Murtengasse 18, 1700 Fribourg' });
    rerender(form({ ...base, address: 'Murtengasse 18, 1700 Fribourg' }, { lat: 46.9, lng: 7.4 }));
    expect(address().value).toBe('Murtengasse 18, 1700 Fribourg');
    expect(canton().value).toBe('FR');
    save();
    expect(await savedPayload()).toMatchObject({ lat: 46.9, lng: 7.4, address: 'Murtengasse 18, 1700 Fribourg' });
  });

  it('requires an association', async () => {
    renderWith(null);
    fireEvent.change(screen.getByLabelText(STR.de.name), { target: { value: 'Neue Halle' } });
    save();
    await flush();
    expect(screen.getByText(STR.de.associationRequired)).toBeInTheDocument();
    expect(writes()).toBe(0);
    fireEvent.change(association(), { target: { value: 'emmental' } });
    expect(screen.queryByText(STR.de.associationRequired)).toBeNull();
    save();
    expect((await savedPayload()).association_id).toBe('emmental');
  });

  it.each([
    ['on', undefined],
    ['off', 'production'],
  ])('saves the chosen association with the flag %s', async (_label, env) => {
    if (env) vi.stubEnv('VITE_APP_ENV', env);
    renderWith(null);
    expect(document.getElementById('venue-association')).not.toBeNull();
    fireEvent.change(screen.getByLabelText(STR.de.name), { target: { value: 'Neue Halle' } });
    fireEvent.change(canton(), { target: { value: 'ZH' } });
    fireEvent.change(association(), { target: { value: 'zuerich' } });
    save();
    expect((await savedPayload()).association_id).toBe('zuerich');
  });

  it('keeps an existing association through a canton change and an address search', async () => {
    renderWith({ ...base, canton: 'LU', association_id: 'emmental' });
    fireEvent.change(canton(), { target: { value: 'ZH' } });
    vi.mocked(forwardGeocode).mockResolvedValueOnce({ lat: 47.37, lng: 8.54, canton: 'ZH' });
    fireEvent.change(address(), { target: { value: 'Bahnhofstrasse 1, 8001 Zürich' } });
    fireEvent.click(search());
    await flush();
    save();
    expect((await savedPayload()).association_id).toBe('emmental');
  });

  it('promises no automatic sync between address and pin', () => {
    renderWith(base);
    expect(screen.queryByText(/automatisch synchronisiert/)).toBeNull();
  });

  it('clears "not found" when a later search succeeds', async () => {
    renderWith(base);
    fireEvent.change(address(), { target: { value: 'Murtengasse 18, 1700 Fribourg' } });
    vi.mocked(forwardGeocode).mockResolvedValueOnce(null);
    fireEvent.click(search());
    await flush();
    expect(screen.getByText(STR.de.addressNotFound)).toBeInTheDocument();
    vi.mocked(forwardGeocode).mockResolvedValueOnce({ lat: 46.81, lng: 7.16, canton: 'FR' });
    fireEvent.click(search());
    await flush();
    expect(screen.queryByText(STR.de.addressNotFound)).toBeNull();
  });

  it('moves focus to the association when a save is blocked, and names the reason', async () => {
    renderWith(null);
    fireEvent.change(screen.getByLabelText(STR.de.name), { target: { value: 'Neue Halle' } });
    save();
    await flush();
    expect(document.activeElement).toBe(association());
    const message = screen.getByText(STR.de.associationRequired);
    expect(association()).toHaveAttribute('aria-describedby', message.id);
  });

  it('gives the association field its normal border back once the error clears', async () => {
    renderWith(null);
    fireEvent.change(screen.getByLabelText(STR.de.name), { target: { value: 'Neue Halle' } });
    save();
    await flush();
    fireEvent.change(association(), { target: { value: 'freiburg' } });
    expect(association().style.border).toBe(canton().style.border);
  });

  it('starts the next venue without an association after "Speichern & neu"', () => {
    const { rerender } = renderWith(null);
    fireEvent.change(association(), { target: { value: 'zuerich' } });
    // App remounts the form with a new key for the next venue.
    rerender(form(null, null, 2));
    expect(association().value).toBe('');
  });
});
