import Link from 'next/link';
import { PageHeader, Stat } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/server/auth';

export default async function AdminHome() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_overview');
  if (error) throw new Error(error.message);
  const s = (data ?? {}) as Record<string, number>;
  return (
    <>
      <PageHeader title="Overview" description="Live counts from the database. Demo accounts are included when this is the demo project." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Farmers" value={s.farmers ?? 0} />
        <Stat label="Buyers" value={s.buyers ?? 0} />
        <Stat label="Suspended accounts" value={s.suspended ?? 0} />
        <Stat label="Live listings" value={s.active_listings ?? 0} />
        <Stat label="Hidden listings" value={s.hidden_listings ?? 0} />
        <Stat label="Open offers" value={s.open_offers ?? 0} />
        <Stat label="Orders in progress" value={s.open_orders ?? 0} />
        <Stat label="Completed orders" value={s.completed_orders ?? 0} />
        <Stat label="Reports to review" value={s.open_reports ?? 0} />
      </div>
      {s.open_reports ? (
        <p>
          <Link href="/admin/reports" className="font-semibold text-forest underline">
            Review {s.open_reports} open report{s.open_reports === 1 ? '' : 's'}
          </Link>
        </p>
      ) : null}
    </>
  );
}
