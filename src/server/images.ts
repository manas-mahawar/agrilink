import 'server-only';
import sharp from 'sharp';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/domain/listings';

export interface ProcessedImage {
  main: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

/** Magic-byte sniffing: the browser-reported type is not trusted. */
function sniff(buf: Buffer): (typeof ACCEPTED_IMAGE_TYPES)[number] | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export class ImageRejected extends Error {}

/**
 * Validates and re-encodes an uploaded photo. Re-encoding drops all metadata (EXIF, GPS
 * location, camera serials), normalises orientation, caps the size, and neutralises files
 * that only pretend to be images.
 */
export async function processListingImage(file: File): Promise<ProcessedImage> {
  if (file.size === 0) throw new ImageRejected('That file is empty.');
  if (file.size > MAX_IMAGE_BYTES) throw new ImageRejected('Each photo must be 5 MB or smaller.');
  const input = Buffer.from(await file.arrayBuffer());
  if (!sniff(input)) throw new ImageRejected('Upload JPEG, PNG or WebP photos only.');
  try {
    const base = sharp(input, { failOn: 'error', limitInputPixels: 50_000_000 }).rotate();
    const { data: main, info } = await base
      .clone()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await base.clone().resize({ width: 640, height: 480, fit: 'cover' }).webp({ quality: 74 }).toBuffer();
    return { main, thumb, width: info.width, height: info.height };
  } catch {
    throw new ImageRejected('That photo could not be read. Try a different file.');
  }
}
