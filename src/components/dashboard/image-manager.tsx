'use client';

import { ImagePlus, Star, Trash2 } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_LISTING_IMAGES } from '@/domain/listings';
import { deleteListingImageAction, makeCoverImageAction, uploadListingImagesAction } from '@/server/actions/listings';

interface Img {
  id: string;
  url: string;
  thumbUrl: string;
  alt: string;
}

/**
 * Shrinks a phone photo in the browser before upload (long edge 2000 px, JPEG). This keeps
 * uploads small on mobile data and within the server's request limit. The server still
 * validates and re-encodes every file.
 */
async function downscale(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

export function ImageManager({ listingId, images, disabled }: { listingId: string; images: Img[]; disabled?: boolean }) {
  const [pending, startTransition] = React.useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const room = MAX_LISTING_IMAGES - images.length;

  const onFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    if (files.length > room) return toast.error(`You can add ${room} more photo${room === 1 ? '' : 's'}.`);
    const bad = files.find((f) => !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(f.type) && !/\.(jpe?g|png|webp)$/i.test(f.name));
    if (bad) return toast.error(`${bad.name}: upload JPEG, PNG or WebP photos only.`);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('listingId', listingId);
      let total = 0;
      for (const f of files) {
        const small = await downscale(f);
        if (small.size > MAX_IMAGE_BYTES) {
          toast.error(`${f.name} is larger than 5 MB.`);
          return;
        }
        total += small.size;
        fd.append('photos', small);
      }
      if (total > 3_800_000) {
        toast.error('Those photos are too large to send together. Add them one or two at a time.');
        return;
      }
      const res = await uploadListingImagesAction(null, fd);
      if (res.ok) toast.success(res.message ?? 'Photos added.');
      else toast.error(res.error);
      if (inputRef.current) inputRef.current.value = '';
    });
  };

  const run = (id: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => {
    setBusyId(id);
    startTransition(async () => {
      const res = await fn();
      setBusyId(null);
      if (res.ok) toast.success(res.message ?? 'Done');
      else toast.error(res.error ?? 'Something went wrong.');
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {images.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id} className="flex flex-col overflow-hidden rounded-lg border border-line bg-white">
              <div className="relative aspect-[4/3] bg-sage">
                <Image src={img.thumbUrl} alt={img.alt} fill sizes="240px" unoptimized className="object-cover" />
                {i === 0 ? (
                  <Badge tone="forest" className="absolute left-2 top-2">
                    Cover
                  </Badge>
                ) : null}
              </div>
              {!disabled ? (
                <div className="flex items-center justify-between gap-1 p-1.5">
                  {i > 0 ? (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(img.id, () => makeCoverImageAction(img.id))} aria-label={`Make photo ${i + 1} the cover`}>
                      <Star /> Cover
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    disabled={pending}
                    onClick={() => run(img.id, () => deleteListingImageAction(img.id))}
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    <Trash2 /> {busyId === img.id ? 'Removing…' : 'Remove'}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No photos yet. Listings with clear photos of the crop get more serious offers.</p>
      )}
      {!disabled && room > 0 ? (
        <div>
          <input
            ref={inputRef}
            id="listing-photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
            disabled={pending}
          />
          <Button asChild variant="secondary" aria-disabled={pending}>
            <label htmlFor="listing-photos" className="cursor-pointer">
              <ImagePlus /> {pending ? 'Uploading…' : `Add photos (${room} left)`}
            </label>
          </Button>
          <p className="mt-2 text-[13px] text-muted">JPEG, PNG or WebP, up to 5 MB each. Location data is removed from photos when they are saved.</p>
        </div>
      ) : null}
    </div>
  );
}
