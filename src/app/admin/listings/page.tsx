import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminAction } from '@/components/admin/admin-action';
import { ListingStatusBadge } from '@/components/dashboard/status-badges';
import { Input } from '@/components/ui/form-controls';
import { Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import type { ListingStatus } from '@/domain/listings';
import { formatINR } from '@/domain/money';
import { formatQuantity, type Unit, UNIT_LABEL } from '@/domain/units';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { requireAdmin } from '@/server/auth';

export const metadata: Metadata = { title: 'Listings' };

export default async function AdminListings({ searchParams }: { searchParams: Promise<{ q?: string; hidden?: string }> }) {
  await requireAdmin();
  const { q = '', hidden } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from('listings')
    .select('id, produce_name, variety, unit, quantity_available, price_per_unit_paise, status, hidden_by_admin, hidden_reason, is_demo, created_at, farmer:profiles!listings_farmer_id_fkey(display_name)')
    .order('created_at', { ascending: false })
    .limit(100);
  const term = q.trim().slice(0, 60).replace(/[%_,()]/g, ' ');
  if (term) query = query.or(`produce_name.ilike.%${term}%,variety.ilike.%${term}%`);
  if (hidden === '1') query = query.eq('hidden_by_admin', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as (Record<string, unknown> & { farmer: { display_name: string } | null })[];

  return (
    <>
      <PageHeader title="Listings" description="All listings in every status. Hiding a listing removes it from the marketplace and closes its open offers." />
      <form className="flex flex-wrap gap-2" action="/admin/listings">
        <label htmlFor="al-q" className="sr-only">
          Search listings
        </label>
        <Input id="al-q" name="q" defaultValue={q} placeholder="Search by produce or variety" className="max-w-sm" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        <Link href={hidden === '1' ? '/admin/listings' : '/admin/listings?hidden=1'} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-forest underline">
          {hidden === '1' ? 'Show all' : 'Only hidden'}
        </Link>
      </form>
      {rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line bg-paper text-[13px] text-muted">
              <tr>
                <th className="p-3 font-semibold">Listing</th>
                <th className="p-3 font-semibold">Farmer</th>
                <th className="p-3 font-semibold">Price</th>
                <th className="p-3 font-semibold">Available</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Created</th>
                <th className="p-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const unit = r.unit as Unit;
                return (
                  <tr key={String(r.id)} className="align-top">
                    <td className="p-3">
                      <Link href={`/marketplace/${r.id}`} className="font-semibold text-forest hover:underline">
                        {String(r.produce_name)}
                        {r.variety ? ` · ${r.variety}` : ''}
                      </Link>
                      {r.is_demo ? <Badge tone="demo" className="ml-2">Demo</Badge> : null}
                      {r.hidden_reason ? <p className="mt-1 text-xs text-danger">Hidden: {String(r.hidden_reason)}</p> : null}
                    </td>
                    <td className="p-3">{r.farmer?.display_name}</td>
                    <td className="tabular p-3">
                      {formatINR(Number(r.price_per_unit_paise))}/{UNIT_LABEL[unit].singular}
                    </td>
                    <td className="tabular p-3">{formatQuantity(Number(r.quantity_available), unit)}</td>
                    <td className="p-3">
                      <ListingStatusBadge status={r.status as ListingStatus} hidden={Boolean(r.hidden_by_admin)} />
                    </td>
                    <td className="p-3 text-muted">{formatDate(String(r.created_at))}</td>
                    <td className="p-3 text-right">
                      {r.hidden_by_admin ? (
                        <AdminAction kind="hideListing" fields={{ listingId: String(r.id), hidden: 'false' }} label="Restore" title="Restore this listing?" description="The farmer can publish it again." confirmLabel="Restore" />
                      ) : (
                        <AdminAction
                          kind="hideListing"
                          fields={{ listingId: String(r.id), hidden: 'true' }}
                          label="Hide"
                          title="Hide this listing?"
                          description="It disappears from the marketplace and open offers on it are closed. The farmer is told the reason."
                          textField={{ name: 'reason', label: 'Reason shown to the farmer' }}
                          textRequired
                          confirmLabel="Hide listing"
                          variant="danger"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No listings found" />
      )}
    </>
  );
}
