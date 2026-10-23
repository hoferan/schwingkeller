import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('./imageCompression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./imageCompression')>();
  return { ...actual, compressImageIfNeeded: vi.fn(async (f: File) => f) };
});

const { order, from, rpc, select, insert, update, del, eq, single } = vi.hoisted(() => {
  const single = vi.fn();
  const eq = vi.fn((): { select: typeof select; single: typeof single } | { error: null } => ({ select, single }));
  const order = vi.fn();
  const select = vi.fn(() => ({ order, single, eq }));
  const insert = vi.fn(() => ({ select, eq }));
  const update = vi.fn(() => ({ eq }));
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select, insert, update, delete: del }));
  const rpc = vi.fn();
  return { order, from, rpc, select, insert, update, del, eq, single };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc } }));

import {
  listVenues, insertVenuePhoto, deleteVenuePhoto,
  updateVenuePhotoPosition, uploadPhoto,
  createVenue, updateVenue, removeVenue, VenueChangeRefusedError,
} from './api';
import type { VenueInput } from './types';
import { compressImageIfNeeded, PhotoTooLargeError, UnsupportedPhotoTypeError } from './imageCompression';
import { supabase } from '../../lib/supabase';

beforeEach(() => { vi.clearAllMocks(); });

describe('listVenues', () => {
  it('selects venues with embedded venue_photos, ordered by name', async () => {
    order.mockResolvedValue({
      data: [{
        id: '1', name: 'A',
        venue_photos: [
          { id: 'p2', url: 'u2', position: 1 },
          { id: 'p1', url: 'u1', position: 0 },
        ],
      }],
      error: null,
    });
    const result = await listVenues();
    expect(from).toHaveBeenCalledWith('venues');
    expect(select).toHaveBeenCalledWith('*, venue_photos(id,url,position)');
    expect(order).toHaveBeenCalledWith('name');
    expect(result).toEqual([{
      id: '1', name: 'A',
      photos: [{ id: 'p1', url: 'u1', position: 0 }, { id: 'p2', url: 'u2', position: 1 }],
    }]);
  });

  it('throws with error code prefix when Supabase returns an error', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'relation not found', code: '42P01' } });
    await expect(listVenues()).rejects.toThrow('[42P01] relation not found');
  });

  it('sets err.cause to the raw Supabase error so Sentry receives hint and details', async () => {
    const raw = { message: 'relation not found', code: '42P01', hint: 'Check schema', details: 'Table missing' };
    order.mockResolvedValue({ data: null, error: raw });
    const err = await listVenues().catch((e: unknown) => e);
    expect((err as Error).cause).toBe(raw);
  });
});

describe('removeVenue', () => {
  it('asks for the deleted ids and resolves when one row was deleted', async () => {
    (select as Mock).mockResolvedValueOnce({ data: [{ id: 'v1' }], error: null });
    await expect(removeVenue('v1')).resolves.toBeUndefined();
    expect(eq).toHaveBeenCalledWith('id', 'v1');
    expect(select).toHaveBeenCalledWith('id');
  });

  it('throws VenueChangeRefusedError when RLS filtered the delete to zero rows', async () => {
    (select as Mock).mockResolvedValueOnce({ data: [], error: null });
    await expect(removeVenue('v1')).rejects.toBeInstanceOf(VenueChangeRefusedError);
  });

  it('keeps the generic error for a database error', async () => {
    (select as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom', code: '42501' } });
    await expect(removeVenue('v1')).rejects.toThrow('[42501] boom');
  });
});

describe('createVenue', () => {
  const input = { name: 'Halle' } as VenueInput;

  it('inserts the venue under the id the form gave it', async () => {
    single.mockResolvedValueOnce({ data: { id: 'n1', name: 'Halle' }, error: null });
    await expect(createVenue('n1', input)).resolves.toEqual({ id: 'n1', name: 'Halle', photos: [] });
    expect(insert).toHaveBeenCalledWith({ id: 'n1', name: 'Halle' });
  });

  // An earlier attempt created it and the answer got lost. The id is the only unique key.
  it('updates the venue when one with that id exists already', async () => {
    single
      .mockResolvedValueOnce({ data: null, error: { message: 'duplicate key value', code: '23505' } })
      .mockResolvedValueOnce({ data: { id: 'n1', name: 'Halle' }, error: null });
    await expect(createVenue('n1', input)).resolves.toEqual({ id: 'n1', name: 'Halle', photos: [] });
    expect(update).toHaveBeenCalledWith(input);
    expect(eq).toHaveBeenCalledWith('id', 'n1');
  });

  it('keeps the generic error for other codes', async () => {
    single.mockResolvedValueOnce({ data: null, error: { message: 'boom', code: '42501' } });
    await expect(createVenue('n1', input)).rejects.toThrow('[42501] boom');
    expect(update).not.toHaveBeenCalled();
  });
});

describe('updateVenue', () => {
  it('throws VenueChangeRefusedError when .single() found no row (PGRST116)', async () => {
    single.mockResolvedValueOnce({ data: null, error: { message: 'no rows', code: 'PGRST116' } });
    await expect(updateVenue('v1', { name: 'X' })).rejects.toBeInstanceOf(VenueChangeRefusedError);
  });

  it('keeps the generic error for other codes', async () => {
    single.mockResolvedValueOnce({ data: null, error: { message: 'boom', code: '23505' } });
    const err = await updateVenue('v1', { name: 'X' }).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(VenueChangeRefusedError);
    expect((err as Error).message).toBe('[23505] boom');
  });
});

describe('venue_photos CRUD', () => {
  it('insertVenuePhoto inserts a row under the photo id and returns it', async () => {
    single.mockResolvedValue({ data: { id: 'p1', url: 'u1', position: 0 }, error: null });
    const result = await insertVenuePhoto('v1', { id: 'p1', url: 'u1', position: 0 });
    expect(from).toHaveBeenCalledWith('venue_photos');
    expect(insert).toHaveBeenCalledWith({ id: 'p1', venue_id: 'v1', url: 'u1', position: 0 });
    expect(result).toEqual({ id: 'p1', url: 'u1', position: 0 });
  });

  it('deleteVenuePhoto deletes by id', async () => {
    eq.mockResolvedValueOnce({ error: null });
    await deleteVenuePhoto('p1');
    expect(from).toHaveBeenCalledWith('venue_photos');
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 'p1');
  });

  it('updateVenuePhotoPosition updates position by id', async () => {
    eq.mockResolvedValueOnce({ error: null });
    await updateVenuePhotoPosition('p1', 2);
    expect(update).toHaveBeenCalledWith({ position: 2 });
    expect(eq).toHaveBeenCalledWith('id', 'p1');
  });
});

describe('uploadPhoto', () => {
  const upload = vi.fn();
  const getPublicUrl = vi.fn();
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).storage = { from: vi.fn(() => ({ upload, getPublicUrl })) };
    upload.mockResolvedValue({ error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/x.jpg' } });
  });

  it('compresses, uploads, and returns the public URL', async () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const url = await uploadPhoto(file);
    expect(compressImageIfNeeded).toHaveBeenCalledWith(file);
    expect(upload).toHaveBeenCalled();
    expect(url).toBe('https://cdn.example.com/x.jpg');
  });

  it('throws PhotoTooLargeError when the compressed file is still over 5MB', async () => {
    vi.mocked(compressImageIfNeeded).mockResolvedValueOnce(
      new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' }),
    );
    const file = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
    await expect(uploadPhoto(file)).rejects.toBeInstanceOf(PhotoTooLargeError);
    expect(upload).not.toHaveBeenCalled();
  });

  it.each([
    ['an SVG', new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })],
    ['a HEIC photo', new File(['x'], 'IMG_1.heic', { type: 'image/heic' })],
    ['a file without a type', new File(['x'], 'IMG_1')],
  ])('refuses %s before uploading, since the bucket would', async (_label, file) => {
    await expect(uploadPhoto(file)).rejects.toBeInstanceOf(UnsupportedPhotoTypeError);
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads a large photo that compression turned into a JPEG, whatever it was before', async () => {
    vi.mocked(compressImageIfNeeded).mockResolvedValueOnce(new File(['x'], 'IMG_1.jpg', { type: 'image/jpeg' }));
    await expect(uploadPhoto(new File(['x'], 'IMG_1.heic', { type: 'image/heic' }))).resolves.toBe(
      'https://cdn.example.com/x.jpg',
    );
    expect(upload).toHaveBeenCalled();
  });

  it('calls a large photo the browser cannot read unsupported when its type is not allowed', async () => {
    vi.mocked(compressImageIfNeeded).mockRejectedValueOnce(new DOMException('decode failed', 'InvalidStateError'));
    await expect(uploadPhoto(new File(['x'], 'IMG_1.heic', { type: 'image/heic' }))).rejects.toBeInstanceOf(
      UnsupportedPhotoTypeError,
    );
  });

  it('keeps the original error when a photo of an allowed type cannot be read', async () => {
    vi.mocked(compressImageIfNeeded).mockRejectedValueOnce(new Error('decode failed'));
    await expect(uploadPhoto(new File(['x'], 'broken.png', { type: 'image/png' }))).rejects.toThrow('decode failed');
  });
});
