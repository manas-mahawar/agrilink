import 'server-only';
import { storagePublicUrl } from '@/lib/env';
import type { ImageRef, ListingSummary } from './types';

/** Thumbnails are stored next to the original: photo.webp -> photo-thumb.webp */
export function thumbPathFor(path: string): string {
  return path.replace(/(\.[a-z0-9]+)$/i, '-thumb$1');
}

export function imageFromPath(path: string, alt: string): ImageRef {
  return { url: storagePublicUrl('listing-images', path), thumbUrl: storagePublicUrl('listing-images', thumbPathFor(path)), alt };
}

export const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
export const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export function listingTitle(produceName: string, variety: string | null | undefined): string {
  return variety ? `${produceName} · ${variety}` : produceName;
}

/** Row from public.search_listings() or public.marketplace_listings. */
export function mapListingRow(r: Record<string, unknown>): ListingSummary {
  const produceName = String(r.produce_name);
  const variety = (r.variety as string | null) ?? null;
  return {
    id: String(r.id),
    farmerId: String(r.farmer_id),
    farmerName: String(r.farmer_name ?? ''),
    farmerVerified: Boolean(r.farmer_verified_at),
    categoryId: String(r.category_id),
    categoryName: String(r.category_name ?? ''),
    localityId: String(r.locality_id),
    localityName: String(r.locality_name ?? ''),
    district: String(r.district ?? ''),
    kmFromPatiala: num(r.km_from_patiala),
    produceName,
    variety,
    unit: r.unit as ListingSummary['unit'],
    quantityTotal: num(r.quantity_total),
    quantityAvailable: num(r.quantity_available),
    minOrderQty: num(r.min_order_qty),
    maxOrderQty: numOrNull(r.max_order_qty),
    pricePerUnitPaise: num(r.price_per_unit_paise),
    pricePerKgPaise: num(r.price_per_kg_paise),
    availabilityType: r.availability_type as ListingSummary['availabilityType'],
    expectedHarvestDate: (r.expected_harvest_date as string | null) ?? null,
    qualityGrade: r.quality_grade as ListingSummary['qualityGrade'],
    status: r.status as ListingSummary['status'],
    isDemo: Boolean(r.is_demo),
    publishedAt: (r.published_at as string | null) ?? null,
    cover: r.cover_path ? imageFromPath(String(r.cover_path), listingTitle(produceName, variety)) : null,
  };
}
