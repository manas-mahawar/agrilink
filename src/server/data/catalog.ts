import 'server-only';
// Public catalogue reads. Uses an anonymous client (no cookies) so pages can be cached and
// they never show more than a logged-out visitor may see.
import { cache } from 'react';
import { isSupabaseConfigured, storagePublicUrl } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase/server';
import { KG_PER_UNIT } from '@/domain/units';
import { imageFromPath, listingTitle, mapListingRow, num, numOrNull } from './mappers';
import { previewFarmer, previewListing, previewSearch } from './preview';
import type { FarmerPublic, FarmerStats, ListingDetail, ListingFilters, ListingSummary, Page } from './types';

export const PAGE_SIZE = 12;

export async function searchListings(filters: ListingFilters): Promise<Page<ListingSummary>> {
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);
  if (!isSupabaseConfigured) return previewSearch({ ...filters, pageSize, page });
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc('search_listings', {
    p_query: filters.q ?? null,
    p_category: filters.category ?? null,
    p_locality: filters.locality ?? null,
    p_max_km: filters.maxKm ?? null,
    p_min_price_per_kg: filters.minPricePerKgPaise ?? null,
    p_max_price_per_kg: filters.maxPricePerKgPaise ?? null,
    p_min_qty_kg: filters.minQtyKg ?? null,
    p_harvest_within_days: filters.harvestWithinDays ?? null,
    p_verified_only: filters.verifiedOnly ?? false,
    p_availability: filters.availability ?? null,
    p_sort: filters.sort === 'newest' ? 'newest' : (filters.sort ?? (filters.q ? 'relevance' : 'newest')),
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(`search_listings failed: ${error.message}`);
  const rows = (data ?? []) as Record<string, unknown>[];
  return { items: rows.map(mapListingRow), total: rows.length ? num(rows[0].total_count) : 0, page, pageSize };
}

const LISTING_COLUMNS =
  'id, farmer_id, category_id, category_name, locality_id, locality_name, district, km_from_patiala, produce_name, variety, unit, quantity_total, quantity_available, min_order_qty, max_order_qty, price_per_unit_paise, price_per_kg_paise, availability_type, expected_harvest_date, available_until, quality_grade, status, hidden_by_admin, is_demo, published_at, farmer_name, farmer_verified_at, cover_path';

/** Public listing page data. Returns null when a visitor may not see it. */
export const getPublicListing = cache(async (id: string): Promise<ListingDetail | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (!isSupabaseConfigured) return previewListing(id);
  const supabase = createPublicClient();
  const { data: row, error } = await supabase.from('marketplace_listings').select(LISTING_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(`listing read failed: ${error.message}`);
  if (!row) return null;
  const [{ data: extra }, { data: images }, farmer] = await Promise.all([
    supabase.from('listings').select('description, quality_notes').eq('id', id).maybeSingle(),
    supabase.from('listing_images').select('id, storage_path, alt_text, position').eq('listing_id', id).order('position').order('created_at'),
    getPublicFarmer(String((row as Record<string, unknown>).farmer_id)),
  ]);
  if (!farmer) return null;
  const summary = mapListingRow(row as Record<string, unknown>);
  const title = listingTitle(summary.produceName, summary.variety);
  return {
    ...summary,
    description: (extra?.description as string | null) ?? null,
    qualityNotes: (extra?.quality_notes as string | null) ?? null,
    availableUntil: ((row as Record<string, unknown>).available_until as string | null) ?? null,
    hiddenByAdmin: Boolean((row as Record<string, unknown>).hidden_by_admin),
    images: (images ?? []).map((i, idx) => ({
      ...imageFromPath(String(i.storage_path), (i.alt_text as string | null) ?? `${title} — photo ${idx + 1} from the farmer`),
      id: String(i.id),
      path: String(i.storage_path),
    })),
    farmer,
  };
});

export const getPublicFarmer = cache(async (id: string): Promise<FarmerPublic | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (!isSupabaseConfigured) return previewFarmer(id)?.farmer ?? null;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, district, village, bio, avatar_path, verified_at, created_at, is_demo, account_type')
    .eq('id', id)
    .eq('account_type', 'farmer')
    .maybeSingle();
  if (error) throw new Error(`farmer read failed: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    displayName: data.display_name,
    district: data.district,
    village: data.village,
    bio: data.bio,
    avatarUrl: data.avatar_path ? storagePublicUrl('avatars', data.avatar_path) : null,
    verifiedAt: data.verified_at,
    memberSince: data.created_at,
    isDemo: data.is_demo,
  };
});

export async function getFarmerPage(id: string): Promise<{ farmer: FarmerPublic; listings: ListingSummary[]; stats: FarmerStats } | null> {
  if (!isSupabaseConfigured) return previewFarmer(id);
  const farmer = await getPublicFarmer(id);
  if (!farmer) return null;
  const supabase = createPublicClient();
  const [{ data: rows }, { data: stats }] = await Promise.all([
    supabase.from('marketplace_listings').select(LISTING_COLUMNS).eq('farmer_id', id).eq('status', 'active').eq('hidden_by_admin', false).order('published_at', { ascending: false }).limit(24),
    supabase.rpc('get_farmer_stats', { p_farmer_id: id }),
  ]);
  const s = (stats ?? {}) as Record<string, unknown>;
  return {
    farmer,
    listings: ((rows ?? []) as Record<string, unknown>[]).map(mapListingRow),
    stats: {
      completedOrders: num(s.completed_orders),
      ratingCount: num(s.rating_count),
      ratingAverage: numOrNull(s.rating_average),
      recentReviews: ((s.recent_reviews as { rating: number; comment: string | null; created_at: string }[]) ?? []).map((r) => ({
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
      })),
    },
  };
}

export async function getSimilarListings(listing: Pick<ListingSummary, 'id' | 'categoryId'>, limit = 3): Promise<ListingSummary[]> {
  const sameCategory = await searchListings({ category: listing.categoryId, sort: 'harvest', pageSize: limit + 1 });
  const items = sameCategory.items.filter((l) => l.id !== listing.id);
  if (items.length >= limit) return items.slice(0, limit);
  const others = await searchListings({ sort: 'harvest', pageSize: limit + 4 });
  for (const l of others.items) if (l.id !== listing.id && !items.some((x) => x.id === l.id)) items.push(l);
  return items.slice(0, limit);
}

export function quantityInKg(l: Pick<ListingSummary, 'quantityAvailable' | 'unit'>) {
  return l.quantityAvailable * KG_PER_UNIT[l.unit];
}
