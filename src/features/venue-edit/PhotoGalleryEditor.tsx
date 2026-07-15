import { useState, type CSSProperties } from 'react';
import { X, Plus } from 'lucide-react';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { uploadPhoto, PhotoTooLargeError } from '../venues/api';
import { MAX_PHOTOS } from '../venues/photos';
import type { VenuePhoto } from '../venues/types';
import { useTranslation } from '../../i18n/useTranslation';
import { captureAndFormat } from '../../lib/sentry';
import { theme } from '../../theme';

interface PhotoGalleryEditorProps {
  photos: VenuePhoto[];
  onChange: (photos: VenuePhoto[]) => void;
  onError?: (msg: string) => void;
}

const thumbStyle: CSSProperties = {
  position: 'relative', width: '84px', height: '84px', borderRadius: theme.radius.sm,
  overflow: 'hidden', border: '1px solid ' + theme.color.line, flex: 'none', cursor: 'grab',
};
const deleteBtnStyle: CSSProperties = {
  position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%',
  border: 'none', background: 'rgba(17,17,17,.7)', color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
};
const addTileStyle: CSSProperties = {
  width: '84px', height: '84px', borderRadius: theme.radius.sm, border: '1.5px dashed ' + theme.color.line,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
  cursor: 'pointer', color: theme.color.ink, flex: 'none', background: 'none',
};
const hintStyle: CSSProperties = { fontSize: '11px', color: theme.color.muted, marginTop: '6px' };

function SortableThumb({ photo, onDelete, deleteLabel }: {
  photo: VenuePhoto; onDelete: () => void; deleteLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: photo.id });
  const style: CSSProperties = { ...thumbStyle, transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label={deleteLabel}
        style={deleteBtnStyle}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function PhotoGalleryEditor({ photos, onChange, onError }: PhotoGalleryEditorProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const remaining = MAX_PHOTOS - photos.length;

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (files.length > remaining) {
      onError?.(t.galleryCapReached.replace('{n}', String(remaining)));
    }
    const toUpload = files.slice(0, remaining);
    setUploading(true);
    try {
      let next = photos;
      for (const file of toUpload) {
        try {
          const url = await uploadPhoto(file);
          next = [...next, { id: crypto.randomUUID(), url, position: next.length }];
        } catch (err) {
          if (err instanceof PhotoTooLargeError) onError?.(t.photoTooLarge);
          else onError?.(captureAndFormat(err, t.uploadError));
        }
      }
      if (next !== photos) onChange(next);
    } finally {
      setUploading(false);
    }
  };

  const onDelete = (id: string) => onChange(photos.filter((p) => p.id !== id));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = photos.findIndex((p) => p.id === active.id);
    const newIndex = photos.findIndex((p) => p.id === over.id);
    onChange(arrayMove(photos, oldIndex, newIndex));
  };

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {photos.map((photo) => (
              <SortableThumb key={photo.id} photo={photo} onDelete={() => onDelete(photo.id)} deleteLabel={t.delete} />
            ))}
            {remaining > 0 && (
              <label style={addTileStyle}>
                <Plus size={18} />
                <span style={{ fontSize: '11px', fontWeight: 600 }}>{photos.length}/{MAX_PHOTOS}</span>
                <input
                  type="file" accept="image/*" multiple aria-label={t.upload}
                  onChange={(e) => { void onFiles(e); }} style={{ display: 'none' }} disabled={uploading}
                />
              </label>
            )}
          </div>
        </SortableContext>
      </DndContext>
      {remaining === 0 && <div style={hintStyle}>{t.galleryFull}</div>}
      <div style={hintStyle}>{t.photoResizeHint}</div>
    </div>
  );
}
