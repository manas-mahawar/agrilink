import Image from 'next/image';
import Link from 'next/link';
import { formatINR } from '@/domain/money';
import { formatQuantity, UNIT_LABEL } from '@/domain/units';
import { formatDate } from '@/lib/utils';
import type { ImageRef, OfferView, OrderView } from '@/server/data/types';
import { OfferStatusBadge, OrderStatusBadge } from './status-badges';

export function Thumb({ image, className = 'size-14' }: { image: ImageRef | null; className?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-md bg-sage ${className}`} aria-hidden="true">
      {image ? <Image src={image.thumbUrl} alt="" fill sizes="64px" unoptimized={!image.illustrative} className="object-cover" /> : null}
    </span>
  );
}

export function OfferRow({ offer, viewer }: { offer: OfferView; viewer: 'buyer' | 'farmer' }) {
  const other = viewer === 'farmer' ? offer.buyerName : offer.farmerName;
  return (
    <li>
      <Link href={`/dashboard/offers/${offer.id}`} className="flex items-center gap-3.5 rounded-lg border border-line bg-white p-3.5 hover:border-forest/40 hover:shadow-card">
        <Thumb image={offer.listingCover} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold">{offer.listingTitle}</span>
          <span className="tabular truncate text-sm text-muted">
            {formatQuantity(offer.quantity, offer.unit)} at {formatINR(offer.pricePerUnitPaise)}/{UNIT_LABEL[offer.unit].singular} · {viewer === 'farmer' ? 'from' : 'with'} {other}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <OfferStatusBadge status={offer.status} expiresAt={offer.expiresAt} viewer={viewer} />
          <span className="text-xs text-muted">{formatDate(offer.updatedAt)}</span>
        </div>
      </Link>
    </li>
  );
}

export function OrderRow({ order, viewer }: { order: OrderView; viewer: 'buyer' | 'farmer' }) {
  return (
    <li>
      <Link href={`/dashboard/orders/${order.id}`} className="flex items-center gap-3.5 rounded-lg border border-line bg-white p-3.5 hover:border-forest/40 hover:shadow-card">
        <Thumb image={order.listingCover} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold">
            {order.listingTitle} <span className="font-normal text-muted">· {order.reference}</span>
          </span>
          <span className="tabular truncate text-sm text-muted">
            {formatQuantity(order.quantity, order.unit)} · {formatINR(order.totalPaise)} · {viewer === 'farmer' ? order.buyerName : order.farmerName}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <OrderStatusBadge status={order.status} />
          <span className="text-xs text-muted">{order.fulfilmentDate ? `Due ${formatDate(order.fulfilmentDate)}` : formatDate(order.createdAt)}</span>
        </div>
      </Link>
    </li>
  );
}
