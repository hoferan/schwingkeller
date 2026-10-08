import { useEffect, useState } from 'react';

export const SIDEBAR_DEFAULT_WIDTH = 344;
// Below this the sort pill and the canton rows (name, count, poster button, chevron) start to crowd.
export const SIDEBAR_MIN_WIDTH = 280;
const MAX_VIEWPORT_SHARE = 0.4;
const KEY = 'sk-sidebar-width';

const maxFor = (viewportWidth: number) =>
  Math.max(SIDEBAR_MIN_WIDTH, Math.round(viewportWidth * MAX_VIEWPORT_SHARE));

export const clampSidebarWidth = (width: number, viewportWidth: number) =>
  Math.min(maxFor(viewportWidth), Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));

const loadWidth = (): number => {
  try {
    const stored = Number(localStorage.getItem(KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
};

const saveWidth = (width: number) => {
  try { localStorage.setItem(KEY, String(width)); } catch { /* ignore */ }
};

// Width of the desktop sidebar column. `preview` follows the pointer during a drag; `commit` also
// stores the width, so it survives a reload. The wanted width is kept as it is and limited to the
// viewport only when read, so a window that shrinks and grows again gets the old width back.
export const useSidebarWidth = () => {
  const [wanted, setWanted] = useState(loadWidth);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const commit = (width: number) => {
    const clamped = clampSidebarWidth(width, viewportWidth);
    setWanted(clamped);
    saveWidth(clamped);
  };

  return {
    width: clampSidebarWidth(wanted, viewportWidth),
    min: SIDEBAR_MIN_WIDTH,
    max: maxFor(viewportWidth),
    preview: (width: number) => setWanted(clampSidebarWidth(width, viewportWidth)),
    commit,
    reset: () => commit(SIDEBAR_DEFAULT_WIDTH),
  };
};
