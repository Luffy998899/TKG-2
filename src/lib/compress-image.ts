/**
 * Shrinks photos in the browser before they are uploaded.
 *
 * WHY. A photo straight off a phone is 3-8MB, and the moving and telecom forms
 * ask for several. Serverless hosts cap a request body at a few megabytes, so
 * four untouched photos are a failed submission - and nobody needs a 12
 * megapixel image to count how many boxes are in a room.
 *
 * A long edge of 1600px at JPEG q0.72 keeps a room, a piece of furniture or a
 * printed bill perfectly readable and lands at roughly 200-400KB. It also
 * re-encodes HEIC to JPEG wherever the browser can decode it (Safari can;
 * Chrome on Android does not produce HEIC in the first place).
 *
 * Anything that is not an image, or that fails to decode, is passed through
 * untouched - the upload must never be blocked by the optimisation.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.72;

/** Below this, re-encoding usually makes the file bigger, not smaller. */
const SKIP_UNDER_BYTES = 320 * 1024;

const isImage = (file: File): boolean =>
  file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);

export async function compressImage(file: File): Promise<File> {
  if (typeof window === 'undefined' || !isImage(file)) return file;
  if (file.size < SKIP_UNDER_BYTES && !/\.(heic|heif)$/i.test(file.name)) return file;

  try {
    const bitmap = await decode(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    if ('close' in bitmap) bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], renameToJpeg(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/** Compresses a list, keeping order. */
export const compressImages = (files: File[]): Promise<File[]> =>
  Promise.all(files.map(compressImage));

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* Safari refuses some HEICs here but decodes them through an <img>. */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not decode image.'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

const renameToJpeg = (name: string): string =>
  `${name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`;
