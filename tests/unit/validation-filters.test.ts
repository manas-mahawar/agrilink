import { describe, expect, it } from 'vitest';
import { activeFilterCount, marketplaceHref, parseMarketplaceParams } from '@/domain/filters';
import { listingSchema, offerSchema, registerSchema } from '@/domain/validation';
import { safeNextPath } from '@/lib/utils';

describe('registration', () => {
  const base = { accountType: 'farmer', displayName: 'Gurpreet Singh', email: 'G@Example.com ', password: 'Harvest2026', acceptTerms: 'on' };
  it('accepts a valid farmer and normalises the email', () => {
    const r = registerSchema.safeParse(base);
    expect(r.success && r.data.email).toBe('g@example.com');
  });
  it('cannot request an admin account', () => {
    expect(registerSchema.safeParse({ ...base, accountType: 'admin' }).success).toBe(false);
  });
  it('requires a business name for buyers and a strong-enough password', () => {
    expect(registerSchema.safeParse({ ...base, accountType: 'buyer' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: 'password' }).success).toBe(false);
  });
  it('validates Indian mobile numbers', () => {
    expect(registerSchema.safeParse({ ...base, phone: '98765 43210' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, phone: '12345' }).success).toBe(false);
  });
});

describe('listing and offer input', () => {
  const listing = {
    categoryId: 'tomatoes', produceName: 'Tomato', unit: 'quintal', quantityTotal: '100', minOrderQty: '5', maxOrderQty: '',
    price: '1,600', availabilityType: 'pre_harvest', expectedHarvestDate: '2026-11-20', qualityGrade: 'grade_a', localityId: 'sanaur',
  };
  it('parses prices to paise and blanks to undefined', () => {
    const r = listingSchema.safeParse(listing);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.price).toBe(160000);
      expect(r.data.maxOrderQty).toBeUndefined();
      expect(r.data.publish).toBe('active');
    }
  });
  it('rejects inconsistent quantities and a missing harvest date', () => {
    expect(listingSchema.safeParse({ ...listing, minOrderQty: '200' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, maxOrderQty: '2' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, expectedHarvestDate: '' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, quantityTotal: '1.234' }).success).toBe(false);
  });
  it('validates offers', () => {
    const ok = offerSchema.safeParse({ listingId: '6f1c1f3e-4a3b-4c55-9e1c-2b8f0f3d9a10', quantity: '20', price: '1500', fulfilmentMethod: 'buyer_pickup' });
    expect(ok.success).toBe(true);
    expect(offerSchema.safeParse({ listingId: 'x', quantity: '20', price: '1500', fulfilmentMethod: 'buyer_pickup' }).success).toBe(false);
    expect(offerSchema.safeParse({ listingId: '6f1c1f3e-4a3b-4c55-9e1c-2b8f0f3d9a10', quantity: '0', price: '1500', fulfilmentMethod: 'buyer_pickup' }).success).toBe(false);
  });
});

describe('marketplace URL params', () => {
  it('keeps valid filters and drops anything malformed', () => {
    const f = parseMarketplaceParams({ q: ' onion ', category: 'onions', locality: 'nowhere', km: '30', minPrice: '10', maxPrice: 'x', sort: 'DROP TABLE', page: '0' });
    expect(f).toMatchObject({ q: 'onion', category: 'onions', locality: undefined, maxKm: 30, minPricePerKgPaise: 1000, maxPricePerKgPaise: undefined, sort: undefined, page: 1 });
    expect(activeFilterCount(f)).toBe(3);
  });
  it('builds links that reset the page', () => {
    expect(marketplaceHref({ category: 'onions', page: '3' }, { page: 1 })).toBe('/marketplace?category=onions');
    expect(marketplaceHref({ category: 'onions' }, { category: undefined })).toBe('/marketplace');
  });
});

describe('safeNextPath (open-redirect protection)', () => {
  it('allows internal paths', () => {
    expect(safeNextPath('/dashboard/offers?tab=open')).toBe('/dashboard/offers?tab=open');
  });
  it('rejects external and tricky targets', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', '/\t/evil.com', '/\n/evil.com', 'javascript:alert(1)', '', null, undefined]) {
      expect(safeNextPath(bad as string, '/x')).toBe('/x');
    }
  });
});
