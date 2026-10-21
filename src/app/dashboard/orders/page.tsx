import { Package } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderRow } from '@/components/dashboard/rows';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { requireUser } from '@/server/auth';
import { listOrders } from '@/server/data/dashboard';

export const metadata: Metadata = { title: 'Orders' };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser('/dashboard/orders');
  const { tab = 'active' } = await searchParams;
  const all = await listOrders({ as: user.accountType, userId: user.id, limit: 200 });
  const tabs = [
    { key: 'active', label: 'In progress', items: all.filter((o) => !['completed', 'cancelled'].includes(o.status)) },
    { key: 'done', label: 'Completed', items: all.filter((o) => o.status === 'completed') },
    { key: 'cancelled', label: 'Cancelled', items: all.filter((o) => o.status === 'cancelled') },
  ];
  const active = tabs.find((t) => t.key === tab) ?? tabs[0];
  return (
    <>
      <PageHeader title="Orders" description="An order is created when an offer is accepted. No payment passes through AgriLink — settle payment directly." />
      <nav aria-label="Order filters" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/orders?tab=${t.key}`}
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
            <OrderRow key={o.id} order={o} viewer={user.accountType} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Package />} title="No orders here">
          {user.accountType === 'farmer' ? 'Orders appear when you accept an offer.' : 'Orders appear when a farmer accepts your offer, or you accept their counter-offer.'}
        </EmptyState>
      )}
    </>
  );
}
