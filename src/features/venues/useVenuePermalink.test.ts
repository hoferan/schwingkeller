import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVenuePermalink } from './useVenuePermalink';
import type { Venue } from './types';

const venue = (over: Partial<Venue> = {}): Venue => ({
  id: 'v1',
  name: 'Schwingkeller Bern',
  canton: 'BE',
  address: 'Mattenweg 3, 3000 Bern',
  lat: 46.95,
  lng: 7.45,
  indoor: true,
  outdoor: false,
  person: 'Hans Muster',
  phone: '',
  website: '',
  photos: [],
  ...over,
});

interface Props {
  venueParam: string | null;
  venues: Venue[];
  venuesLoaded: boolean;
  detailId: string | null;
  openDetail: (id: string) => void;
  setExpanded: (updater: (e: Record<string, boolean>) => Record<string, boolean>) => void;
}

const renderPermalink = (initialProps: Props) =>
  renderHook((props: Props) => useVenuePermalink(props), { initialProps });

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('useVenuePermalink — matching', () => {
  it('does nothing when venueParam is null', () => {
    const openDetail = vi.fn();
    const setExpanded = vi.fn();
    renderPermalink({ venueParam: null, venues: [venue()], venuesLoaded: true, detailId: null, openDetail, setExpanded });
    expect(openDetail).not.toHaveBeenCalled();
    expect(setExpanded).not.toHaveBeenCalled();
  });

  it('waits until venuesLoaded before matching', () => {
    const openDetail = vi.fn();
    const setExpanded = vi.fn();
    const { rerender } = renderPermalink({
      venueParam: 'v1', venues: [], venuesLoaded: false, detailId: null, openDetail, setExpanded,
    });
    expect(openDetail).not.toHaveBeenCalled();
    rerender({ venueParam: 'v1', venues: [venue()], venuesLoaded: true, detailId: null, openDetail, setExpanded });
    expect(openDetail).toHaveBeenCalledWith('v1');
  });

  it("expands the matched venue's canton", () => {
    const openDetail = vi.fn();
    const setExpanded = vi.fn();
    renderPermalink({
      venueParam: 'v1', venues: [venue({ canton: 'FR' })], venuesLoaded: true, detailId: null, openDetail, setExpanded,
    });
    expect(setExpanded).toHaveBeenCalledTimes(1);
    const updater = setExpanded.mock.calls[0][0] as (e: Record<string, boolean>) => Record<string, boolean>;
    expect(updater({ BE: true })).toEqual({ BE: true, FR: true });
  });

  it('does not call openDetail when no venue matches', () => {
    const openDetail = vi.fn();
    const setExpanded = vi.fn();
    renderPermalink({
      venueParam: 'missing', venues: [venue()], venuesLoaded: true, detailId: null, openDetail, setExpanded,
    });
    expect(openDetail).not.toHaveBeenCalled();
    expect(setExpanded).not.toHaveBeenCalled();
  });

  it('only ever applies the permalink once, even if a matching venue arrives later', () => {
    const openDetail = vi.fn();
    const setExpanded = vi.fn();
    const { rerender } = renderPermalink({
      venueParam: 'v1', venues: [], venuesLoaded: true, detailId: null, openDetail, setExpanded,
    });
    expect(openDetail).not.toHaveBeenCalled();
    rerender({ venueParam: 'v1', venues: [venue()], venuesLoaded: true, detailId: null, openDetail, setExpanded });
    expect(openDetail).not.toHaveBeenCalled();
  });
});

describe('useVenuePermalink — URL sync', () => {
  it('does not touch the URL on the initial render', () => {
    window.history.replaceState(null, '', '/?ctn=FR');
    renderPermalink({
      venueParam: null, venues: [], venuesLoaded: false, detailId: null, openDetail: vi.fn(), setExpanded: vi.fn(),
    });
    expect(window.location.search).toBe('?ctn=FR');
  });

  it('syncs the URL to the new venue id when detailId changes', () => {
    window.history.replaceState(null, '', '/?ctn=FR');
    const { rerender } = renderPermalink({
      venueParam: null, venues: [], venuesLoaded: false, detailId: null, openDetail: vi.fn(), setExpanded: vi.fn(),
    });
    rerender({ venueParam: null, venues: [], venuesLoaded: false, detailId: 'v1', openDetail: vi.fn(), setExpanded: vi.fn() });
    expect(window.location.search).toBe('?venue=v1');
  });

  it('clears the URL venue param when detailId becomes null', () => {
    window.history.replaceState(null, '', '/?venue=v1');
    const { rerender } = renderPermalink({
      venueParam: null, venues: [], venuesLoaded: false, detailId: 'v1', openDetail: vi.fn(), setExpanded: vi.fn(),
    });
    rerender({ venueParam: null, venues: [], venuesLoaded: false, detailId: null, openDetail: vi.fn(), setExpanded: vi.fn() });
    expect(window.location.search).toBe('');
  });
});
