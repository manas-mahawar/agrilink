import { ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ImageManager } from '@/components/dashboard/image-manager';
import { ListingForm } from '@/components/dashboard/listing-form';
import { ListingStatusControls } from '@/components/dashboard/listing-status-controls';
import { ListingStatusBadge } from '@/components/dashboard/status-badges';
import { Button } from '@/components/ui/button';
import { Card, Notice, PageHeader } from '@/components/ui/primitives';
import { requireFarmer } from '@/server/auth';
import { getOwnListing } from '@/server/data/dashboard';

export const metadata: Metadata = { title: 'Edit listing' };

export default async function EditListingPage({ params, searchParams }: { params: Promise<{ listingId: string }>; searchParams: Promise<{ created?: string }> }) {
  const { listingId } = await params;
  const { created } = await searchParams;
  const user = await requireFarmer(`/dashboard/listings/${listingId}`);
  const listing = await getOwnListing(user.id, listingId);
  if (!listing) notFound();
  const publicVisible = (listing.status === 'active' || listing.status === 'sold_out') && !listing.hiddenByAdmin;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/dashboard/listings" className="hover:underline">
            ← My listings
          </Link>
        }
        title={listing.title}
        actions={
          publicVisible ? (
            <Button asChild variant="secondary">
              <Link href={`/marketplace/${listing.id}`}>
                View public page <ExternalLink />
              </Link>
            </Button>
          ) : undefined
        }
      />
      {created ? <Notice tone="ok">{listing.status === 'draft' ? 'Draft saved. Add photos, then publish when you are ready.' : 'Listing published. Add photos so buyers can see the crop.'}</Notice> : null}
      {listing.hiddenByAdmin ? (
        <Notice tone="danger" title="Hidden by AgriLink moderators">
          {listing.hiddenReason ?? 'This listing breaks the terms of use.'} Contact support if you think this is a mistake.
        </Notice>
      ) : null}
      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">Status</span>
          <ListingStatusBadge status={listing.status} hidden={listing.hiddenByAdmin} />
        </div>
        <ListingStatusControls listingId={listing.id} status={listing.status} quantityAvailable={listing.quantityAvailable} hiddenByAdmin={listing.hiddenByAdmin} />
      </Card>
      <section aria-labelledby="photos-h" className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5 sm:p-6">
        <h2 id="photos-h" className="text-lg font-extrabold">
          Photos
        </h2>
        <ImageManager listingId={listing.id} images={listing.images} disabled={listing.status === 'archived'} />
      </section>
      <ListingForm listing={listing} />
    </>
  );
}
