// Offer negotiation and order lifecycle, including concurrency and stale-offer protection.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ORDER_ACTIONS, ORDER_STATUSES, nextOrderStatus, type OrderActor } from '@/domain/orders';
import {
  anon,
  createListing,
  createUser,
  fails,
  listingRow,
  makeAdmin,
  offerRow,
  orderRow,
  owner,
  pool,
  q,
  resetData,
  rpc,
  service,
  user,
} from './helpers';

let farmer: string;
let buyer: string;
let buyer2: string;
let outsider: string;
let admin: string;

afterAll(async () => {
  await pool.end();
});
beforeEach(async () => {
  await resetData();
  farmer = await createUser({ accountType: 'farmer', name: 'Gurpreet Singh', phone: '+919876543210' });
  buyer = await createUser({ accountType: 'buyer', name: 'Harleen Sidhu', organisationName: 'Sidhu Veg Mart', phone: '9811122233' });
  buyer2 = await createUser({ accountType: 'buyer', name: 'Rohit Bansal', organisationName: 'Green Plate Kitchen' });
  outsider = await createUser({ accountType: 'buyer', name: 'Outsider' });
  admin = await createUser({ accountType: 'buyer', name: 'Admin' });
  await makeAdmin(admin);
});

const makeOffer = (who: string, listing: string, qty: number, price: number) =>
  rpc<string>(user(who), 'create_offer', { p_listing_id: listing, p_quantity: qty, p_price_per_unit_paise: price });

describe('creating offers', () => {
  it('validates who may offer and the terms', async () => {
    const listing = await createListing(farmer, { quantityTotal: 100, minOrderQty: 5, maxOrderQty: 60 });
    expect((await fails(makeOffer(farmer, listing, 10, 1000))).message).toBe('BUYERS_ONLY');
    expect((await fails(makeOffer(buyer, listing, 2, 1000))).message).toBe('QUANTITY_BELOW_MINIMUM');
    expect((await fails(makeOffer(buyer, listing, 61, 1000))).message).toBe('QUANTITY_ABOVE_MAXIMUM');
    expect((await fails(makeOffer(buyer, listing, 10.555, 1000))).message).toBe('INVALID_QUANTITY');
    expect((await fails(makeOffer(buyer, listing, 10, 0))).message).toBe('INVALID_PRICE');
    const e = await fails(makeOffer(buyer, listing, 2, 1000));
    expect(e.hint).toMatch(/minimum order for this listing is 5 quintal/);

    const draft = await createListing(farmer, { status: 'draft' });
    expect((await fails(makeOffer(buyer, draft, 10, 1000))).message).toBe('LISTING_UNAVAILABLE');
    await q(user(farmer), `update public.listings set status = 'paused' where id = $1`, [listing]);
    expect((await fails(makeOffer(buyer, listing, 10, 1000))).message).toBe('LISTING_UNAVAILABLE');
  });

  it('allows one open offer per buyer and listing, and records history and a notification', async () => {
    const listing = await createListing(farmer);
    const id = await makeOffer(buyer, listing, 20, 150000);
    expect((await fails(makeOffer(buyer, listing, 25, 150000))).message).toBe('OFFER_ALREADY_OPEN');
    await makeOffer(buyer2, listing, 20, 145000);
    const events = await q(user(buyer), 'select event from public.offer_events where offer_id = $1', [id]);
    expect(events.rows).toEqual([{ event: 'created' }]);
    const n = await q(user(farmer), 'select type, title, body, link_path from public.notifications order by created_at');
    expect(n.rows[0]).toMatchObject({ type: 'offer_received', link_path: `/dashboard/offers/${id}` });
    expect(n.rows[0].body).toContain('₹1,500 per quintal for 20 quintals');
  });

  it('is rate limited per buyer', async () => {
    const listing = await createListing(farmer);
    // 20 recent offers on other listings (inserted directly for speed)
    for (let i = 0; i < 20; i++) {
      const l = await createListing(farmer, { produceName: `Lot ${i}` });
      await q(owner, `insert into public.offers (listing_id, buyer_id, farmer_id, unit, quantity, price_per_unit_paise, expires_at, status)
                      values ($1, $2, $3, 'quintal', 10, 1000, now() + interval '7 days', 'withdrawn')`, [l, buyer, farmer]);
    }
    expect((await fails(makeOffer(buyer, listing, 10, 1000))).message).toBe('RATE_LIMITED');
  });
});

describe('negotiating', () => {
  it('enforces turns, versions and records each round', async () => {
    const listing = await createListing(farmer);
    const id = await makeOffer(buyer, listing, 20, 150000);
    let o = await offerRow(id);
    expect(o.status).toBe('pending');

    // The buyer cannot accept or counter their own pending offer.
    expect((await fails(rpc(user(buyer), 'accept_offer', { p_offer_id: id, p_expected_version: o.version }))).message).toBe('NOT_YOUR_TURN');
    // Strangers cannot see or act on it.
    expect((await fails(rpc(user(outsider), 'accept_offer', { p_offer_id: id, p_expected_version: o.version }))).message).toBe('OFFER_NOT_FOUND');
    expect((await q(user(outsider), 'select * from public.offers')).rowCount).toBe(0);
    expect((await q(user(outsider), 'select * from public.offer_events')).rowCount).toBe(0);

    await rpc(user(farmer), 'counter_offer', { p_offer_id: id, p_expected_version: o.version, p_quantity: 20, p_price_per_unit_paise: 157500 });
    o = await offerRow(id);
    expect(o.status).toBe('countered');
    expect(o.version).toBe(2);

    // A screen showing version 1 can no longer act.
    expect((await fails(rpc(user(buyer), 'accept_offer', { p_offer_id: id, p_expected_version: 1 }))).message).toBe('OFFER_STALE');
    expect((await fails(rpc(user(farmer), 'counter_offer', { p_offer_id: id, p_expected_version: 2, p_quantity: 20, p_price_per_unit_paise: 158000 }))).message).toBe('NOT_YOUR_TURN');
    expect((await fails(rpc(user(buyer), 'counter_offer', { p_offer_id: id, p_expected_version: 2, p_quantity: 20, p_price_per_unit_paise: 157500 }))).message).toBe('NO_CHANGE');

    await rpc(user(buyer), 'counter_offer', { p_offer_id: id, p_expected_version: 2, p_quantity: 25, p_price_per_unit_paise: 155000, p_message: 'Can take 25' });
    o = await offerRow(id);
    expect(o.status).toBe('pending');
    const history = await q(user(farmer), 'select event, actor_role, quantity, price_per_unit_paise from public.offer_events where offer_id = $1 order by id', [id]);
    expect(history.rows.map((r) => `${r.event}:${r.actor_role}`)).toEqual(['created:buyer', 'countered:farmer', 'countered:buyer']);
  });

  it('lets the waiting party decline and the buyer withdraw', async () => {
    const listing = await createListing(farmer);
    const a = await makeOffer(buyer, listing, 20, 150000);
    expect((await fails(rpc(user(buyer), 'reject_offer', { p_offer_id: a, p_expected_version: 1 }))).message).toBe('NOT_YOUR_TURN');
    await rpc(user(farmer), 'reject_offer', { p_offer_id: a, p_expected_version: 1, p_reason: 'Price too low' });
    expect((await offerRow(a)).status).toBe('rejected');
    expect((await fails(rpc(user(farmer), 'reject_offer', { p_offer_id: a, p_expected_version: 2 }))).message).toBe('OFFER_CLOSED');

    const b = await makeOffer(buyer2, listing, 20, 150000);
    expect((await fails(rpc(user(farmer), 'withdraw_offer', { p_offer_id: b, p_expected_version: 1 }))).message).toBe('BUYERS_ONLY');
    await rpc(user(buyer2), 'withdraw_offer', { p_offer_id: b, p_expected_version: 1 });
    expect((await offerRow(b)).status).toBe('withdrawn');
  });

  it('expires stale offers and lets the buyer start again', async () => {
    const listing = await createListing(farmer);
    const id = await makeOffer(buyer, listing, 20, 150000);
    await q(owner, `update public.offers set expires_at = now() - interval '1 minute' where id = $1`, [id]);
    expect((await fails(rpc(user(farmer), 'accept_offer', { p_offer_id: id, p_expected_version: 1 }))).message).toBe('OFFER_EXPIRED');
    expect((await fails(rpc(user(buyer), 'expire_stale_offers', {}))).code).toBe('42501');
    expect(await rpc(service, 'expire_stale_offers', {})).toBe(1);
    expect((await offerRow(id)).status).toBe('expired');
    await makeOffer(buyer, listing, 20, 150000); // a fresh offer is allowed
  });
});

describe('accepting and reserving quantity', () => {
  it('creates exactly one order, reserves quantity and notifies both sides', async () => {
    const listing = await createListing(farmer, { quantityTotal: 100, pricePaise: 160000 });
    const id = await makeOffer(buyer, listing, 12.5, 155050);
    const orderId = await rpc<string>(user(farmer), 'accept_offer', { p_offer_id: id, p_expected_version: 1 });
    const order = await orderRow(orderId);
    expect(order.status).toBe('awaiting_confirmation');
    expect(Number(order.total_paise)).toBe(1938125); // 12.5 × ₹1,550.50 = ₹19,381.25
    expect(String(order.reference)).toMatch(/^AGL-\d{4}-\d{5}$/);
    expect((await listingRow(listing)).quantity_reserved).toBe('12.50');
    expect((await fails(rpc(user(farmer), 'accept_offer', { p_offer_id: id, p_expected_version: 2 }))).message).toBe('OFFER_CLOSED');
    expect((await q(owner, 'select count(*)::int as n from public.orders where offer_id = $1', [id])).rows[0].n).toBe(1);
    const types = (await q(owner, 'select user_id, type from public.notifications order by created_at')).rows;
    expect(types).toEqual(expect.arrayContaining([
      { user_id: buyer, type: 'offer_accepted' },
      { user_id: farmer, type: 'order_created' },
    ]));
    // Only the two parties (and admins) can see the order.
    expect((await q(user(outsider), 'select * from public.orders')).rowCount).toBe(0);
    expect((await q(user(admin), 'select * from public.orders')).rowCount).toBe(1);
  });

  it('refuses to oversell and sells out cleanly', async () => {
    const listing = await createListing(farmer, { quantityTotal: 50, minOrderQty: 10 });
    const a = await makeOffer(buyer, listing, 30, 150000);
    const b = await makeOffer(buyer2, listing, 30, 150000);
    await rpc(user(farmer), 'accept_offer', { p_offer_id: a, p_expected_version: 1 });
    const e = await fails(rpc(user(farmer), 'accept_offer', { p_offer_id: b, p_expected_version: 1 }));
    expect(e.message).toBe('INSUFFICIENT_QUANTITY');
    expect(e.hint).toMatch(/Only 20 quintals left on this listing/);

    // A counter for the remaining 20 can be accepted; the listing then sells out and other offers close.
    const c = await makeOffer(outsider, listing, 10, 140000);
    await rpc(user(farmer), 'counter_offer', { p_offer_id: b, p_expected_version: 1, p_quantity: 20, p_price_per_unit_paise: 150000 });
    await rpc(user(buyer2), 'accept_offer', { p_offer_id: b, p_expected_version: 2 });
    const l = await listingRow(listing);
    expect(l.status).toBe('sold_out');
    expect(l.quantity_available).toBe('0.00');
    expect((await offerRow(c)).status).toBe('expired');
    expect((await q(user(outsider), `select type from public.notifications`)).rows).toEqual([{ type: 'offer_expired' }]);
  });

  it('serialises concurrent acceptances so only one can win the last quantity', async () => {
    const listing = await createListing(farmer, { quantityTotal: 100, minOrderQty: 10 });
    const a = await makeOffer(buyer, listing, 60, 150000);
    const b = await makeOffer(buyer2, listing, 60, 150000);
    const results = await Promise.allSettled([
      rpc(user(farmer), 'accept_offer', { p_offer_id: a, p_expected_version: 1 }),
      rpc(user(farmer), 'accept_offer', { p_offer_id: b, p_expected_version: 1 }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect(bad[0].reason.message).toBe('INSUFFICIENT_QUANTITY');
    expect((await listingRow(listing)).quantity_reserved).toBe('60.00');
  });

  it('closes open offers when the farmer archives the listing', async () => {
    const listing = await createListing(farmer);
    const id = await makeOffer(buyer, listing, 20, 150000);
    await q(user(farmer), `update public.listings set status = 'archived' where id = $1`, [listing]);
    expect((await offerRow(id)).status).toBe('expired');
    // The buyer can still open the listing because they negotiated on it.
    expect((await q(user(buyer), 'select id from public.listings where id = $1', [listing])).rowCount).toBe(1);
    expect((await q(anon, 'select id from public.listings where id = $1', [listing])).rowCount).toBe(0);
  });
});

describe('order lifecycle', () => {
  async function newOrder(qty = 20) {
    const listing = await createListing(farmer, { quantityTotal: 100 });
    const offer = await makeOffer(buyer, listing, qty, 150000);
    const orderId = await rpc<string>(user(farmer), 'accept_offer', { p_offer_id: offer, p_expected_version: 1 });
    return { listing, orderId };
  }
  const act = (who: string, orderId: string, action: string, extra: Record<string, unknown> = {}) =>
    rpc(user(who), 'transition_order', { p_order_id: orderId, p_action: action, ...extra });

  it('moves through confirm → preparing → ready → completed', async () => {
    const { listing, orderId } = await newOrder();
    expect((await fails(act(buyer, orderId, 'confirm', { p_fulfilment_date: '2099-01-01' }))).message).toBe('INVALID_TRANSITION');
    expect((await fails(act(farmer, orderId, 'confirm', { p_fulfilment_date: '2000-01-01' }))).message).toBe('INVALID_FULFILMENT_DATE');
    expect((await fails(act(farmer, orderId, 'confirm'))).message).toBe('INVALID_FULFILMENT_DATE');

    // Contact details are hidden until the farmer confirms.
    expect((await q(user(buyer), 'select * from public.get_order_contacts($1)', [orderId])).rowCount).toBe(0);
    const tomorrow = (await q(owner, `select ((now() at time zone 'Asia/Kolkata')::date + 1)::text as d`)).rows[0].d;
    expect(await act(farmer, orderId, 'confirm', { p_fulfilment_date: tomorrow, p_note: 'Gate 2, after 8 am' })).toBe('confirmed');
    const contacts = await q(user(buyer), 'select party, display_name, phone from public.get_order_contacts($1) order by party', [orderId]);
    expect(contacts.rows).toEqual(expect.arrayContaining([{ party: 'farmer', display_name: 'Gurpreet Singh', phone: '+919876543210' }]));
    expect((await q(user(outsider), 'select * from public.get_order_contacts($1)', [orderId])).rowCount).toBe(0);

    expect(await act(farmer, orderId, 'start_preparing')).toBe('preparing');
    expect((await fails(act(buyer, orderId, 'complete'))).message).toBe('INVALID_TRANSITION');
    expect(await act(farmer, orderId, 'mark_ready')).toBe('ready');
    expect((await fails(act(farmer, orderId, 'complete'))).message).toBe('INVALID_TRANSITION');
    expect((await fails(act(buyer, orderId, 'cancel', { p_note: 'changed mind' }))).message).toBe('INVALID_TRANSITION');
    expect(await act(buyer, orderId, 'complete')).toBe('completed');

    const l = await listingRow(listing);
    expect([l.quantity_reserved, l.quantity_sold]).toEqual(['0.00', '20.00']);
    const hist = await q(user(buyer), 'select from_status, to_status, actor_role from public.order_status_history where order_id = $1 order by id', [orderId]);
    expect(hist.rows.map((r) => `${r.from_status ?? '-'}>${r.to_status}`)).toEqual([
      '->awaiting_confirmation', 'awaiting_confirmation>confirmed', 'confirmed>preparing', 'preparing>ready', 'ready>completed',
    ]);
    expect((await fails(act(outsider, orderId, 'cancel', { p_note: 'nope' }))).message).toBe('ORDER_NOT_FOUND');
  });

  it('cancelling releases the reservation and reopens a sold-out listing', async () => {
    const listing = await createListing(farmer, { quantityTotal: 20, minOrderQty: 5 });
    const offer = await makeOffer(buyer, listing, 20, 150000);
    const orderId = await rpc<string>(user(farmer), 'accept_offer', { p_offer_id: offer, p_expected_version: 1 });
    expect((await listingRow(listing)).status).toBe('sold_out');
    expect((await fails(act(buyer, orderId, 'cancel'))).message).toBe('REASON_REQUIRED');
    expect(await act(buyer, orderId, 'cancel', { p_note: 'Shop closed for repairs' })).toBe('cancelled');
    const l = await listingRow(listing);
    expect(l.status).toBe('active');
    expect(l.quantity_reserved).toBe('0.00');
    const o = await orderRow(orderId);
    expect([o.cancelled_by, o.cancel_reason]).toEqual(['buyer', 'Shop closed for repairs']);
  });

  it('admins may cancel a ready order, and it is audited', async () => {
    const { orderId } = await newOrder();
    const d = (await q(owner, `select ((now() at time zone 'Asia/Kolkata')::date + 2)::text as d`)).rows[0].d;
    await act(farmer, orderId, 'confirm', { p_fulfilment_date: d });
    await act(farmer, orderId, 'start_preparing');
    await act(farmer, orderId, 'mark_ready');
    expect(await act(admin, orderId, 'cancel', { p_note: 'Dispute resolved by refund outside the platform' })).toBe('cancelled');
    expect((await q(user(admin), `select action from public.audit_events`)).rows).toEqual([{ action: 'order.cancel' }]);
  });

  it('buyers can rate a completed order once, and farmer stats reflect it', async () => {
    const { orderId } = await newOrder();
    expect((await fails(rpc(user(buyer), 'review_order', { p_order_id: orderId, p_rating: 5 }))).message).toBe('ORDER_NOT_COMPLETED');
    const d = (await q(owner, `select ((now() at time zone 'Asia/Kolkata')::date)::text as d`)).rows[0].d;
    await act(farmer, orderId, 'confirm', { p_fulfilment_date: d });
    await act(farmer, orderId, 'start_preparing');
    await act(farmer, orderId, 'mark_ready');
    await act(buyer, orderId, 'complete');
    expect((await fails(rpc(user(farmer), 'review_order', { p_order_id: orderId, p_rating: 5 }))).message).toBe('ORDER_NOT_FOUND');
    await rpc(user(buyer), 'review_order', { p_order_id: orderId, p_rating: 4, p_comment: 'Good quality, on time' });
    expect((await fails(rpc(user(buyer), 'review_order', { p_order_id: orderId, p_rating: 5 }))).message).toBe('ALREADY_REVIEWED');
    const stats = (await rpc<Record<string, unknown>>(anon, 'get_farmer_stats', { p_farmer_id: farmer })) as {
      completed_orders: number; rating_count: number; rating_average: number; recent_reviews: unknown[];
    };
    expect(stats.completed_orders).toBe(1);
    expect(stats.rating_count).toBe(1);
    expect(Number(stats.rating_average)).toBe(4);
    expect(stats.recent_reviews).toHaveLength(1);
  });
});

describe('TypeScript and SQL order state machines agree', () => {
  it('for every status × action × actor', async () => {
    const { orderId } = await (async () => {
      const listing = await createListing(farmer, { quantityTotal: 1000 });
      const offer = await makeOffer(buyer, listing, 10, 150000);
      return { orderId: await rpc<string>(user(farmer), 'accept_offer', { p_offer_id: offer, p_expected_version: 1 }) };
    })();
    const actors: Record<OrderActor, string> = { farmer, buyer, admin };
    const d = (await q(owner, `select ((now() at time zone 'Asia/Kolkata')::date + 1)::text as d`)).rows[0].d;
    const mismatches: string[] = [];
    for (const status of ORDER_STATUSES) {
      for (const action of ORDER_ACTIONS) {
        for (const actor of Object.keys(actors) as OrderActor[]) {
          await q(owner, 'update public.orders set status = $2 where id = $1', [orderId, status]);
          // keep the listing reservation large enough for repeated completes/cancels
          await q(owner, 'update public.listings set quantity_reserved = 500, quantity_sold = 0 where id = (select listing_id from public.orders where id = $1)', [orderId]);
          const expected = nextOrderStatus(status, action, actor);
          let actual: string | null = null;
          try {
            actual = await rpc<string>(user(actors[actor]), 'transition_order', {
              p_order_id: orderId, p_action: action, p_note: 'parity check', p_fulfilment_date: d,
            });
          } catch (e) {
            if ((e as { message: string }).message !== 'INVALID_TRANSITION') throw e;
          }
          if (actual !== expected) mismatches.push(`${status} ${action} by ${actor}: sql=${actual} ts=${expected}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});
