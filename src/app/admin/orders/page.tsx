import type { Metadata } from 'next';
import { AdminAction } from '@/components/admin/admin-action';
import { OrderStatusBadge } from '@/components/dashboard/status-badges';
import { Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { formatINR } from '@/domain/money';
import type { OrderStatus } from '@/domain/orders';
import { formatQuantity, type Unit } from '@/domain/units';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { requireAdmin } from '@/server/auth';

export const metadata: Metadata = { title: 'Orders' };

type P = { display_name: string; organisation_name: string | null } | null;

export default async function AdminOrders() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, reference, status, unit, quantity, total_paise, created_at, fulfilment_date, is_demo, listing:listings(produce_name, variety), buyer:profiles!orders_buyer_id_fkey(display_name, organisation_name), farmer:profiles!orders_farmer_id_fkey(display_name, organisation_name)',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as (Record<string, unknown> & { listing: { produce_name: string; variety: string | null } | null; buyer: P; farmer: P })[];
  return (
    <>
      <PageHeader title="Orders" description="The latest 100 orders. Administrators can cancel an order (for example, after a dispute); both parties are notified." />
      {rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line bg-paper text-[13px] text-muted">
              <tr>
                <th className="p-3 font-semibold">Order</th>
                <th className="p-3 font-semibold">Farmer → Buyer</th>
                <th className="p-3 font-semibold">Quantity · value</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((o) => {
                const status = o.status as OrderStatus;
                return (
                  <tr key={String(o.id)} className="align-top">
                    <td className="p-3">
                      <p className="font-semibold">{String(o.reference)}</p>
                      <p className="text-muted">
                        {o.listing?.produce_name}
                        {o.listing?.variety ? ` · ${o.listing.variety}` : ''}
                      </p>
                      <p className="text-xs text-muted">{formatDate(String(o.created_at))}</p>
                      {o.is_demo ? <Badge tone="demo">Demo</Badge> : null}
                    </td>
                    <td className="p-3">
                      {o.farmer?.display_name} → {o.buyer?.organisation_name || o.buyer?.display_name}
                    </td>
                    <td className="tabular p-3">
                      {formatQuantity(Number(o.quantity), o.unit as Unit)} · {formatINR(Number(o.total_paise))}
                    </td>
                    <td className="p-3">
                      <OrderStatusBadge status={status} />
                    </td>
                    <td className="p-3 text-right">
                      {!['completed', 'cancelled'].includes(status) ? (
                        <AdminAction
                          kind="cancelOrder"
                          fields={{ orderId: String(o.id) }}
                          label="Cancel"
                          title={`Cancel order ${o.reference}?`}
                          description="Reserved quantity returns to the listing. Both parties see the reason."
                          textField={{ name: 'note', label: 'Reason' }}
                          textRequired
                          confirmLabel="Cancel order"
                          variant="danger"
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No orders yet" />
      )}
    </>
  );
}
