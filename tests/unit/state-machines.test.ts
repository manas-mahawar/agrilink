import { describe, expect, it } from 'vitest';
import { canOwnerMoveListing } from '@/domain/listings';
import { allowedOfferActions, effectiveOfferStatus, offerTurn } from '@/domain/offers';
import { allowedOrderActions, nextOrderStatus } from '@/domain/orders';

const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 1000).toISOString();

describe('offers', () => {
  it('alternates turns: pending waits for the farmer, countered for the buyer', () => {
    expect(offerTurn('pending')).toBe('farmer');
    expect(offerTurn('countered')).toBe('buyer');
    expect(offerTurn('accepted')).toBeNull();
  });
  it('only the party whose turn it is may accept, counter or decline', () => {
    const o = { status: 'pending' as const, expiresAt: future, counterCount: 0 };
    expect(allowedOfferActions(o, 'farmer')).toEqual(['accept', 'counter', 'reject']);
    expect(allowedOfferActions(o, 'buyer')).toEqual(['withdraw']);
    const c = { ...o, status: 'countered' as const };
    expect(allowedOfferActions(c, 'buyer')).toEqual(['accept', 'counter', 'reject', 'withdraw']);
    expect(allowedOfferActions(c, 'farmer')).toEqual([]);
  });
  it('stops countering after the limit', () => {
    expect(allowedOfferActions({ status: 'pending', expiresAt: future, counterCount: 10 }, 'farmer')).toEqual(['accept', 'reject']);
  });
  it('treats an open offer past its expiry as expired', () => {
    expect(effectiveOfferStatus({ status: 'pending', expiresAt: past })).toBe('expired');
    expect(allowedOfferActions({ status: 'pending', expiresAt: past, counterCount: 0 }, 'farmer')).toEqual([]);
  });
});

describe('orders', () => {
  it('follows the lifecycle with the right actor at each step', () => {
    expect(nextOrderStatus('awaiting_confirmation', 'confirm', 'farmer')).toBe('confirmed');
    expect(nextOrderStatus('awaiting_confirmation', 'confirm', 'buyer')).toBeNull();
    expect(nextOrderStatus('confirmed', 'start_preparing', 'farmer')).toBe('preparing');
    expect(nextOrderStatus('preparing', 'mark_ready', 'farmer')).toBe('ready');
    expect(nextOrderStatus('ready', 'complete', 'buyer')).toBe('completed');
    expect(nextOrderStatus('ready', 'complete', 'farmer')).toBeNull();
  });
  it('allows cancelling until ready (admins also when ready), never after completion', () => {
    expect(allowedOrderActions('preparing', 'buyer')).toContain('cancel');
    expect(allowedOrderActions('ready', 'buyer')).not.toContain('cancel');
    expect(allowedOrderActions('ready', 'admin')).toEqual(['cancel']);
    expect(allowedOrderActions('completed', 'admin')).toEqual([]);
    expect(allowedOrderActions('cancelled', 'farmer')).toEqual([]);
  });
});

describe('listing lifecycle (owner)', () => {
  it('permits only the documented moves', () => {
    expect(canOwnerMoveListing('draft', 'active', 10)).toBe(true);
    expect(canOwnerMoveListing('active', 'paused', 10)).toBe(true);
    expect(canOwnerMoveListing('active', 'sold_out', 10)).toBe(false);
    expect(canOwnerMoveListing('archived', 'active', 10)).toBe(false);
    expect(canOwnerMoveListing('sold_out', 'active', 0)).toBe(false);
    expect(canOwnerMoveListing('sold_out', 'active', 5)).toBe(true);
    expect(canOwnerMoveListing('paused', 'active', 5, true)).toBe(false);
  });
});
