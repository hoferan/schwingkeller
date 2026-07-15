import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
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
