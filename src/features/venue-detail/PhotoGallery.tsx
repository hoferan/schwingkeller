import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { VenuePhoto } from '../venues/types';
import { theme } from '../../theme';

interface PhotoGalleryProps {
  photos: VenuePhoto[];
  venueName: string;
}

const fillStyle: CSSProperties = { position: 'absolute', inset: 0 };

const arrowStyle = (side: 'left' | 'right'): CSSProperties => ({
  position: 'absolute', top: '50%', [side]: '8px', transform: 'translateY(-50%)',
  width: '28px', height: '28px', borderRadius: '50%', border: 'none',
  background: 'rgba(17,17,17,.55)', color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

const dotStyle = (active: boolean): CSSProperties => ({
  width: '7px', height: '7px', borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
  background: active ? theme.color.bg : 'rgba(255,255,255,.5)',
});

export function PhotoGallery({ photos, venueName }: PhotoGalleryProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (emblaApi) setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => emblaApi.off('select', onSelect);
  }, [emblaApi, onSelect]);

  if (photos.length === 0) {
    return (
      <div
        style={{
          ...fillStyle,
          background: 'repeating-linear-gradient(45deg,#e5e5e5 0 12px,#d4d4d4 12px 24px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'monospace', fontSize: '11px', letterSpacing: '.12em', color: theme.color.ink,
            background: theme.color.bg, border: '1px solid ' + theme.color.line, padding: '6px 11px',
          }}
        >
          FOTO · {venueName}
        </span>
      </div>
    );
  }

  return (
    <div style={{ ...fillStyle, overflow: 'hidden' }} ref={emblaRef}>
      <div style={{ display: 'flex', height: '100%' }}>
        {photos.map((photo) => (
          <div key={photo.id} style={{ position: 'relative', flex: '0 0 100%', height: '100%' }}>
            <img
              src={photo.url}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" aria-label="previous" style={arrowStyle('left')} onClick={() => emblaApi?.scrollPrev()}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" aria-label="next" style={arrowStyle('right')} onClick={() => emblaApi?.scrollNext()}>
            <ChevronRight size={16} />
          </button>
          <div style={{ position: 'absolute', bottom: '8px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '5px' }}>
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                aria-label={`photo ${i + 1}`}
                style={dotStyle(i === selected)}
                onClick={() => emblaApi?.scrollTo(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
