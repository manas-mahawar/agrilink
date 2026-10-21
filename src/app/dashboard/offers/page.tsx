import { Handshake } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { OfferRow } from '@/components/dashboard/rows';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { isOfferOpen } from '@/domain/offers';
import { cn } from '@/lib/utils';
import { requireUser } from '@/server/auth';
import { listOffers } from '@/server/data/dashboard';

export const metadata: Metadata = { title: 'Offers' };

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser('/dashboard/offers');
  const { tab = 'open' } = await searchParams;
  const as = user.accountType;
  const all = await listOffers({ as, userId: user.id, scope: 'all', limit: 200 });
  const open = all.filter((o) => isOfferOpen(o));
  const yourTurn = open.filter((o) => (as === 'farmer' ? o.status === 'pending' : o.status === 'countered'));
  const closed = all.filter((o) => !isOfferOpen(o));
  const tabs = [
    { key: 'open', label: 'Open', items: [...yourTurn, ...open.filter((o) => !yourTurn.includes(o))] },
    { key: 'closed', label: 'Closed', items: closed },
  ];
  const active = tabs.find((t) => t.key === tab) ?? tabs[0];

  return (
    <>
      <PageHeader
        title={as === 'farmer' ? 'Offers on your listings' : 'Your offers'}
        description={as === 'farmer' ? 'Accept, decline or counter. Offers close automatically after 7 days.' : 'Track offers you have made. Farmers may accept, decline or counter.'}
      />
      <nav aria-label="Offer filters" className="flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/offers?tab=${t.key}`}
            aria-current={t.key === active.key ? 'page' : undefined}
            className={cn('inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium', t.key === active.key ? 'border-forest bg-forest text-white' : 'border-line-strong bg-white')}
          >
            {t.label} <span className="tabular opacity-80">({t.items.length})</span>
          </Link>
        ))}
      </nav>
      {active.items.length ? (
        <ul className="flex flex-col gap-2.5">
          {active.items.map((o) => (
            <OfferRow key={o.id} offer={o} viewer={as} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Handshake />}
          title={active.key === 'open' ? 'No open offers' : 'No closed offers yet'}
          action={
            as === 'buyer' && active.key === 'open' ? (
              <Button asChild>
                <Link href="/marketplace">Explore produce</Link>
              </Button>
            ) : undefined
          }
        >
          {as === 'farmer' ? 'Offers from buyers on your listings appear here.' : 'Make an offer from any listing page.'}
        </EmptyState>
      )}
    </>
  );
}
