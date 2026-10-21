import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { pool, resetData } from '../db/helpers';
import { FIXTURE } from './fixtures';

export default async function globalSetup() {
  await resetData();
  await pool.end();
  mkdirSync(path.dirname(FIXTURE), { recursive: true });
  // A photo carrying EXIF camera + GPS data, to prove uploads are stripped of it.
  await sharp({ create: { width: 2400, height: 1800, channels: 3, background: { r: 180, g: 40, b: 30 } } })
    .jpeg({ quality: 85 })
    .withExifMerge({
      IFD0: { Make: 'TestCam', Model: 'GPS-Leak 1', Copyright: 'SECRET-OWNER' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '30/1 20/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '76/1 24/1 0/1' },
    })
    .toFile(FIXTURE);
}
