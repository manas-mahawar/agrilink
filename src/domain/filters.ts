// Parses marketplace URL search params into validated filters. Anything malformed is dropped,
// so a hand-edited URL can never reach the database as an unexpected value.
import { CATEGORIES, LOCALITIES } from '@/content/reference';
import { AVAILABILITY_TYPES, type AvailabilityType } from '@/domain/listings';
import type { ListingFilters, ListingSort } from '@/server/data/types';

const SORTS: readonly ListingSort[] = ['relevance', 'newest', 'harvest', 'price_low', 'price_high', 'nearest'];
export type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
function int(v: string | undefined, min: number, max: number): number | undefined {
  if (!v || !/^\d{1,7}$/.test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
}

export function parseMarketplaceParams(raw: RawParams): ListingFilters {
  const q = one(raw.q)?.slice(0, 80);
  const category = one(raw.category);
  const locality = one(raw.locality);
  const availability = one(raw.availability) as AvailabilityType | undefined;
  const sort = one(raw.sort) as ListingSort | undefined;
  const minPrice = int(one(raw.minPrice), 0, 100_000); // rupees per kg
  const maxPrice = int(one(raw.maxPrice), 0, 100_000);
  return {
    q,
    category: CATEGORIES.some((c) => c.id === category) ? category : undefined,
    locality: LOCALITIES.some((l) => l.id === locality) ? locality : undefined,
    maxKm: int(one(raw.km), 1, 500),
    minPricePerKgPaise: minPrice !== undefined ? minPrice * 100 : undefined,
    maxPricePerKgPaise: maxPrice !== undefined ? maxPrice * 100 : undefined,
    minQtyKg: int(one(raw.minQty), 1, 10_000_000),
    harvestWithinDays: int(one(raw.harvest), 1, 365),
    verifiedOnly: one(raw.verified) === '1',
    availability: availability && (AVAILABILITY_TYPES as readonly string[]).includes(availability) ? availability : undefined,
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    page: int(one(raw.page), 1, 1000) ?? 1,
  };
}

/** Number of active filters (excluding search, sort and page) — shown on the mobile button. */
export function activeFilterCount(f: ListingFilters): number {
  return [f.category, f.locality, f.maxKm, f.minPricePerKgPaise, f.maxPricePerKgPaise, f.minQtyKg, f.harvestWithinDays, f.availability, f.verifiedOnly || undefined].filter(
    (v) => v !== undefined,
  ).length;
}

/** Builds a marketplace URL from the current params with overrides (undefined/'' removes a key). */
export function marketplaceHref(current: RawParams, overrides: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const val = one(v);
    if (val) sp.set(k, val);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === '') sp.delete(k);
    else sp.set(k, String(v));
  }
  if (sp.get('page') === '1') sp.delete('page');
  const s = sp.toString();
  return s ? `/marketplace?${s}` : '/marketplace';
}
