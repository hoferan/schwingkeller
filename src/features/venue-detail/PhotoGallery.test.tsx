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
  it('renders nothing when there are no photos', () => {
    const { container } = render(<PhotoGallery photos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single photo with no navigation controls', () => {
    const photos: VenuePhoto[] = [{ id: 'p1', url: 'https://example.com/1.jpg', position: 0 }];
    render(<PhotoGallery photos={photos} />);
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
  });

  it('renders navigation controls for 2+ photos and wires them to the embla API', () => {
    const photos: VenuePhoto[] = [
      { id: 'p1', url: 'https://example.com/1.jpg', position: 0 },
      { id: 'p2', url: 'https://example.com/2.jpg', position: 1 },
    ];
    render(<PhotoGallery photos={photos} />);
    screen.getByRole('button', { name: /next/i }).click();
    expect(scrollNext).toHaveBeenCalledTimes(1);
    screen.getByRole('button', { name: /previous/i }).click();
    expect(scrollPrev).toHaveBeenCalledTimes(1);
  });
});
