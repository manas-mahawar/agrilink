// Shapes the UI works with. The data layer maps database rows (snake_case) to these.
import type { AvailabilityType, ListingStatus, QualityGrade } from '@/domain/listings';
import type { FulfilmentMethod, OrderStatus } from '@/domain/orders';
import type { OfferStatus } from '@/domain/offers';
import type { Unit } from '@/domain/units';

export interface ImageRef {
  url: string;
  thumbUrl: string;
  alt: string;
  /** Bundled illustrative photo (demo/preview) rather than a farmer's upload. */
  illustrative?: boolean;
}

export interface ListingSummary {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerVerified: boolean;
  categoryId: string;
  categoryName: string;
  localityId: string;
  localityName: string;
  district: string;
  kmFromPatiala: number;
  produceName: string;
  variety: string | null;
  unit: Unit;
  quantityTotal: number;
  quantityAvailable: number;
  minOrderQty: number;
  maxOrderQty: number | null;
  pricePerUnitPaise: number;
  pricePerKgPaise: number;
  availabilityType: AvailabilityType;
  expectedHarvestDate: string | null;
  qualityGrade: QualityGrade;
  status: ListingStatus;
  isDemo: boolean;
  publishedAt: string | null;
  cover: ImageRef | null;
}

export interface FarmerPublic {
  id: string;
  displayName: string;
  district: string | null;
  village: string | null;
  bio: string | null;
  avatarUrl: string | null;
  verifiedAt: string | null;
  memberSince: string;
  isDemo: boolean;
}

export interface FarmerStats {
  completedOrders: number;
  ratingCount: number;
  ratingAverage: number | null;
  recentReviews: { rating: number; comment: string | null; createdAt: string }[];
}

export interface ListingDetail extends ListingSummary {
  description: string | null;
  qualityNotes: string | null;
  availableUntil: string | null;
  hiddenByAdmin: boolean;
  images: (ImageRef & { id?: string; path?: string })[];
  farmer: FarmerPublic;
}

export interface ListingFilters {
  q?: string;
  category?: string;
  locality?: string;
  maxKm?: number;
  minPricePerKgPaise?: number;
  maxPricePerKgPaise?: number;
  minQtyKg?: number;
  harvestWithinDays?: number;
  verifiedOnly?: boolean;
  availability?: AvailabilityType;
  sort?: ListingSort;
  page?: number;
  pageSize?: number;
}

export const LISTING_SORTS = ['relevance', 'newest', 'harvest', 'price_low', 'price_high', 'nearest'] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];
export const LISTING_SORT_LABEL: Record<ListingSort, string> = {
  relevance: 'Best match',
  newest: 'Newest',
  harvest: 'Harvest date: soonest',
  price_low: 'Price per kg: low to high',
  price_high: 'Price per kg: high to low',
  nearest: 'Distance from Patiala',
};

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Category {
  id: string;
  name: string;
}
export interface Locality {
  id: string;
  name: string;
  district: string;
  kmFromPatiala: number;
}

export interface OfferEvent {
  id: number;
  actorRole: 'buyer' | 'farmer' | 'admin' | 'system';
  event: 'created' | 'countered' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';
  quantity: number | null;
  pricePerUnitPaise: number | null;
  message: string | null;
  reason: string | null;
  createdAt: string;
}

export interface OfferView {
  id: string;
  listingId: string;
  listingTitle: string;
  listingCover: ImageRef | null;
  listingAskPaise: number;
  buyerId: string;
  buyerName: string;
  farmerId: string;
  farmerName: string;
  status: OfferStatus;
  unit: Unit;
  quantity: number;
  pricePerUnitPaise: number;
  fulfilmentMethod: FulfilmentMethod;
  message: string | null;
  version: number;
  counterCount: number;
  lastActor: 'buyer' | 'farmer' | 'admin' | 'system';
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
  orderId: string | null;
  events?: OfferEvent[];
}

export interface OrderView {
  id: string;
  reference: string;
  offerId: string;
  listingId: string;
  listingTitle: string;
  listingCover: ImageRef | null;
  localityName: string;
  buyerId: string;
  buyerName: string;
  farmerId: string;
  farmerName: string;
  status: OrderStatus;
  unit: Unit;
  quantity: number;
  pricePerUnitPaise: number;
  totalPaise: number;
  fulfilmentMethod: FulfilmentMethod;
  fulfilmentDate: string | null;
  farmerNote: string | null;
  cancelReason: string | null;
  cancelledBy: string | null;
  paymentStatus: string;
  createdAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  isDemo: boolean;
  history?: { fromStatus: OrderStatus | null; toStatus: OrderStatus; actorRole: string; note: string | null; createdAt: string }[];
  review?: { rating: number; comment: string | null } | null;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
}
