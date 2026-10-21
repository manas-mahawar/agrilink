import { Check, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrderActions, ReviewForm } from '@/components/dashboard/order-actions';
import { Thumb } from '@/components/dashboard/rows';
import { OrderStatusBadge } from '@/components/dashboard/status-badges';
import { ReportButton } from '@/components/marketplace/report-button';
import { Card, Notice, PageHeader } from '@/components/ui/primitives';
import { formatINR } from '@/domain/money';
import { FULFILMENT_LABEL, ORDER_PROGRESS, ORDER_STATUS_LABEL, orderProgressIndex, PAYMENT_STATUS_LABEL } from '@/domain/orders';
import { formatQuantity, UNIT_LABEL } from '@/domain/units';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { requireUser } from '@/server/auth';
import { getOrder, getOrderContacts } from '@/server/data/dashboard';

export const metadata: Metadata = { title: 'Order' };

const SHORT: Record<string, string> = { awaiting_confirmation: 'Accepted', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready', completed: 'Completed' };

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requireUser(`/dashboard/orders/${orderId}`);
  const order = await getOrder(orderId);
  if (!order) notFound();
  const party = order.buyerId === user.id ? 'buyer' : order.farmerId === user.id ? 'farmer' : null;
  if (!party) notFound();
  const showContacts = !['awaiting_confirmation', 'cancelled'].includes(order.status);
  const contacts = showContacts ? await getOrderContacts(order.id) : null;
  const other = contacts?.find((c) => c.party !== party);
  const step = orderProgressIndex(order.status);
  const unit = UNIT_LABEL[order.unit];

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/dashboard/orders" className="hover:underline">
            ← Orders
          </Link>
        }
        title={`Order ${order.reference}`}
        actions={<OrderStatusBadge status={order.status} />}
      />
      {order.isDemo ? <Notice tone="info">Demo order — sample data in the demo environment.</Notice> : null}

      {order.status !== 'cancelled' ? (
        <ol aria-label="Order progress" className="grid grid-cols-5 gap-1.5">
          {ORDER_PROGRESS.map((s, i) => (
            <li key={s} className="flex flex-col gap-1.5" aria-current={i === step ? 'step' : undefined}>
              <span className={cn('h-1.5 rounded-full', i <= step ? 'bg-forest' : 'bg-line')} />
              <span className={cn('flex items-center gap-1 text-xs sm:text-[13px]', i <= step ? 'font-semibold text-forest-deep' : 'text-muted')}>
                {i < step ? <Check className="size-3.5" aria-hidden="true" /> : null}
                {SHORT[s]}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Notice tone="warn" title={`Cancelled by the ${order.cancelledBy ?? 'system'}`}>
          {order.cancelReason}
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex items-center gap-3.5">
              <Thumb image={order.listingCover} className="size-16" />
              <div className="min-w-0">
                <p className="font-semibold">{order.listingTitle}</p>
                <p className="text-sm text-muted">
                  {party === 'farmer' ? `Buyer: ${order.buyerName}` : `Farmer: ${order.farmerName}`}
                  {order.localityName ? ` · ${order.localityName}` : ''}
                </p>
              </div>
            </div>
            <dl className="tabular grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-[13px] text-muted">Quantity</dt>
                <dd className="font-semibold">{formatQuantity(order.quantity, order.unit)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Agreed price</dt>
                <dd className="font-semibold">
                  {formatINR(order.pricePerUnitPaise)}/{unit.singular}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Order value</dt>
                <dd className="font-display text-2xl font-extrabold text-forest-deep">{formatINR(order.totalPaise)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Pickup or delivery</dt>
                <dd>{FULFILMENT_LABEL[order.fulfilmentMethod]}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Date</dt>
                <dd>{order.fulfilmentDate ? formatDate(order.fulfilmentDate) : 'Set when the farmer confirms'}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Payment</dt>
                <dd>{PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}</dd>
              </div>
            </dl>
            {order.farmerNote ? <p className="rounded-md bg-paper p-3 text-sm">Farmer’s note: {order.farmerNote}</p> : null}
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              {order.status === 'awaiting_confirmation' && party === 'buyer' ? <p className="text-sm text-muted">Waiting for the farmer to confirm a date.</p> : null}
              <OrderActions orderId={order.id} status={order.status} actor={party} />
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-5 sm:p-6">
            <h2 className="text-lg font-extrabold">Contact</h2>
            {other ? (
              <div className="flex flex-col gap-1 text-[15px]">
                <p className="font-semibold">{other.organisation_name || other.display_name}</p>
                {other.phone ? (
                  <a href={`tel:${other.phone.replace(/\s/g, '')}`} className="inline-flex min-h-10 items-center gap-2 font-semibold text-forest underline">
                    <Phone className="size-4" aria-hidden="true" /> {other.phone}
                  </a>
                ) : (
                  <p className="text-sm text-muted">No phone number on their profile.</p>
                )}
                {other.email ? (
                  <a href={`mailto:${other.email}`} className="text-sm text-forest underline">
                    {other.email}
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted">
                {order.status === 'cancelled' ? 'Contact details are not shared for cancelled orders.' : 'Phone numbers are shared with both sides once the farmer confirms the order.'}
              </p>
            )}
          </Card>

          {order.status === 'completed' && party === 'buyer' ? (
            <Card className="flex flex-col gap-3 p-5 sm:p-6">
              <h2 className="text-lg font-extrabold">Rating</h2>
              {order.review ? (
                <p className="text-sm">
                  You rated this order {order.review.rating} out of 5.{order.review.comment ? ` “${order.review.comment}”` : ''}
                </p>
              ) : (
                <ReviewForm orderId={order.id} farmerName={order.farmerName} />
              )}
            </Card>
          ) : null}
          {order.status === 'completed' && party === 'farmer' && order.review ? (
            <Card className="p-5 text-sm">
              The buyer rated this order {order.review.rating} out of 5.{order.review.comment ? ` “${order.review.comment}”` : ''}
            </Card>
          ) : null}
        </div>

        <section aria-labelledby="ohist" className="flex flex-col gap-3">
          <h2 id="ohist" className="text-lg font-extrabold">
            History
          </h2>
          <ol className="rounded-lg border border-line bg-white p-4">
            {(order.history ?? []).map((h, i, arr) => (
              <li key={i} className="grid grid-cols-[18px_1fr] gap-3">
                <span className="flex flex-col items-center">
                  <span className="mt-1.5 size-2.5 rounded-full bg-forest" />
                  {i < arr.length - 1 ? <span className="w-px flex-1 bg-line" /> : null}
                </span>
                <div className="pb-4 text-sm">
                  <p>
                    <strong>{ORDER_STATUS_LABEL[h.toStatus]}</strong>
                    <span className="text-muted"> · by {h.actorRole === party ? 'you' : h.actorRole === 'admin' ? 'AgriLink' : `the ${h.actorRole}`}</span>
                  </p>
                  {h.note ? <p className="mt-1 text-ink-soft">{h.note}</p> : null}
                  <p className="mt-0.5 text-xs text-muted">{formatDateTime(h.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
          <ReportButton userId={party === 'buyer' ? order.farmerId : order.buyerId} label={`Report a problem with the ${party === 'buyer' ? 'farmer' : 'buyer'}`} />
        </section>
      </div>
    </>
  );
}
