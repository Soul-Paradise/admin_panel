/**
 * Client-side checks and resizing before an image goes to the bucket. The
 * server re-checks type (magic bytes) and size; this just keeps uploads small
 * and gives the admin instant feedback.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_DIMENSION = 2400;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface PreparedImage {
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
  /** True when the image was scaled down to MAX_DIMENSION. */
  resized: boolean;
}

/** Problem with the file, or null when it can be uploaded. */
export function checkImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Only JPEG, PNG and WebP images are allowed';
  if (file.size > MAX_UPLOAD_BYTES) return `Too large (${(file.size / 1024 / 1024).toFixed(1)} MB) - the limit is 10 MB`;
  return null;
}

/** "kerala_backwaters-2.jpg" -> "Kerala backwaters 2" */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Untitled image';
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This file could not be read as an image'));
    };
    img.src = url;
  });
}

/**
 * Reads the dimensions and, when either side exceeds MAX_DIMENSION, redraws
 * the image at that size (WebP when the browser can encode it, else JPEG).
 * Smaller images are uploaded untouched.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const img = await loadImage(file);
  const { naturalWidth: w, naturalHeight: h } = img;
  if (Math.max(w, h) <= MAX_DIMENSION) {
    return { blob: file, fileName: file.name, width: w, height: h, resized: false };
  }

  const scale = MAX_DIMENSION / Math.max(w, h);
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blob: file, fileName: file.name, width: w, height: h, resized: false };
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  let blob = await toBlob('image/webp');
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob('image/jpeg');
    ext = 'jpg';
  }
  if (!blob) return { blob: file, fileName: file.name, width: w, height: h, resized: false };
  return { blob, fileName: file.name.replace(/\.[a-z0-9]+$/i, '') + `.${ext}`, width, height, resized: true };
}
