// Offer state machine — mirrors supabase/migrations/20261021000500_offers_orders.sql.
// The database is authoritative; this module tells the UI which actions to offer.

export const OFFER_STATUSES = ['pending', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export type Party = 'buyer' | 'farmer';
export type OfferAction = 'accept' | 'counter' | 'reject' | 'withdraw';

export const OPEN_OFFER_STATUSES: readonly OfferStatus[] = ['pending', 'countered'];
export const MAX_COUNTERS = 10;
export const OFFER_LIFETIME_DAYS = 7;

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  pending: 'Pending',
  countered: 'Countered',
  accepted: 'Accepted',
  rejected: 'Declined',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
};

export interface OfferState {
  status: OfferStatus;
  expiresAt: string | Date;
  counterCount: number;
}

export function isOfferOpen(offer: Pick<OfferState, 'status' | 'expiresAt'>, now: Date = new Date()): boolean {
  return OPEN_OFFER_STATUSES.includes(offer.status) && new Date(offer.expiresAt).getTime() > now.getTime();
}

/** Whose move it is: pending waits for the farmer, countered waits for the buyer. */
export function offerTurn(status: OfferStatus): Party | null {
  if (status === 'pending') return 'farmer';
  if (status === 'countered') return 'buyer';
  return null;
}

/** Status shown to people: an open offer past its expiry reads as expired even before the job runs. */
export function effectiveOfferStatus(offer: Pick<OfferState, 'status' | 'expiresAt'>, now: Date = new Date()): OfferStatus {
  if (OPEN_OFFER_STATUSES.includes(offer.status) && new Date(offer.expiresAt).getTime() <= now.getTime()) return 'expired';
  return offer.status;
}

export function allowedOfferActions(offer: OfferState, party: Party, now: Date = new Date()): OfferAction[] {
  if (!isOfferOpen(offer, now)) return [];
  const actions: OfferAction[] = [];
  if (offerTurn(offer.status) === party) {
    actions.push('accept');
    if (offer.counterCount < MAX_COUNTERS) actions.push('counter');
    actions.push('reject');
  }
  if (party === 'buyer') actions.push('withdraw');
  return actions;
}

/** Status after a counteroffer by `party`. */
export function statusAfterCounter(party: Party): OfferStatus {
  return party === 'farmer' ? 'countered' : 'pending';
}
