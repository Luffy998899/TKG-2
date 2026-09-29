/**
 * File type from the bytes, never from the name or the declared type (Q8).
 * Only these five kinds are ever stored.
 */
export type AllowedMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'image/heif';

export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const;

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-') return 'application/pdf';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';
  }
  return null;
}

export const hasAllowedExtension = (name: string): boolean => {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
};
