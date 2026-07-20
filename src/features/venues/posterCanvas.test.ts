import { describe, it, expect, vi, afterEach } from 'vitest';
import { POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage } from './posterCanvas';

describe('posterFilename', () => {
  it('lowercases the canton code into the filename', () => {
    expect(posterFilename('BE')).toBe('schwingkeller-be.png');
  });
});

describe('createOffscreenContainer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('appends a fixed, off-viewport container sized to POSTER_SIZE by default', () => {
    const el = createOffscreenContainer();
    expect(document.body.contains(el)).toBe(true);
    expect(el.style.position).toBe('fixed');
    expect(el.style.left).toBe('-9999px');
    expect(el.style.width).toBe(`${POSTER_SIZE}px`);
    expect(el.style.height).toBe(`${POSTER_SIZE}px`);
  });

  it('honors a custom size', () => {
    const el = createOffscreenContainer(500);
    expect(el.style.width).toBe('500px');
    expect(el.style.height).toBe('500px');
  });
});

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  src = '';
}

describe('loadImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves the image element once it loads', async () => {
    let created: FakeImage | undefined;
    vi.stubGlobal(
      'Image',
      vi.fn(function () {
        created = new FakeImage();
        return created;
      }),
    );

    const promise = loadImage('https://example.com/wappen.svg', 'anonymous');
    created!.onload?.();
    const result = await promise;

    expect(result).toBe(created);
    expect(created!.crossOrigin).toBe('anonymous');
    expect(created!.src).toBe('https://example.com/wappen.svg');
  });

  it('resolves null when the image fails to load, instead of throwing', async () => {
    let created: FakeImage | undefined;
    vi.stubGlobal(
      'Image',
      vi.fn(function () {
        created = new FakeImage();
        return created;
      }),
    );

    const promise = loadImage('https://example.com/missing.svg');
    created!.onerror?.();

    await expect(promise).resolves.toBeNull();
  });
});
