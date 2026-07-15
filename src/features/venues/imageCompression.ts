const COMPRESS_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5MB — matches the Storage bucket cap
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

export class PhotoTooLargeError extends Error {
  constructor() {
    super('Photo exceeds the 5MB limit even after compression.');
    this.name = 'PhotoTooLargeError';
  }
}

export const compressImageIfNeeded = async (file: File): Promise<File> => {
  if (file.size <= COMPRESS_THRESHOLD_BYTES) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  bitmap.close();
  if (!ctx) return file;
  ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) return file;

  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
};
