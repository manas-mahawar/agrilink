import { Camera } from 'lucide-react';
import Image from 'next/image';
import type { ImageRef } from '@/server/data/types';
import { cn } from '@/lib/utils';

const TONES: Record<string, string> = {
  tomatoes: '#8a3b2e',
  potatoes: '#7e6646',
  onions: '#74465a',
};

/** A listing photo at a fixed aspect ratio, or a clearly labelled placeholder. */
export function ListingPhoto({
  image,
  categoryId,
  sizes,
  priority,
  thumb = false,
  className,
  rounded = '',
  aspect = '4/3',
}: {
  image: ImageRef | null;
  categoryId: string;
  sizes: string;
  priority?: boolean;
  thumb?: boolean;
  className?: string;
  rounded?: string;
  /** 'none' lets the parent decide the height (list rows). */
  aspect?: '4/3' | 'none';
}) {
  return (
    <div className={cn('relative w-full overflow-hidden bg-sage', aspect === '4/3' ? 'aspect-[4/3]' : 'min-h-[132px]', rounded, className)}>
      {image ? (
        <Image
          src={thumb ? image.thumbUrl : image.url}
          alt={image.alt}
          fill
          sizes={sizes}
          priority={priority}
          // Farmer uploads are already resized on upload; bundled photos use the optimizer.
          unoptimized={!image.illustrative}
          className="object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-end p-3"
          style={{
            background: `radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1.6px) 0 0 / 6px 6px, ${TONES[categoryId] ?? '#4f6a35'}`,
          }}
          role="img"
          aria-label="No photo added yet"
        >
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(16_30_22/0.5)] px-2 py-1 text-[11px] font-semibold text-white">
            <Camera className="size-3.5" aria-hidden="true" /> No photo added yet
          </span>
        </div>
      )}
    </div>
  );
}
