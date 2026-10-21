import { ListPlus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { OfferRow, OrderRow } from '@/components/dashboard/rows';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, Notice, PageHeader, Stat } from '@/components/ui/primitives';
import { isOfferOpen } from '@/domain/offers';
import { requireFarmer } from '@/server/auth';
import { listOffers, listOrders, listOwnListings } from '@/server/data/dashboard';

export const metadata: Metadata = { title: 'Farmer overview' };

export default async function FarmerHome({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const user = await requireFarmer('/dashboard/farmer');
  const { password } = await searchParams;
  const [listings, offers, orders] = await Promise.all([
    listOwnListings(user.id),
    listOffers({ as: 'farmer', userId: user.id, scope: 'open', limit: 50 }),
    listOrders({ as: 'farmer', userId: user.id, limit: 50 }),
  ]);
  const live = listings.filter((l) => l.status === 'active' && !l.hiddenByAdmin).length;
  const needsReply = offers.filter((o) => o.status === 'pending' && isOfferOpen(o));
  const activeOrders = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const toConfirm = activeOrders.filter((o) => o.status === 'awaiting_confirmation');
  const completed = orders.filter((o) => o.status === 'completed').length;

  return (
    <>
      {password === 'updated' ? <Notice tone="ok">Your password has been updated.</Notice> : null}
      <PageHeader
        eyebrow={`Namaste, ${user.displayName.split(' ')[0]}`}
        title="Your farm on AgriLink"
        actions={
          <Button asChild>
            <Link href="/dashboard/listings/new">
              <ListPlus /> New listing
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Live listings" value={live} />
        <Stat label="Offers needing your reply" value={needsReply.length} />
        <Stat label="Orders in progress" value={activeOrders.length} note={toConfirm.length ? `${toConfirm.length} to confirm` : undefined} />
        <Stat label="Completed orders" value={completed} />
      </div>

      {!user.verifiedAt ? (
        <Notice tone="info" title="Not yet verified">
          Your listings show without a verified badge until the AgriLink team has checked your identity and farm. You can list and sell in the meantime.
        </Notice>
      ) : null}

      <section aria-labelledby="needs-reply" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="needs-reply" className="text-xl font-extrabold">
            Offers needing your reply
          </h2>
          <Link href="/dashboard/offers" className="text-sm font-semibold text-forest hover:underline">
            All offers
          </Link>
        </div>
        {needsReply.length ? (
          <ul className="flex flex-col gap-2.5">
            {needsReply.slice(0, 5).map((o) => (
              <OfferRow key={o.id} offer={o} viewer="farmer" />
            ))}
          </ul>
        ) : (
          <Card className="p-5 text-sm text-muted">No offers are waiting for you right now.</Card>
        )}
      </section>

      <section aria-labelledby="active-orders" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="active-orders" className="text-xl font-extrabold">
            Orders in progress
          </h2>
          <Link href="/dashboard/orders" className="text-sm font-semibold text-forest hover:underline">
            All orders
          </Link>
        </div>
        {activeOrders.length ? (
          <ul className="flex flex-col gap-2.5">
            {activeOrders.slice(0, 5).map((o) => (
              <OrderRow key={o.id} order={o} viewer="farmer" />
            ))}
          </ul>
        ) : (
          <Card className="p-5 text-sm text-muted">Orders appear here when you accept an offer.</Card>
        )}
      </section>

      {!listings.length ? (
        <EmptyState
          title="List your first crop"
          action={
            <Button asChild>
              <Link href="/dashboard/listings/new">Create a listing</Link>
            </Button>
          }
        >
          Add the crop, expected quantity, harvest date and asking price. Buyers around Patiala can then make offers.
        </EmptyState>
      ) : null}
    </>
  );
}
