import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
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
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
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

import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { EditForm } from './EditForm';
import { captureAndFormat } from '../../lib/sentry';

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

beforeEach(() => {
  vi.clearAllMocks();
  uploadMock.mockResolvedValue({ error: null });
});

const renderForm = (onError = vi.fn()) =>
  render(
    <QueryClientProvider client={makeClient()}>
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
  );

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
});
