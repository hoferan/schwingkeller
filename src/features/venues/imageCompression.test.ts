import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImageIfNeeded } from './imageCompression';

const makeFile = (size: number, name = 'photo.jpg', type = 'image/jpeg') =>
  new File([new Uint8Array(size)], name, { type });

describe('compressImageIfNeeded', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).createImageBitmap;
  });

  it('returns the original file unchanged when already under the threshold', async () => {
    const file = makeFile(1024);
    const result = await compressImageIfNeeded(file);
    expect(result).toBe(file);
  });

  it('downscales and re-encodes a file over the threshold', async () => {
    const file = makeFile(6 * 1024 * 1024);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(function (this: HTMLCanvasElement, cb: BlobCallback) {
        cb(new Blob(['x'], { type: 'image/jpeg' }));
      });

    const result = await compressImageIfNeeded(file);

    expect(drawImage).toHaveBeenCalled();
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('photo.jpg');
    expect(result.size).toBeLessThan(file.size);
  });
});
