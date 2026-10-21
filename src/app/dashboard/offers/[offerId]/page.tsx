import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OfferActions } from '@/components/dashboard/offer-actions';
import { Thumb } from '@/components/dashboard/rows';
import { OfferStatusBadge } from '@/components/dashboard/status-badges';
import { Card, Notice, PageHeader } from '@/components/ui/primitives';
import { formatINR, percentDifference, totalPaise } from '@/domain/money';
import { effectiveOfferStatus, isOfferOpen, OFFER_STATUS_LABEL, offerTurn } from '@/domain/offers';
import { FULFILMENT_LABEL } from '@/domain/orders';
import { formatQuantity, UNIT_LABEL } from '@/domain/units';
import { formatDateTime } from '@/lib/utils';
import { requireUser } from '@/server/auth';
import { getOffer } from '@/server/data/dashboard';
import type { OfferEvent } from '@/server/data/types';

export const metadata: Metadata = { title: 'Offer' };

const EVENT_TEXT: Record<OfferEvent['event'], string> = {
  created: 'made an offer',
  countered: 'countered',
  accepted: 'accepted',
  rejected: 'declined',
  withdrawn: 'withdrew the offer',
  expired: 'Offer expired',
};

export default async function OfferPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const user = await requireUser(`/dashboard/offers/${offerId}`);
  const offer = await getOffer(offerId);
  if (!offer) notFound();
  const party = offer.buyerId === user.id ? 'buyer' : offer.farmerId === user.id ? 'farmer' : null;
  if (!party) notFound();
  const unit = UNIT_LABEL[offer.unit];
  const diff = offer.listingAskPaise ? percentDifference(offer.pricePerUnitPaise, offer.listingAskPaise) : null;
  const status = effectiveOfferStatus(offer);
  const open = isOfferOpen(offer);
  const waitingOnMe = open && offerTurn(offer.status) === party;
  const who = (role: string) => (role === party ? 'You' : role === 'buyer' ? offer.buyerName : role === 'farmer' ? offer.farmerName : role === 'admin' ? 'AgriLink' : 'System');

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/dashboard/offers" className="hover:underline">
            ← Offers
          </Link>
        }
        title={offer.listingTitle}
        actions={<OfferStatusBadge status={offer.status} expiresAt={offer.expiresAt} viewer={party} />}
      />
      {offer.isDemo ? <Notice tone="info">Demo offer — sample data in the demo environment.</Notice> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex items-center gap-3.5">
              <Thumb image={offer.listingCover} className="size-16" />
              <div className="min-w-0">
                <p className="text-sm text-muted">{party === 'farmer' ? `Offer from ${offer.buyerName}` : `Your offer to ${offer.farmerName}`}</p>
                <Link href={`/marketplace/${offer.listingId}`} className="font-semibold text-forest hover:underline">
                  View listing
                </Link>
              </div>
            </div>
            <dl className="tabular grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-[13px] text-muted">Current terms</dt>
                <dd className="text-lg font-bold">
                  {formatQuantity(offer.quantity, offer.unit)} × {formatINR(offer.pricePerUnitPaise)}/{unit.singular}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Total</dt>
                <dd className="font-display text-2xl font-extrabold text-forest-deep">{formatINR(totalPaise(offer.quantity, offer.pricePerUnitPaise))}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Against asking price</dt>
                <dd className="font-semibold">
                  {diff === null ? '—' : diff === 0 ? 'Same as asking' : `${Math.abs(diff).toFixed(1)}% ${diff < 0 ? 'below' : 'above'} ${formatINR(offer.listingAskPaise)}`}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Pickup or delivery</dt>
                <dd>{FULFILMENT_LABEL[offer.fulfilmentMethod]}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">{open ? 'Open until' : 'Status'}</dt>
                <dd>{open ? formatDateTime(offer.expiresAt) : OFFER_STATUS_LABEL[status]}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Counter-offers</dt>
                <dd>{offer.counterCount}</dd>
              </div>
            </dl>
            {open ? (
              <div className="flex flex-col gap-3 border-t border-line pt-4">
                <p className="text-sm font-semibold">{waitingOnMe ? 'Your move' : `Waiting for ${party === 'farmer' ? 'the buyer' : 'the farmer'} to respond`}</p>
                <OfferActions offer={offer} party={party} />
              </div>
            ) : offer.orderId ? (
              <div className="border-t border-line pt-4">
                <OfferActions offer={offer} party={party} />
              </div>
            ) : null}
          </Card>
        </div>
        <section aria-labelledby="history-h" className="flex flex-col gap-3">
          <h2 id="history-h" className="text-lg font-extrabold">
            History
          </h2>
          <ol className="flex flex-col gap-0 rounded-lg border border-line bg-white p-4">
            {(offer.events ?? []).map((e, i, arr) => (
              <li key={e.id} className="grid grid-cols-[18px_1fr] gap-3">
                <span className="flex flex-col items-center">
                  <span className="mt-1.5 size-2.5 rounded-full bg-forest" />
                  {i < arr.length - 1 ? <span className="w-px flex-1 bg-line" /> : null}
                </span>
                <div className="pb-4 text-sm">
                  <p>
                    <strong>{e.event === 'expired' ? '' : who(e.actorRole)}</strong> {EVENT_TEXT[e.event]}
                    {e.quantity !== null && e.pricePerUnitPaise !== null ? (
                      <span className="tabular">
                        {' '}
                        — {formatQuantity(e.quantity, offer.unit)} at {formatINR(e.pricePerUnitPaise)}/{unit.singular}
                      </span>
                    ) : null}
                  </p>
                  {e.message ? <p className="mt-1 rounded-md bg-paper p-2 text-ink-soft">“{e.message}”</p> : null}
                  {e.reason ? <p className="mt-1 text-muted">Reason: {e.reason}</p> : null}
                  <p className="mt-0.5 text-xs text-muted">{formatDateTime(e.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
