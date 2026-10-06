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
  reverseGeocode: vi.fn().mockResolvedValue(null),
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

describe('EditForm association', () => {
  const base: Venue = {
    id: 'v9', name: 'Halle', canton: 'ZH', address: '', lat: 47.37, lng: 8.54, indoor: true, outdoor: false,
    person: '', phone: '', website: '', photos: [], association_id: null,
  };

  const renderWith = (initial: Venue | null) =>
    render(
      <QueryClientProvider client={makeClient()}>
        <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
          <EditForm initial={initial} onClose={vi.fn()} onSaved={vi.fn()} onStartPlacing={vi.fn()} pickedCoords={null} />
        </I18nContext.Provider>
      </QueryClientProvider>,
    );

  // The insert or update payload the form sent to Supabase. With fake timers the mutation only runs
  // once the clock moves, and waitFor can't move Vitest's clock, so this advances it directly.
  type Chain = { insert: Mock; update: Mock };
  const savedPayload = async () => {
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    const chain = vi.mocked(supabase.from).mock.results[0]?.value as Chain | undefined;
    expect((chain?.insert.mock.calls.length ?? 0) + (chain?.update.mock.calls.length ?? 0)).toBe(1);
    return (chain!.insert.mock.calls[0] ?? chain!.update.mock.calls[0])[0] as Record<string, unknown>;
  };
  const save = () => fireEvent.click(screen.getByText(STR.de.saveClose));
  const association = () => screen.getByLabelText(STR.de.association) as HTMLSelectElement;
  const canton = () => screen.getByLabelText(STR.de.canton) as HTMLSelectElement;
  const typeAddress = async (value: string) => {
    fireEvent.change(screen.getByLabelText(STR.de.address), { target: { value } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  };
  const geocodeOnce = (canton: string, bernDistrict: string | null) =>
    vi.mocked(forwardGeocode).mockResolvedValueOnce({ lat: 47, lng: 7.5, canton, bernDistrict });

  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it('suggests Emmental for a Langnau address', async () => {
    renderWith(null);
    geocodeOnce('BE', 'Emmental');
    fireEvent.change(screen.getByLabelText(STR.de.address), { target: { value: 'Schlossstrasse 3, 3550 Langnau i. E.' } });
    expect(canton().value).toBe('BE');
    expect(association().value).toBe('');
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(association().value).toBe('emmental');
    expect(screen.getByText(STR.de.associationAuto)).toBeInTheDocument();
  });

  it('keeps a manual pick through a later address change', async () => {
    renderWith(null);
    fireEvent.change(association(), { target: { value: 'oberland' } });
    expect(screen.queryByText(STR.de.associationAuto)).toBeNull();
    geocodeOnce('ZH', null);
    await typeAddress('Bahnhofstrasse 1, 8001 Zürich');
    expect(canton().value).toBe('ZH');
    expect(association().value).toBe('oberland');
  });

  it('saves null for "Ohne Verband"', async () => {
    renderWith({ ...base, association_id: 'zuerich' });
    fireEvent.change(association(), { target: { value: '' } });
    save();
    expect((await savedPayload()).association_id).toBeNull();
  });

  it('keeps a deliberate association when the canton changes', async () => {
    renderWith({ ...base, canton: 'LU', association_id: 'emmental' });
    fireEvent.change(canton(), { target: { value: 'ZH' } });
    save();
    expect((await savedPayload()).association_id).toBe('emmental');
  });

  it('follows the canton for an automatic association', async () => {
    renderWith({ ...base, canton: 'ZH', association_id: 'zuerich' });
    fireEvent.change(canton(), { target: { value: 'SG' } });
    save();
    expect((await savedPayload()).association_id).toBe('st-gallen');
  });

  it('keeps a Bernese Gau', async () => {
    renderWith({ ...base, canton: 'BE', association_id: 'oberland' });
    geocodeOnce('BE', 'Emmental');
    await typeAddress('Schlossstrasse 3, 3550 Langnau i. E.');
    save();
    expect((await savedPayload()).association_id).toBe('oberland');
  });

  it('assigns a venue that had none', async () => {
    renderWith({ ...base, canton: 'BE', association_id: null });
    geocodeOnce('BE', 'Emmental');
    await typeAddress('Schlossstrasse 3, 3550 Langnau i. E.');
    save();
    expect((await savedPayload()).association_id).toBe('emmental');
  });

  it('sends the stored association on an unrelated edit', async () => {
    renderWith({ ...base, canton: 'LU', association_id: 'emmental' });
    fireEvent.change(screen.getByLabelText(STR.de.name), { target: { value: 'Neuer Name' } });
    save();
    expect((await savedPayload()).association_id).toBe('emmental');
  });

  it('drops to no association when an automatic venue moves to Bern', async () => {
    renderWith({ ...base, canton: 'ZH', association_id: 'zuerich' });
    fireEvent.change(canton(), { target: { value: 'BE' } });
    save();
    expect((await savedPayload()).association_id).toBeNull();
  });

  it('flag off: no association field, but the suggestion is saved', async () => {
    vi.stubEnv('VITE_APP_ENV', 'production');
    renderWith(null);
    expect(document.getElementById('venue-association')).toBeNull();
    fireEvent.change(screen.getByLabelText(STR.de.name), { target: { value: 'Neue Halle' } });
    fireEvent.change(canton(), { target: { value: 'ZH' } });
    expect(screen.queryByText(STR.de.associationAuto)).toBeNull();
    save();
    expect((await savedPayload()).association_id).toBe('zuerich');
  });
});
