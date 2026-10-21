import { Badge } from '@/components/ui/primitives';
import { LISTING_STATUS_LABEL, type ListingStatus } from '@/domain/listings';
import { effectiveOfferStatus, OFFER_STATUS_LABEL, type OfferStatus } from '@/domain/offers';
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/domain/orders';

const OFFER_TONE: Record<OfferStatus, 'wait' | 'info' | 'ok' | 'neutral' | 'danger'> = {
  pending: 'wait',
  countered: 'info',
  accepted: 'ok',
  rejected: 'danger',
  withdrawn: 'neutral',
  expired: 'neutral',
};

export function OfferStatusBadge({ status, expiresAt, viewer }: { status: OfferStatus; expiresAt: string; viewer?: 'buyer' | 'farmer' }) {
  const s = effectiveOfferStatus({ status, expiresAt });
  let label = OFFER_STATUS_LABEL[s];
  if (viewer && s === 'pending') label = viewer === 'farmer' ? 'Needs your reply' : 'Waiting for farmer';
  if (viewer && s === 'countered') label = viewer === 'buyer' ? 'Countered — your turn' : 'Waiting for buyer';
  return <Badge tone={OFFER_TONE[s]}>{label}</Badge>;
}

const ORDER_TONE: Record<OrderStatus, 'wait' | 'info' | 'ok' | 'neutral' | 'danger'> = {
  awaiting_confirmation: 'wait',
  confirmed: 'info',
  preparing: 'info',
  ready: 'info',
  completed: 'ok',
  cancelled: 'neutral',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONE[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}

const LISTING_TONE: Record<ListingStatus, 'wait' | 'info' | 'ok' | 'neutral' | 'danger'> = {
  draft: 'neutral',
  active: 'ok',
  paused: 'wait',
  sold_out: 'info',
  archived: 'neutral',
};

export function ListingStatusBadge({ status, hidden }: { status: ListingStatus; hidden?: boolean }) {
  if (hidden) return <Badge tone="danger">Hidden by moderators</Badge>;
  return <Badge tone={LISTING_TONE[status]}>{LISTING_STATUS_LABEL[status]}</Badge>;
}
