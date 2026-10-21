// Listing lifecycle — mirrors public.listings_guard() for changes a farmer makes.
// sold_out is set by the system when the last quantity is reserved; farmers cannot set it.

export const LISTING_STATUSES = ['draft', 'active', 'paused', 'sold_out', 'archived'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  draft: 'Draft',
  active: 'Live',
  paused: 'Paused',
  sold_out: 'Sold out',
  archived: 'Archived',
};

const OWNER_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ['active', 'archived'],
  active: ['paused', 'archived'],
  paused: ['active', 'archived'],
  sold_out: ['archived', 'active'], // active only when quantity is available again
  archived: [],
};

export function canOwnerMoveListing(from: ListingStatus, to: ListingStatus, quantityAvailable: number, hiddenByAdmin = false): boolean {
  if (from === to) return false;
  if (!OWNER_TRANSITIONS[from].includes(to)) return false;
  if (from === 'sold_out' && to === 'active' && quantityAvailable <= 0) return false;
  if (hiddenByAdmin && to === 'active') return false;
  return true;
}

export const QUALITY_GRADES = ['grade_a', 'grade_b', 'ungraded'] as const;
export type QualityGrade = (typeof QUALITY_GRADES)[number];
export const QUALITY_LABEL: Record<QualityGrade, string> = {
  grade_a: 'Grade A — uniform size, firm, sorted',
  grade_b: 'Grade B — mixed size, minor blemishes',
  ungraded: 'Ungraded — field run',
};
export const QUALITY_SHORT: Record<QualityGrade, string> = { grade_a: 'Grade A', grade_b: 'Grade B', ungraded: 'Ungraded' };

export const AVAILABILITY_TYPES = ['pre_harvest', 'ready_now'] as const;
export type AvailabilityType = (typeof AVAILABILITY_TYPES)[number];
export const AVAILABILITY_LABEL: Record<AvailabilityType, string> = {
  pre_harvest: 'Before harvest',
  ready_now: 'Ready now',
};

export const MAX_LISTING_IMAGES = 6;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
