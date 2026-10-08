import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useSidebarWidth,
  clampSidebarWidth,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from './useSidebarWidth';

const KEY = 'sk-sidebar-width';

const setViewport = (w: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  window.dispatchEvent(new Event('resize'));
};

describe('clampSidebarWidth', () => {
  it('keeps a width inside the range as it is', () => {
    expect(clampSidebarWidth(400, 1440)).toBe(400);
  });

  it('raises a width below the minimum to the minimum', () => {
    expect(clampSidebarWidth(100, 1440)).toBe(SIDEBAR_MIN_WIDTH);
  });

  it('caps a width at 40% of the viewport', () => {
    expect(clampSidebarWidth(900, 1440)).toBe(576);
  });

  it('never caps below the minimum on a narrow viewport', () => {
    expect(clampSidebarWidth(500, 600)).toBe(SIDEBAR_MIN_WIDTH);
  });
});

describe('useSidebarWidth', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    setViewport(1024);
  });

  it('starts at the default width when nothing is stored', () => {
    setViewport(1440);
    const { result } = renderHook(() => useSidebarWidth());
    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it('starts at a stored width', () => {
    setViewport(1440);
    localStorage.setItem(KEY, '420');
    const { result } = renderHook(() => useSidebarWidth());
    expect(result.current.width).toBe(420);
  });

  it('ignores a stored value that is not a number', () => {
    setViewport(1440);
    localStorage.setItem(KEY, 'wide');
    const { result } = renderHook(() => useSidebarWidth());
    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it('falls back to the default when storage throws', () => {
    setViewport(1440);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useSidebarWidth());
    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it('limits a stored width to the current viewport', () => {
    setViewport(1024);
    localStorage.setItem(KEY, '600');
    const { result } = renderHook(() => useSidebarWidth());
    expect(result.current.width).toBe(410);
    expect(result.current.max).toBe(410);
  });

  it('shows a previewed width without storing it', () => {
    setViewport(1440);
    const { result } = renderHook(() => useSidebarWidth());
    act(() => result.current.preview(450));
    expect(result.current.width).toBe(450);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('stores a committed width, limited to the range', () => {
    setViewport(1440);
    const { result } = renderHook(() => useSidebarWidth());
    act(() => result.current.commit(900));
    expect(result.current.width).toBe(576);
    expect(localStorage.getItem(KEY)).toBe('576');
  });

  it('keeps working when storing throws', () => {
    setViewport(1440);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => useSidebarWidth());
    act(() => result.current.commit(400));
    expect(result.current.width).toBe(400);
  });

  it('resets to the default width and stores it', () => {
    setViewport(1440);
    localStorage.setItem(KEY, '500');
    const { result } = renderHook(() => useSidebarWidth());
    act(() => result.current.reset());
    expect(result.current.width).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(localStorage.getItem(KEY)).toBe(String(SIDEBAR_DEFAULT_WIDTH));
  });

  it('narrows when the window shrinks, and widens back when it grows', () => {
    setViewport(1440);
    localStorage.setItem(KEY, '560');
    const { result } = renderHook(() => useSidebarWidth());
    expect(result.current.width).toBe(560);
    act(() => setViewport(1024));
    expect(result.current.width).toBe(410);
    act(() => setViewport(1440));
    expect(result.current.width).toBe(560);
  });
});
