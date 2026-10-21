import { ListPlus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ListingStatusControls } from '@/components/dashboard/listing-status-controls';
import { Thumb } from '@/components/dashboard/rows';
import { ListingStatusBadge } from '@/components/dashboard/status-badges';
import { Button } from '@/components/ui/button';
import { EmptyState, Notice, PageHeader } from '@/components/ui/primitives';
import { type ListingStatus } from '@/domain/listings';
import { formatINR } from '@/domain/money';
import { formatQuantity, UNIT_LABEL } from '@/domain/units';
import { cn, formatDate } from '@/lib/utils';
import { requireFarmer } from '@/server/auth';
import { listOwnListings } from '@/server/data/dashboard';

export const metadata: Metadata = { title: 'My listings' };

const TABS: { key: string; label: string; statuses?: ListingStatus[] }[] = [
  { key: 'current', label: 'Current', statuses: ['active', 'paused', 'sold_out', 'draft'] },
  { key: 'archived', label: 'Archived', statuses: ['archived'] },
];

export default async function ListingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; deleted?: string }> }) {
  const user = await requireFarmer('/dashboard/listings');
  const { tab = 'current', deleted } = await searchParams;
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const listings = await listOwnListings(user.id, active.statuses);

  return (
    <>
      <PageHeader
        title="My listings"
        actions={
          <Button asChild>
            <Link href="/dashboard/listings/new">
              <ListPlus /> New listing
            </Link>
          </Button>
        }
      />
      {deleted ? <Notice tone="ok">Draft deleted.</Notice> : null}
      <nav aria-label="Listing filters" className="flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/listings?tab=${t.key}`}
            aria-current={t.key === active.key ? 'page' : undefined}
            className={cn('inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium', t.key === active.key ? 'border-forest bg-forest text-white' : 'border-line-strong bg-white')}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {listings.length ? (
        <ul className="flex flex-col gap-3">
          {listings.map((l) => (
            <li key={l.id} className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 md:flex-row md:items-center">
              <Link href={`/dashboard/listings/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3.5">
                <Thumb image={l.cover} className="size-16" />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="truncate hover:underline">{l.title}</strong>
                    <ListingStatusBadge status={l.status} hidden={l.hiddenByAdmin} />
                  </span>
                  <span className="tabular text-sm text-muted">
                    {formatINR(l.pricePerUnitPaise)}/{UNIT_LABEL[l.unit].singular} · {formatQuantity(l.quantityAvailable, l.unit)} available of {formatQuantity(l.quantityTotal, l.unit)}
                    {l.quantityReserved ? ` · ${formatQuantity(l.quantityReserved, l.unit)} reserved` : ''}
                  </span>
                  <span className="text-xs text-muted">
                    {l.expectedHarvestDate ? `Harvest ${formatDate(l.expectedHarvestDate)} · ` : ''}Updated {formatDate(l.updatedAt)}
                  </span>
                </div>
              </Link>
              {l.status !== 'archived' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <ListingStatusControls listingId={l.id} status={l.status} quantityAvailable={l.quantityAvailable} hiddenByAdmin={l.hiddenByAdmin} compact />
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/dashboard/listings/${l.id}`}>Edit</Link>
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={active.key === 'archived' ? 'No archived listings' : 'No listings yet'}
          action={
            active.key === 'archived' ? undefined : (
              <Button asChild>
                <Link href="/dashboard/listings/new">Create a listing</Link>
              </Button>
            )
          }
        >
          {active.key === 'archived' ? 'Listings you archive appear here.' : 'List a crop before harvest so buyers can start making offers.'}
        </EmptyState>
      )}
    </>
  );
}
