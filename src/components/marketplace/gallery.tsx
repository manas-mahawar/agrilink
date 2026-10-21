'use client';

import Image from 'next/image';
import * as React from 'react';
import type { ImageRef } from '@/server/data/types';
import { cn } from '@/lib/utils';
import { ListingPhoto } from './listing-photo';

export function Gallery({ images, categoryId, title }: { images: ImageRef[]; categoryId: string; title: string }) {
  const [active, setActive] = React.useState(0);
  if (!images.length) return <ListingPhoto image={null} categoryId={categoryId} sizes="(min-width: 1024px) 700px, 100vw" rounded="rounded-xl" />;
  const current = images[Math.min(active, images.length - 1)];
  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-sage">
        <Image
          key={current.url}
          src={current.url}
          alt={current.alt}
          fill
          priority
          sizes="(min-width: 1024px) 700px, 100vw"
          unoptimized={!current.illustrative}
          className="object-cover"
        />
        {images.length > 1 ? (
          <span className="tabular absolute bottom-3 right-3 rounded-md bg-[rgb(16_30_22/0.6)] px-2 py-1 text-xs font-semibold text-white">
            {active + 1} / {images.length}
          </span>
        ) : null}
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-2.5 overflow-x-auto pb-1" aria-label={`Photos of ${title}`}>
          {images.map((img, i) => (
            <li key={img.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-current={i === active ? 'true' : undefined}
                className={cn('relative block size-20 overflow-hidden rounded-lg border-2 sm:size-24', i === active ? 'border-forest' : 'border-transparent opacity-80 hover:opacity-100')}
              >
                <Image src={img.thumbUrl} alt="" fill sizes="96px" unoptimized={!img.illustrative} className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
