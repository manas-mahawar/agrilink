import { BadgeCheck, CalendarDays, MapPin, Package } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/primitives';
import { QUALITY_SHORT } from '@/domain/listings';
import { formatQuantity } from '@/domain/units';
import type { ListingSummary } from '@/server/data/types';
import { formatShortDate, harvestLabel } from '@/lib/utils';
import { ListingPhoto } from './listing-photo';
import { AskingPrice } from './price';
import { SaveButton } from './saved-listings';

export function listingTitle(l: Pick<ListingSummary, 'produceName' | 'variety'>) {
  return l.variety ? `${l.produceName} · ${l.variety}` : l.produceName;
}

export function VerifiedBadge({ demo }: { demo?: boolean }) {
  return (
    <Badge tone="ok">
      <BadgeCheck aria-hidden="true" />
      {demo ? 'Verified · demo' : 'Verified farmer'}
    </Badge>
  );
}

/** Compact horizontal variant for the marketplace list view. */
export function ListingRow({ listing }: { listing: ListingSummary }) {
  const title = listingTitle(listing);
  const href = `/marketplace/${listing.id}`;
  return (
    <article className="grid grid-cols-[132px_1fr] overflow-hidden rounded-lg border border-line bg-white hover:shadow-lift md:grid-cols-[180px_1fr_auto]">
      <div className="relative">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="block h-full">
          <ListingPhoto image={listing.cover} categoryId={listing.categoryId} thumb sizes="180px" className="h-full" aspect="none" />
        </Link>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-bold leading-snug">
            <Link href={href} className="hover:text-forest hover:underline hover:underline-offset-4">
              {title}
            </Link>
          </h3>
          {listing.farmerVerified ? <VerifiedBadge demo={listing.isDemo} /> : null}
          {listing.isDemo && !listing.farmerVerified ? <Badge tone="neutral">Demo listing</Badge> : null}
        </div>
        <span className="text-[13px] text-muted">
          {QUALITY_SHORT[listing.qualityGrade]} · {listing.categoryName} · {listing.farmerName}
        </span>
        <ul className="tabular flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft">
          <li>{formatQuantity(listing.quantityAvailable, listing.unit)} available</li>
          <li>{listing.expectedHarvestDate ? `Harvest ${formatShortDate(listing.expectedHarvestDate)}` : 'Ready now'}</li>
          <li>
            {listing.localityName} · ~{listing.kmFromPatiala} km
          </li>
        </ul>
        <div className="md:hidden">
          <AskingPrice pricePerUnitPaise={listing.pricePerUnitPaise} unit={listing.unit} />
        </div>
      </div>
      <div className="hidden flex-col items-end justify-between gap-3 border-l border-line-soft p-4 md:flex">
        <AskingPrice pricePerUnitPaise={listing.pricePerUnitPaise} unit={listing.unit} align="end" />
        <div className="flex items-center gap-2">
          <SaveButton listingId={listing.id} title={title} />
          <Link href={href} className="inline-flex min-h-10 items-center rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-deep" aria-label={`View ${title}`}>
            View
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ListingCard({ listing, priority = false }: { listing: ListingSummary; priority?: boolean }) {
  const title = listingTitle(listing);
  const href = `/marketplace/${listing.id}`;
  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-line bg-white transition-shadow hover:border-[#d2d8cb] hover:shadow-lift">
      <div className="relative">
        <Link href={href} tabIndex={-1} aria-hidden="true">
          <ListingPhoto image={listing.cover} categoryId={listing.categoryId} thumb priority={priority} sizes="(min-width: 1024px) 290px, (min-width: 640px) 45vw, 92vw" />
        </Link>
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {listing.farmerVerified ? <VerifiedBadge demo={listing.isDemo} /> : null}
          {listing.isDemo && !listing.farmerVerified ? <Badge tone="light">Demo listing</Badge> : null}
        </div>
        <SaveButton listingId={listing.id} title={title} className="absolute right-2 top-2" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[17px] font-bold leading-snug">
            <Link href={href} className="hover:text-forest hover:underline hover:underline-offset-4">
              {title}
            </Link>
          </h3>
          <span className="text-[13px] text-muted">
            {QUALITY_SHORT[listing.qualityGrade]} · {listing.categoryName}
          </span>
        </div>
        <AskingPrice pricePerUnitPaise={listing.pricePerUnitPaise} unit={listing.unit} />
        <ul className="tabular flex flex-col gap-1.5 text-[13px] text-ink-soft">
          <li className="flex items-center gap-2">
            <Package className="size-[15px] text-muted" aria-hidden="true" />
            {formatQuantity(listing.quantityAvailable, listing.unit)} of {formatQuantity(listing.quantityTotal, listing.unit)} available
          </li>
          <li className="flex items-center gap-2">
            <CalendarDays className="size-[15px] text-muted" aria-hidden="true" />
            {listing.expectedHarvestDate ? `${formatShortDate(listing.expectedHarvestDate)} · ${harvestLabel(listing.expectedHarvestDate)}` : 'Ready now'}
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="size-[15px] text-muted" aria-hidden="true" />
            {listing.localityName} · ~{listing.kmFromPatiala} km from Patiala
          </li>
        </ul>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-soft pt-3">
          <span className="truncate text-[13px] text-ink-soft">{listing.farmerName}</span>
          <Link
            href={href}
            className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-line-strong px-3.5 text-sm font-semibold text-forest hover:border-forest"
            aria-label={`View ${title}`}
          >
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
