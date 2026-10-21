import 'server-only';
// Reads for signed-in areas. Every query uses the caller's session, so Row Level Security
// decides what comes back; nothing here widens access.
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { ListingStatus } from '@/domain/listings';
import { OPEN_OFFER_STATUSES } from '@/domain/offers';
import { imageFromPath, listingTitle, mapListingRow, num, numOrNull } from './mappers';
import type { ImageRef, ListingSummary, NotificationView, OfferEvent, OfferView, OrderView } from './types';

type Row = Record<string, unknown>;

const LISTING_EMBED = 'listing:listings(id, produce_name, variety, price_per_unit_paise, locality_id, images:listing_images(storage_path, position))';

function coverOf(listing: Row | null | undefined): ImageRef | null {
  const imgs = ((listing?.images as Row[] | undefined) ?? []).slice().sort((a, b) => num(a.position) - num(b.position));
  if (!imgs.length || !listing) return null;
  return imageFromPath(String(imgs[0].storage_path), listingTitle(String(listing.produce_name), listing.variety as string | null));
}

function partyName(p: Row | null | undefined): string {
  if (!p) return 'AgriLink user';
  return (p.organisation_name as string | null) || String(p.display_name ?? 'AgriLink user');
}

const OFFER_SELECT = `id, listing_id, buyer_id, farmer_id, status, unit, quantity, price_per_unit_paise, fulfilment_method, message, version,
  counter_count, last_actor, expires_at, created_at, updated_at, is_demo,
  ${LISTING_EMBED},
  buyer:profiles!offers_buyer_id_fkey(display_name, organisation_name),
  farmer:profiles!offers_farmer_id_fkey(display_name, organisation_name),
  order:orders(id)`;

function mapOffer(r: Row): OfferView {
  const listing = r.listing as Row | null;
  const order = r.order as Row | Row[] | null;
  const orderId = Array.isArray(order) ? (order[0]?.id as string | undefined) : (order?.id as string | undefined);
  return {
    id: String(r.id),
    listingId: String(r.listing_id),
    listingTitle: listing ? listingTitle(String(listing.produce_name), listing.variety as string | null) : 'Listing no longer available',
    listingCover: coverOf(listing),
    listingAskPaise: num(listing?.price_per_unit_paise),
    buyerId: String(r.buyer_id),
    buyerName: partyName(r.buyer as Row),
    farmerId: String(r.farmer_id),
    farmerName: String((r.farmer as Row | null)?.display_name ?? 'Farmer'),
    status: r.status as OfferView['status'],
    unit: r.unit as OfferView['unit'],
    quantity: num(r.quantity),
    pricePerUnitPaise: num(r.price_per_unit_paise),
    fulfilmentMethod: r.fulfilment_method as OfferView['fulfilmentMethod'],
    message: (r.message as string | null) ?? null,
    version: num(r.version),
    counterCount: num(r.counter_count),
    lastActor: r.last_actor as OfferView['lastActor'],
    expiresAt: String(r.expires_at),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    isDemo: Boolean(r.is_demo),
    orderId: orderId ?? null,
  };
}

export async function listOffers(opts: { as: 'buyer' | 'farmer'; userId: string; scope?: 'open' | 'closed' | 'all'; limit?: number }): Promise<OfferView[]> {
  const supabase = await createClient();
  let q = supabase
    .from('offers')
    .select(OFFER_SELECT)
    .eq(opts.as === 'buyer' ? 'buyer_id' : 'farmer_id', opts.userId)
    .order('updated_at', { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.scope === 'open') q = q.in('status', OPEN_OFFER_STATUSES as string[]);
  if (opts.scope === 'closed') q = q.not('status', 'in', `(${OPEN_OFFER_STATUSES.join(',')})`);
  const { data, error } = await q;
  if (error) throw new Error(`offers read failed: ${error.message}`);
  return (data as Row[]).map(mapOffer);
}

export const getOffer = cache(async (id: string): Promise<OfferView | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('offers').select(OFFER_SELECT).eq('id', id).maybeSingle();
  if (error) throw new Error(`offer read failed: ${error.message}`);
  if (!data) return null;
  const offer = mapOffer(data as Row);
  const { data: events } = await supabase
    .from('offer_events')
    .select('id, actor_role, event, quantity, price_per_unit_paise, message, reason, created_at')
    .eq('offer_id', id)
    .order('id');
  offer.events = ((events ?? []) as Row[]).map(
    (e): OfferEvent => ({
      id: num(e.id),
      actorRole: e.actor_role as OfferEvent['actorRole'],
      event: e.event as OfferEvent['event'],
      quantity: numOrNull(e.quantity),
      pricePerUnitPaise: numOrNull(e.price_per_unit_paise),
      message: (e.message as string | null) ?? null,
      reason: (e.reason as string | null) ?? null,
      createdAt: String(e.created_at),
    }),
  );
  return offer;
});

const ORDER_SELECT = `id, reference, offer_id, listing_id, buyer_id, farmer_id, status, unit, quantity, price_per_unit_paise, total_paise,
  fulfilment_method, fulfilment_date, farmer_note, cancel_reason, cancelled_by, payment_status, created_at, confirmed_at, completed_at, is_demo,
  ${LISTING_EMBED},
  buyer:profiles!orders_buyer_id_fkey(display_name, organisation_name),
  farmer:profiles!orders_farmer_id_fkey(display_name, organisation_name)`;

function mapOrder(r: Row, localityName = ''): OrderView {
  const listing = r.listing as Row | null;
  return {
    id: String(r.id),
    reference: String(r.reference),
    offerId: String(r.offer_id),
    listingId: String(r.listing_id),
    listingTitle: listing ? listingTitle(String(listing.produce_name), listing.variety as string | null) : 'Listing',
    listingCover: coverOf(listing),
    localityName,
    buyerId: String(r.buyer_id),
    buyerName: partyName(r.buyer as Row),
    farmerId: String(r.farmer_id),
    farmerName: String((r.farmer as Row | null)?.display_name ?? 'Farmer'),
    status: r.status as OrderView['status'],
    unit: r.unit as OrderView['unit'],
    quantity: num(r.quantity),
    pricePerUnitPaise: num(r.price_per_unit_paise),
    totalPaise: num(r.total_paise),
    fulfilmentMethod: r.fulfilment_method as OrderView['fulfilmentMethod'],
    fulfilmentDate: (r.fulfilment_date as string | null) ?? null,
    farmerNote: (r.farmer_note as string | null) ?? null,
    cancelReason: (r.cancel_reason as string | null) ?? null,
    cancelledBy: (r.cancelled_by as string | null) ?? null,
    paymentStatus: String(r.payment_status),
    createdAt: String(r.created_at),
    confirmedAt: (r.confirmed_at as string | null) ?? null,
    completedAt: (r.completed_at as string | null) ?? null,
    isDemo: Boolean(r.is_demo),
  };
}

export async function listOrders(opts: { as: 'buyer' | 'farmer'; userId: string; active?: boolean; limit?: number }): Promise<OrderView[]> {
  const supabase = await createClient();
  let q = supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq(opts.as === 'buyer' ? 'buyer_id' : 'farmer_id', opts.userId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.active) q = q.not('status', 'in', '(completed,cancelled)');
  const { data, error } = await q;
  if (error) throw new Error(`orders read failed: ${error.message}`);
  return (data as Row[]).map((r) => mapOrder(r));
}

export const getOrder = cache(async (id: string): Promise<OrderView | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle();
  if (error) throw new Error(`order read failed: ${error.message}`);
  if (!data) return null;
  const [{ data: history }, { data: review }, { data: loc }] = await Promise.all([
    supabase.from('order_status_history').select('from_status, to_status, actor_role, note, created_at').eq('order_id', id).order('id'),
    supabase.from('order_reviews').select('rating, comment').eq('order_id', id).maybeSingle(),
    supabase.from('localities').select('name').eq('id', String(((data as unknown as Row).listing as Row | null)?.locality_id ?? '')).maybeSingle(),
  ]);
  const order = mapOrder(data as Row, (loc?.name as string | undefined) ?? '');
  order.history = ((history ?? []) as Row[]).map((h) => ({
    fromStatus: (h.from_status as OrderView['status'] | null) ?? null,
    toStatus: h.to_status as OrderView['status'],
    actorRole: String(h.actor_role),
    note: (h.note as string | null) ?? null,
    createdAt: String(h.created_at),
  }));
  order.review = review ? { rating: num(review.rating), comment: (review.comment as string | null) ?? null } : null;
  return order;
});

export async function getOrderContacts(orderId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_order_contacts', { p_order_id: orderId });
  if (error) return null;
  return (data ?? []) as { party: 'buyer' | 'farmer'; display_name: string; organisation_name: string | null; phone: string | null; email: string | null }[];
}

/** The farmer's own listings, any status. */
export async function listOwnListings(farmerId: string, statuses?: ListingStatus[]) {
  const supabase = await createClient();
  let q = supabase
    .from('listings')
    .select(
      'id, produce_name, variety, unit, quantity_total, quantity_reserved, quantity_sold, quantity_available, price_per_unit_paise, status, hidden_by_admin, hidden_reason, expected_harvest_date, availability_type, created_at, updated_at, images:listing_images(storage_path, position)',
    )
    .eq('farmer_id', farmerId)
    .order('updated_at', { ascending: false });
  if (statuses?.length) q = q.in('status', statuses);
  const { data, error } = await q;
  if (error) throw new Error(`listings read failed: ${error.message}`);
  return (data as Row[]).map((r) => ({
    id: String(r.id),
    title: listingTitle(String(r.produce_name), r.variety as string | null),
    unit: r.unit as ListingSummary['unit'],
    quantityTotal: num(r.quantity_total),
    quantityReserved: num(r.quantity_reserved),
    quantitySold: num(r.quantity_sold),
    quantityAvailable: num(r.quantity_available),
    pricePerUnitPaise: num(r.price_per_unit_paise),
    status: r.status as ListingStatus,
    hiddenByAdmin: Boolean(r.hidden_by_admin),
    hiddenReason: (r.hidden_reason as string | null) ?? null,
    expectedHarvestDate: (r.expected_harvest_date as string | null) ?? null,
    updatedAt: String(r.updated_at),
    cover: coverOf({ ...r, images: r.images }),
  }));
}
export type OwnListing = Awaited<ReturnType<typeof listOwnListings>>[number];

/** A listing the farmer owns, with everything the edit form needs. */
export async function getOwnListing(farmerId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('listings').select('*, images:listing_images(id, storage_path, position, alt_text)').eq('id', id).eq('farmer_id', farmerId).maybeSingle();
  if (error) throw new Error(`listing read failed: ${error.message}`);
  if (!data) return null;
  const r = data as Row;
  const title = listingTitle(String(r.produce_name), r.variety as string | null);
  return {
    id: String(r.id),
    title,
    categoryId: String(r.category_id),
    localityId: String(r.locality_id),
    produceName: String(r.produce_name),
    variety: (r.variety as string | null) ?? '',
    description: (r.description as string | null) ?? '',
    unit: r.unit as ListingSummary['unit'],
    quantityTotal: num(r.quantity_total),
    quantityReserved: num(r.quantity_reserved),
    quantitySold: num(r.quantity_sold),
    quantityAvailable: num(r.quantity_available),
    minOrderQty: num(r.min_order_qty),
    maxOrderQty: numOrNull(r.max_order_qty),
    pricePerUnitPaise: num(r.price_per_unit_paise),
    availabilityType: r.availability_type as ListingSummary['availabilityType'],
    expectedHarvestDate: (r.expected_harvest_date as string | null) ?? '',
    availableUntil: (r.available_until as string | null) ?? '',
    qualityGrade: r.quality_grade as ListingSummary['qualityGrade'],
    qualityNotes: (r.quality_notes as string | null) ?? '',
    status: r.status as ListingStatus,
    hiddenByAdmin: Boolean(r.hidden_by_admin),
    hiddenReason: (r.hidden_reason as string | null) ?? null,
    isDemo: Boolean(r.is_demo),
    images: ((r.images as Row[]) ?? [])
      .slice()
      .sort((a, b) => num(a.position) - num(b.position))
      .map((i) => ({ id: String(i.id), path: String(i.storage_path), position: num(i.position), ...imageFromPath(String(i.storage_path), (i.alt_text as string | null) ?? title) })),
  };
}
export type OwnListingDetail = NonNullable<Awaited<ReturnType<typeof getOwnListing>>>;

export async function listSavedListings(): Promise<ListingSummary[]> {
  const supabase = await createClient();
  const { data: favs } = await supabase.from('favorites').select('listing_id, created_at').order('created_at', { ascending: false }).limit(100);
  const ids = ((favs ?? []) as Row[]).map((f) => String(f.listing_id));
  if (!ids.length) return [];
  const { data } = await supabase
    .from('marketplace_listings')
    .select(
      'id, farmer_id, category_id, category_name, locality_id, locality_name, district, km_from_patiala, produce_name, variety, unit, quantity_total, quantity_available, min_order_qty, max_order_qty, price_per_unit_paise, price_per_kg_paise, availability_type, expected_harvest_date, quality_grade, status, is_demo, published_at, farmer_name, farmer_verified_at, cover_path',
    )
    .in('id', ids);
  const byId = new Map(((data ?? []) as Row[]).map((r) => [String(r.id), mapListingRow(r)]));
  return ids.map((id) => byId.get(id)).filter((l): l is ListingSummary => Boolean(l));
}

export async function listNotifications(limit = 50): Promise<NotificationView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, link_path, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`notifications read failed: ${error.message}`);
  return ((data ?? []) as Row[]).map((n) => ({
    id: String(n.id),
    type: String(n.type),
    title: String(n.title),
    body: (n.body as string | null) ?? null,
    linkPath: (n.link_path as string | null) ?? null,
    readAt: (n.read_at as string | null) ?? null,
    createdAt: String(n.created_at),
  }));
}

export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  return count ?? 0;
}

export async function getOwnProfile(userId: string) {
  const supabase = await createClient();
  const [{ data: profile }, { data: contact }] = await Promise.all([
    supabase.from('profiles').select('display_name, organisation_name, buyer_type, district, state, village, bio, account_type, verified_at, created_at').eq('id', userId).maybeSingle(),
    supabase.from('profile_contacts').select('phone').eq('user_id', userId).maybeSingle(),
  ]);
  if (!profile) return null;
  return { ...(profile as Row), phone: (contact?.phone as string | null) ?? null } as {
    display_name: string;
    organisation_name: string | null;
    buyer_type: string | null;
    district: string | null;
    state: string | null;
    village: string | null;
    bio: string | null;
    account_type: 'farmer' | 'buyer';
    verified_at: string | null;
    created_at: string;
    phone: string | null;
  };
}
