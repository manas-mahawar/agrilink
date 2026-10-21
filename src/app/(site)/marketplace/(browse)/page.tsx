import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ListingCard, ListingRow } from '@/components/marketplace/listing-card';
import {
  ActiveChips,
  FilterSidebar,
  MarketplaceNav,
  MobileFilters,
  ResultsRegion,
  SearchBox,
  SortAndView,
} from '@/components/marketplace/marketplace-controls';
import { SavedListingsProvider } from '@/components/marketplace/saved-listings';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, Notice } from '@/components/ui/primitives';
import { categoryName, HARVEST_WINDOW_OPTIONS, localityById } from '@/content/reference';
import { activeFilterCount, marketplaceHref, parseMarketplaceParams, type RawParams } from '@/domain/filters';
import { cn } from '@/lib/utils';
import { searchListings } from '@/server/data/catalog';
import type { ListingFilters } from '@/server/data/types';

export const metadata: Metadata = {
  title: 'Explore produce',
  description: 'Browse pre-harvest and ready-now tomatoes, potatoes and onions from farmers around Patiala, Punjab.',
  alternates: { canonical: '/marketplace' },
};

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const raw = await searchParams;
  const filters = parseMarketplaceParams(raw);
  const result = await searchListings(filters);
  const view = raw.view === 'list' ? 'list' : 'grid';
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const active = activeFilterCount(filters);
  const anyDemo = result.items.some((l) => l.isDemo);

  return (
    <Suspense>
      <MarketplaceNav>
        <div className="container-page flex flex-col gap-6 pb-20 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex max-w-3xl flex-col gap-2">
              <span className="eyebrow">Marketplace</span>
              <h1 className="text-[clamp(1.9rem,3.2vw,2.6rem)] font-extrabold text-forest-deep">Explore produce around Patiala</h1>
              <p className="text-[15px] text-muted">
                Asking prices are set by each farmer. Make an offer on the quantity you need — the farmer can accept, decline or counter.
              </p>
            </div>
            {anyDemo ? <Badge tone="demo">Includes illustrative demo listings</Badge> : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SearchBox />
            <MobileFilters activeCount={active} />
          </div>

          <div className="grid items-start gap-7 lg:grid-cols-[272px_1fr]">
            <FilterSidebar activeCount={active} />
            <section aria-labelledby="results-heading" className="flex min-w-0 flex-col gap-4">
              <h2 id="results-heading" className="sr-only">
                Results
              </h2>
              <SortAndView total={result.total} />
              <ActiveChips chips={chipsFor(filters)} />
              <ResultsRegion>
                {result.items.length ? (
                  <SavedListingsProvider>
                    {view === 'list' ? (
                      <div className="flex flex-col gap-3">
                        {result.items.map((l) => (
                          <ListingRow key={l.id} listing={l} />
                        ))}
                      </div>
                    ) : (
                      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                        {result.items.map((l, i) => (
                          <ListingCard key={l.id} listing={l} priority={i < 3 && filters.page === 1} />
                        ))}
                      </div>
                    )}
                  </SavedListingsProvider>
                ) : filters.page && filters.page > 1 && result.total > 0 ? (
                  <Notice tone="info">
                    That page is past the end of the results.{' '}
                    <Link className="font-semibold underline" href={marketplaceHref(raw, { page: undefined })}>
                      Go to the first page
                    </Link>
                    .
                  </Notice>
                ) : (
                  <EmptyState
                    icon={<SearchX />}
                    title={active || filters.q ? 'No listings match these filters' : 'No listings yet'}
                    action={
                      active || filters.q ? (
                        <Button asChild variant="secondary">
                          <Link href="/marketplace">Clear search and filters</Link>
                        </Button>
                      ) : (
                        <Button asChild>
                          <Link href="/register?role=farmer">List your produce</Link>
                        </Button>
                      )
                    }
                  >
                    {active || filters.q
                      ? 'Try a wider distance or harvest window, or remove a filter.'
                      : 'Farmers around Patiala will appear here as they list their crops.'}
                  </EmptyState>
                )}
              </ResultsRegion>
              {pages > 1 ? <Pagination raw={raw} page={result.page} pages={pages} /> : null}
            </section>
          </div>
        </div>
      </MarketplaceNav>
    </Suspense>
  );
}

function chipsFor(f: ListingFilters) {
  const chips: { key: string; label: string }[] = [];
  if (f.category) chips.push({ key: 'category', label: categoryName(f.category) });
  if (f.locality) chips.push({ key: 'locality', label: localityById(f.locality)?.name ?? f.locality });
  if (f.maxKm) chips.push({ key: 'km', label: `Within ${f.maxKm} km` });
  if (f.harvestWithinDays) chips.push({ key: 'harvest', label: HARVEST_WINDOW_OPTIONS.find((h) => h.days === f.harvestWithinDays)?.label ?? `Harvest within ${f.harvestWithinDays} days` });
  if (f.availability) chips.push({ key: 'availability', label: f.availability === 'pre_harvest' ? 'Pre-harvest' : 'Ready now' });
  if (f.minPricePerKgPaise !== undefined || f.maxPricePerKgPaise !== undefined) {
    const min = f.minPricePerKgPaise !== undefined ? `₹${f.minPricePerKgPaise / 100}` : '';
    const max = f.maxPricePerKgPaise !== undefined ? `₹${f.maxPricePerKgPaise / 100}` : '';
    chips.push({ key: 'price', label: min && max ? `${min}–${max}/kg` : min ? `From ${min}/kg` : `Up to ${max}/kg` });
  }
  if (f.minQtyKg) chips.push({ key: 'minQty', label: `At least ${f.minQtyKg.toLocaleString('en-IN')} kg` });
  if (f.verifiedOnly) chips.push({ key: 'verified', label: 'Verified farmers' });
  return chips;
}

function Pagination({ raw, page, pages }: { raw: RawParams; page: number; pages: number }) {
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))).sort((a, b) => a - b);
  const linkCls = 'inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-line-strong bg-white px-3 text-sm font-semibold';
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5 pt-4">
      {page > 1 ? (
        <Link href={marketplaceHref(raw, { page: page - 1 })} className={linkCls} rel="prev">
          <ChevronLeft className="size-4" aria-hidden="true" /> Previous
        </Link>
      ) : null}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - nums[i - 1] > 1 ? <span className="px-1 text-muted">…</span> : null}
          <Link
            href={marketplaceHref(raw, { page: n })}
            aria-current={n === page ? 'page' : undefined}
            className={cn(linkCls, n === page && 'border-forest bg-forest text-white')}
          >
            {n}
          </Link>
        </span>
      ))}
      {page < pages ? (
        <Link href={marketplaceHref(raw, { page: page + 1 })} className={linkCls} rel="next">
          Next <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  );
}
