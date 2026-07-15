import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./imageCompression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./imageCompression')>();
  return { ...actual, compressImageIfNeeded: vi.fn(async (f: File) => f) };
});

const { order, from, rpc, select, insert, update, del, eq, single } = vi.hoisted(() => {
  const single = vi.fn();
  const eq = vi.fn(() => ({ select, single }));
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
  listVenues, replaceAllVenues, insertVenuePhoto, deleteVenuePhoto,
  updateVenuePhotoPosition, syncVenuePhotos, uploadPhoto,
} from './api';
import { compressImageIfNeeded, PhotoTooLargeError } from './imageCompression';
import { supabase } from '../../lib/supabase';
import type { VenueInput, VenuePhoto } from './types';

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

describe('venue_photos CRUD', () => {
  it('insertVenuePhoto inserts a row and returns it', async () => {
    single.mockResolvedValue({ data: { id: 'p1', url: 'u1', position: 0 }, error: null });
    const result = await insertVenuePhoto('v1', 'u1', 0);
    expect(from).toHaveBeenCalledWith('venue_photos');
    expect(insert).toHaveBeenCalledWith({ venue_id: 'v1', url: 'u1', position: 0 });
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

describe('syncVenuePhotos', () => {
  const original: VenuePhoto[] = [
    { id: 'p1', url: 'u1', position: 0 },
    { id: 'p2', url: 'u2', position: 1 },
  ];

  it('deletes photos removed from the draft', async () => {
    eq.mockResolvedValue({ error: null });
    await syncVenuePhotos('v1', original, [original[0]]);
    expect(del).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith('id', 'p2');
  });

  it('inserts new photos (no matching id in original) at their draft index', async () => {
    single.mockResolvedValue({ data: {}, error: null });
    eq.mockResolvedValue({ error: null });
    const draft: VenuePhoto[] = [...original, { id: 'new-1', url: 'u3', position: 0 }];
    await syncVenuePhotos('v1', original, draft);
    expect(insert).toHaveBeenCalledWith({ venue_id: 'v1', url: 'u3', position: 2 });
  });

  it('updates position only for existing photos whose index changed', async () => {
    eq.mockResolvedValue({ error: null });
    const reordered: VenuePhoto[] = [original[1], original[0]];
    await syncVenuePhotos('v1', original, reordered);
    expect(update).toHaveBeenCalledWith({ position: 0 });
    expect(update).toHaveBeenCalledWith({ position: 1 });
  });

  it('does nothing when the draft matches the original', async () => {
    await syncVenuePhotos('v1', original, original);
    expect(del).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

const SAMPLE_VENUE: VenueInput & { photo_urls: string[] } = {
  name: 'Testkeller', canton: 'BE', address: 'Musterweg 1', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photo_urls: ['https://example.com/1.jpg'],
};

describe('replaceAllVenues', () => {
  it('calls replace_venues RPC with the given rows', async () => {
    rpc.mockResolvedValue({ error: null });
    await replaceAllVenues([SAMPLE_VENUE]);
    expect(rpc).toHaveBeenCalledWith('replace_venues', { rows: [SAMPLE_VENUE] });
  });
  it('works with an empty list', async () => {
    rpc.mockResolvedValue({ error: null });
    await replaceAllVenues([]);
    expect(rpc).toHaveBeenCalledWith('replace_venues', { rows: [] });
  });
  it('throws with error code prefix on RPC error', async () => {
    rpc.mockResolvedValue({ error: { message: 'function does not exist', code: '42883' } });
    await expect(replaceAllVenues([SAMPLE_VENUE])).rejects.toThrow('[42883] function does not exist');
  });
  it('propagates pg_safeupdate 21000 error when DELETE lacks WHERE clause', async () => {
    rpc.mockResolvedValue({ error: { message: 'DELETE requires a WHERE clause', code: '21000' } });
    await expect(replaceAllVenues([SAMPLE_VENUE])).rejects.toThrow('[21000] DELETE requires a WHERE clause');
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
});
