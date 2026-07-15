import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhotoGallery } from './PhotoGallery';
import type { VenuePhoto } from '../venues/types';

const { scrollNext, scrollPrev, scrollTo } = vi.hoisted(() => ({
  scrollNext: vi.fn(),
  scrollPrev: vi.fn(),
  scrollTo: vi.fn(),
}));

vi.mock('embla-carousel-react', () => ({
  default: () => [
    vi.fn(),
    {
      scrollNext, scrollPrev, scrollTo,
      selectedScrollSnap: () => 0,
      on: vi.fn(),
      off: vi.fn(),
    },
  ],
}));

describe('PhotoGallery', () => {
  it('shows the placeholder when there are no photos', () => {
    render(<PhotoGallery photos={[]} venueName="Bern" />);
    expect(screen.getByText('FOTO · Bern')).toBeInTheDocument();
  });

  it('renders a single photo with no navigation controls', () => {
    const photos: VenuePhoto[] = [{ id: 'p1', url: 'https://example.com/1.jpg', position: 0 }];
    render(<PhotoGallery photos={photos} venueName="Bern" />);
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
  });

  it('renders navigation controls for 2+ photos and wires them to the embla API', () => {
    const photos: VenuePhoto[] = [
      { id: 'p1', url: 'https://example.com/1.jpg', position: 0 },
      { id: 'p2', url: 'https://example.com/2.jpg', position: 1 },
    ];
    render(<PhotoGallery photos={photos} venueName="Bern" />);
    screen.getByRole('button', { name: /next/i }).click();
    expect(scrollNext).toHaveBeenCalledTimes(1);
    screen.getByRole('button', { name: /previous/i }).click();
    expect(scrollPrev).toHaveBeenCalledTimes(1);
  });
});
