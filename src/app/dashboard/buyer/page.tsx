import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { OfferRow, OrderRow } from '@/components/dashboard/rows';
import { ListingCard } from '@/components/marketplace/listing-card';
import { SavedListingsProvider } from '@/components/marketplace/saved-listings';
import { Button } from '@/components/ui/button';
import { Card, Notice, PageHeader, Stat } from '@/components/ui/primitives';
import { isOfferOpen } from '@/domain/offers';
import { requireBuyer } from '@/server/auth';
import { listOffers, listOrders, listSavedListings } from '@/server/data/dashboard';

export const metadata: Metadata = { title: 'Buyer overview' };

export default async function BuyerHome({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const user = await requireBuyer('/dashboard/buyer');
  const { password } = await searchParams;
  const [offers, orders, saved] = await Promise.all([
    listOffers({ as: 'buyer', userId: user.id, scope: 'open', limit: 50 }),
    listOrders({ as: 'buyer', userId: user.id, limit: 50 }),
    listSavedListings(),
  ]);
  const open = offers.filter((o) => isOfferOpen(o));
  const yourTurn = open.filter((o) => o.status === 'countered');
  const activeOrders = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));

  return (
    <>
      {password === 'updated' ? <Notice tone="ok">Your password has been updated.</Notice> : null}
      <PageHeader
        eyebrow={user.organisationName ?? user.displayName}
        title="Your purchasing on AgriLink"
        actions={
          <Button asChild>
            <Link href="/marketplace">
              <Search /> Find produce
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Open offers" value={open.length} />
        <Stat label="Counter-offers to answer" value={yourTurn.length} />
        <Stat label="Orders in progress" value={activeOrders.length} />
        <Stat label="Saved listings" value={saved.length} />
      </div>

      <section aria-labelledby="your-turn" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="your-turn" className="text-xl font-extrabold">
            Open offers
          </h2>
          <Link href="/dashboard/offers" className="text-sm font-semibold text-forest hover:underline">
            All offers
          </Link>
        </div>
        {open.length ? (
          <ul className="flex flex-col gap-2.5">
            {[...yourTurn, ...open.filter((o) => o.status !== 'countered')].slice(0, 5).map((o) => (
              <OfferRow key={o.id} offer={o} viewer="buyer" />
            ))}
          </ul>
        ) : (
          <Card className="p-5 text-sm text-muted">
            You have no open offers.{' '}
            <Link href="/marketplace" className="font-semibold text-forest underline">
              Browse produce
            </Link>{' '}
            and make an offer on a listing.
          </Card>
        )}
      </section>

      <section aria-labelledby="buyer-orders" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="buyer-orders" className="text-xl font-extrabold">
            Orders in progress
          </h2>
          <Link href="/dashboard/orders" className="text-sm font-semibold text-forest hover:underline">
            All orders
          </Link>
        </div>
        {activeOrders.length ? (
          <ul className="flex flex-col gap-2.5">
            {activeOrders.slice(0, 5).map((o) => (
              <OrderRow key={o.id} order={o} viewer="buyer" />
            ))}
          </ul>
        ) : (
          <Card className="p-5 text-sm text-muted">Orders appear here when a farmer accepts your offer, or you accept their counter-offer.</Card>
        )}
      </section>

      {saved.length ? (
        <section aria-labelledby="saved-preview" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="saved-preview" className="text-xl font-extrabold">
              Saved listings
            </h2>
            <Link href="/dashboard/saved" className="text-sm font-semibold text-forest hover:underline">
              All saved
            </Link>
          </div>
          <SavedListingsProvider>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {saved.slice(0, 3).map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </SavedListingsProvider>
        </section>
      ) : null}
    </>
  );
}
