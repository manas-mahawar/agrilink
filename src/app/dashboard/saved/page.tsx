import { Heart } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ListingCard } from '@/components/marketplace/listing-card';
import { SavedListingsProvider } from '@/components/marketplace/saved-listings';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireBuyer } from '@/server/auth';
import { listSavedListings } from '@/server/data/dashboard';

export const metadata: Metadata = { title: 'Saved listings' };

export default async function SavedPage() {
  await requireBuyer('/dashboard/saved');
  const saved = await listSavedListings();
  return (
    <>
      <PageHeader title="Saved listings" description="Listings you saved to come back to. Listings that are paused or archived by the farmer drop off this list." />
      {saved.length ? (
        <SavedListingsProvider>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {saved.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </SavedListingsProvider>
      ) : (
        <EmptyState
          icon={<Heart />}
          title="Nothing saved yet"
          action={
            <Button asChild>
              <Link href="/marketplace">Explore produce</Link>
            </Button>
          }
        >
          Tap the heart on any listing to keep it here.
        </EmptyState>
      )}
    </>
  );
}
