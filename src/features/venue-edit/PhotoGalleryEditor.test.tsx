import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { PhotoGalleryEditor } from './PhotoGalleryEditor';
import type { VenuePhoto } from '../venues/types';

vi.mock('../venues/api', () => ({
  uploadPhoto: vi.fn(),
  PhotoTooLargeError: class PhotoTooLargeError extends Error {},
}));
vi.mock('../../lib/sentry', () => ({ captureAndFormat: vi.fn((_e: unknown, fallback: string) => fallback) }));

import { uploadPhoto, PhotoTooLargeError } from '../venues/api';

const renderEditor = (photos: VenuePhoto[], onChange = vi.fn(), onError = vi.fn()) => {
  render(
    <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
      <PhotoGalleryEditor photos={photos} onChange={onChange} onError={onError} />
    </I18nContext.Provider>,
  );
  return { onChange, onError };
};

const fileInput = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => { vi.clearAllMocks(); });

describe('PhotoGalleryEditor', () => {
  it('uploads a selected file and appends it to the draft', async () => {
    vi.mocked(uploadPhoto).mockResolvedValue('https://cdn.example.com/new.jpg');
    const onChange = vi.fn();
    const { container } = render(
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <PhotoGalleryEditor photos={[]} onChange={onChange} onError={vi.fn()} />
      </I18nContext.Provider>,
    );
    const input = fileInput(container);
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const result = onChange.mock.calls[0][0] as VenuePhoto[];
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://cdn.example.com/new.jpg');
  });

  it('removes a photo when its delete button is clicked', () => {
    const photos: VenuePhoto[] = [{ id: 'p1', url: 'https://example.com/1.jpg', position: 0 }];
    const { onChange } = renderEditor(photos);
    fireEvent.click(screen.getByRole('button', { name: STR.de.delete }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('ignores files beyond the remaining slots and reports the cap', async () => {
    const photos: VenuePhoto[] = Array.from({ length: 5 }, (_, i) => (
      { id: `p${i}`, url: `https://example.com/${i}.jpg`, position: i }
    ));
    vi.mocked(uploadPhoto).mockResolvedValue('https://cdn.example.com/new.jpg');
    const onError = vi.fn();
    const { container } = render(
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <PhotoGalleryEditor photos={photos} onChange={vi.fn()} onError={onError} />
      </I18nContext.Provider>,
    );
    const input = fileInput(container);
    const files = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')];
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    fireEvent.change(input);

    await waitFor(() => expect(uploadPhoto).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith(STR.de.galleryCapReached.replace('{n}', '1'));
  });

  it('shows the resize hint and hides the add tile at 6/6', () => {
    const photos: VenuePhoto[] = Array.from({ length: 6 }, (_, i) => (
      { id: `p${i}`, url: `https://example.com/${i}.jpg`, position: i }
    ));
    const { container } = render(
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <PhotoGalleryEditor photos={photos} onChange={vi.fn()} onError={vi.fn()} />
      </I18nContext.Provider>,
    );
    expect(screen.getByText(STR.de.photoResizeHint)).toBeInTheDocument();
    expect(screen.getByText(STR.de.galleryFull)).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });

  it('reports photoTooLarge without going through the generic upload error', async () => {
    vi.mocked(uploadPhoto).mockRejectedValue(new PhotoTooLargeError());
    const onError = vi.fn();
    const { container } = render(
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <PhotoGalleryEditor photos={[]} onChange={vi.fn()} onError={onError} />
      </I18nContext.Provider>,
    );
    const input = fileInput(container);
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => expect(onError).toHaveBeenCalledWith(STR.de.photoTooLarge));
  });
});
