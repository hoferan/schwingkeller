import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { PosterPreviewModal } from './PosterPreviewModal';

const renderModal = (props: Partial<Parameters<typeof PosterPreviewModal>[0]> = {}) => {
  const blob = new Blob(['x'], { type: 'image/png' });
  const onClose = vi.fn();
  const onSave = vi.fn();
  render(
    <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
      <PosterPreviewModal blob={blob} cantonName="Bern" onClose={onClose} onSave={onSave} {...props} />
    </I18nContext.Provider>,
  );
  return { blob, onClose, onSave };
};

describe('PosterPreviewModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the generated image and the title', () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    renderModal();

    const img = screen.getByRole('img', { name: 'Bern' });
    expect(img).toHaveAttribute('src', 'blob:mock-url');
    expect(screen.getByText(STR.de.posterPreviewTitle)).toBeInTheDocument();
  });

  it('calls onSave with the blob when Save is clicked', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const user = userEvent.setup();
    const { onSave, blob } = renderModal();

    await user.click(screen.getByText(STR.de.saveImage));

    expect(onSave).toHaveBeenCalledWith(blob);
  });

  it('calls onClose when Close is clicked', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByText(STR.de.close));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('revokes the object URL on unmount', () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    const { unmount } = render(
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <PosterPreviewModal blob={new Blob(['x'])} cantonName="Bern" onClose={vi.fn()} onSave={vi.fn()} />
      </I18nContext.Provider>,
    );

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
