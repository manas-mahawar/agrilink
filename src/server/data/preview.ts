import 'server-only';
// Read-only PREVIEW adapter, used only when no Supabase project is configured.
// It serves the illustrative demo catalogue with the same filtering and sorting rules as
// public.search_listings(), so the public site can be explored before setup. It has no
// write paths and no accounts.
import { DEMO_FARMERS, DEMO_LISTINGS, type DemoListing } from '@/content/demo-catalog';
import { PRODUCE } from '@/content/images';
import { categoryName, localityById } from '@/content/reference';
import { KG_PER_UNIT } from '@/domain/units';
import { listingTitle } from './mappers';
import type { FarmerPublic, ImageRef, ListingDetail, ListingFilters, ListingSummary, Page } from './types';

const DAY = 86_400_000;
const isoInDays = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

function bundled(key: DemoListing['images'][number]): ImageRef {
  const img = PRODUCE[key];
  return { url: img.src, thumbUrl: img.src, alt: img.alt, illustrative: true };
}

function farmerOf(l: DemoListing) {
  return DEMO_FARMERS.find((f) => f.key === l.farmerKey)!;
}

function toSummary(l: DemoListing): ListingSummary {
  const f = farmerOf(l);
  const loc = localityById(l.localityId)!;
  return {
    id: l.id,
    farmerId: f.id,
    farmerName: f.displayName,
    farmerVerified: f.verified,
    categoryId: l.categoryId,
    categoryName: categoryName(l.categoryId),
    localityId: l.localityId,
    localityName: loc.name,
    district: loc.district,
    kmFromPatiala: loc.kmFromPatiala,
    produceName: l.produceName,
    variety: l.variety,
    unit: l.unit,
    quantityTotal: l.quantityTotal,
    quantityAvailable: l.quantityTotal,
    minOrderQty: l.minOrderQty,
    maxOrderQty: l.maxOrderQty,
    pricePerUnitPaise: l.pricePerUnitPaise,
    pricePerKgPaise: Math.round(l.pricePerUnitPaise / KG_PER_UNIT[l.unit]),
    availabilityType: l.availabilityType,
    expectedHarvestDate: l.harvestInDays === null ? null : isoInDays(l.harvestInDays),
    qualityGrade: l.qualityGrade,
    status: 'active',
    isDemo: true,
    publishedAt: new Date(Date.now() - l.publishedDaysAgo * DAY).toISOString(),
    cover: bundled(l.images[0]),
  };
}

function farmerPublic(id: string): FarmerPublic | null {
  const f = DEMO_FARMERS.find((x) => x.id === id);
  if (!f) return null;
  return {
    id: f.id,
    displayName: f.displayName,
    district: f.district,
    village: f.village,
    bio: f.bio,
    avatarUrl: null,
    verifiedAt: f.verified ? new Date(Date.now() - 30 * DAY).toISOString() : null,
    memberSince: new Date(Date.now() - f.joinedDaysAgo * DAY).toISOString(),
    isDemo: true,
  };
}

export function previewSearch(f: ListingFilters): Page<ListingSummary> {
  const q = f.q?.trim().toLowerCase();
  let items = DEMO_LISTINGS.map(toSummary).filter((l) => {
    if (f.category && l.categoryId !== f.category) return false;
    if (f.locality && l.localityId !== f.locality) return false;
    if (f.maxKm !== undefined && l.kmFromPatiala > f.maxKm) return false;
    if (f.minPricePerKgPaise !== undefined && l.pricePerKgPaise < f.minPricePerKgPaise) return false;
    if (f.maxPricePerKgPaise !== undefined && l.pricePerKgPaise > f.maxPricePerKgPaise) return false;
    if (f.minQtyKg !== undefined && l.quantityAvailable * KG_PER_UNIT[l.unit] < f.minQtyKg) return false;
    if (f.harvestWithinDays !== undefined) {
      const days = l.expectedHarvestDate ? (new Date(l.expectedHarvestDate).getTime() - Date.now()) / DAY : 0;
      if (days > f.harvestWithinDays) return false;
    }
    if (f.verifiedOnly && !l.farmerVerified) return false;
    if (f.availability && l.availabilityType !== f.availability) return false;
    if (q) {
      const hay = `${l.produceName} ${l.variety ?? ''} ${l.localityName} ${l.farmerName} ${l.categoryName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const harvest = (l: ListingSummary) => (l.expectedHarvestDate ? new Date(l.expectedHarvestDate).getTime() : Date.now());
  const sorters: Record<string, (a: ListingSummary, b: ListingSummary) => number> = {
    price_low: (a, b) => a.pricePerKgPaise - b.pricePerKgPaise,
    price_high: (a, b) => b.pricePerKgPaise - a.pricePerKgPaise,
    harvest: (a, b) => harvest(a) - harvest(b),
    nearest: (a, b) => a.kmFromPatiala - b.kmFromPatiala,
  };
  const byNewest = (a: ListingSummary, b: ListingSummary) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
  items = items.sort((a, b) => (sorters[f.sort ?? '']?.(a, b) ?? 0) || byNewest(a, b));
  const pageSize = f.pageSize ?? 12;
  const page = Math.max(1, f.page ?? 1);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

export function previewListing(id: string): ListingDetail | null {
  const l = DEMO_LISTINGS.find((x) => x.id === id);
  if (!l) return null;
  const s = toSummary(l);
  const title = listingTitle(l.produceName, l.variety);
  return {
    ...s,
    description: l.description,
    qualityNotes: l.qualityNotes,
    availableUntil: l.availableForDays === null ? null : isoInDays((l.harvestInDays ?? 0) + l.availableForDays),
    hiddenByAdmin: false,
    images: l.images.map((k) => ({ ...bundled(k), alt: `${PRODUCE[k].alt} — illustrative photo for ${title}` })),
    farmer: farmerPublic(s.farmerId)!,
  };
}

export function previewFarmer(id: string) {
  const farmer = farmerPublic(id);
  if (!farmer) return null;
  const listings = DEMO_LISTINGS.filter((l) => farmerOf(l).id === id).map(toSummary);
  return { farmer, listings, stats: { completedOrders: 0, ratingCount: 0, ratingAverage: null, recentReviews: [] } };
}
