import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
      }),
    },
  },
}));

vi.mock('../venues/geocoding', () => ({
  forwardGeocode: vi.fn().mockResolvedValue(null),
  reverseGeocode: vi.fn().mockResolvedValue(null),
}));

import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { EditForm } from './EditForm';

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

describe('EditForm onError prop', () => {
  it('accepts an onError callback without invoking it on a clean render', () => {
    const onError = vi.fn();
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
    expect(onError).not.toHaveBeenCalled();
  });
});
