'use client';

import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Label, Select } from '@/components/ui/form-controls';
import { Dialog, DialogTrigger, SheetContent } from '@/components/ui/overlays';
import { CATEGORIES, DISTANCE_OPTIONS, HARVEST_WINDOW_OPTIONS, LOCALITIES } from '@/content/reference';
import { cn } from '@/lib/utils';
import { LISTING_SORT_LABEL, LISTING_SORTS } from '@/server/data/types';

type Overrides = Record<string, string | undefined>;
const NavContext = React.createContext<{ navigate: (o: Overrides) => void; pending: boolean } | null>(null);

function useMarketplaceNav() {
  const ctx = React.useContext(NavContext);
  if (!ctx) throw new Error('Marketplace controls must be inside <MarketplaceNav>');
  return ctx;
}

/** Owns URL updates for the marketplace so every control shares one pending state. */
export function MarketplaceNav({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const navigate = React.useCallback(
    (o: Overrides) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(o)) {
        if (v === undefined || v === '') sp.delete(k);
        else sp.set(k, v);
      }
      if (!('page' in o)) sp.delete('page');
      const s = sp.toString();
      startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );
  const value = React.useMemo(() => ({ navigate, pending }), [navigate, pending]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function ResultsRegion({ children }: { children: React.ReactNode }) {
  const { pending } = useMarketplaceNav();
  return (
    <div aria-busy={pending} className={cn('transition-opacity', pending && 'pointer-events-none opacity-55')}>
      {children}
    </div>
  );
}

export function SearchBox() {
  const params = useSearchParams();
  const { navigate } = useMarketplaceNav();
  const urlQ = params.get('q') ?? '';
  const [value, setValue] = React.useState(urlQ);
  const lastSent = React.useRef(urlQ);

  // Keep the box in sync when the URL changes elsewhere (e.g. "Clear all").
  React.useEffect(() => {
    if (urlQ !== lastSent.current) {
      lastSent.current = urlQ;
      setValue(urlQ);
    }
  }, [urlQ]);

  React.useEffect(() => {
    const next = value.trim();
    if (next === lastSent.current) return;
    const t = window.setTimeout(() => {
      lastSent.current = next;
      navigate({ q: next || undefined });
    }, 350);
    return () => window.clearTimeout(t);
  }, [value, navigate]);

  return (
    <form
      role="search"
      action="/marketplace"
      method="get"
      className="relative min-w-0 flex-[1_1_320px]"
      onSubmit={(e) => {
        e.preventDefault();
        lastSent.current = value.trim();
        navigate({ q: value.trim() || undefined });
      }}
    >
      <label htmlFor="mp-q" className="sr-only">
        Search crop, variety, village or farmer
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" aria-hidden="true" />
      <Input
        id="mp-q"
        name="q"
        type="search"
        value={value}
        maxLength={80}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search tomato, Kufri Jyoti, Sanaur…"
        className="pl-10"
        autoComplete="off"
      />
    </form>
  );
}

export function SortAndView({ total }: { total: number }) {
  const params = useSearchParams();
  const { navigate } = useMarketplaceNav();
  const view = params.get('view') === 'list' ? 'list' : 'grid';
  const hasQuery = Boolean(params.get('q'));
  const sort = params.get('sort') ?? (hasQuery ? 'relevance' : 'newest');
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="tabular text-sm text-ink-soft" aria-live="polite">
        <strong className="text-ink">{total.toLocaleString('en-IN')}</strong> {total === 1 ? 'listing' : 'listings'}
      </p>
      <div className="flex items-center gap-2.5">
        <label htmlFor="mp-sort" className="text-sm text-muted">
          Sort
        </label>
        <Select id="mp-sort" value={sort} onChange={(e) => navigate({ sort: e.target.value })} className="h-10 w-auto min-w-[170px]">
          {LISTING_SORTS.filter((s) => s !== 'relevance' || hasQuery).map((s) => (
            <option key={s} value={s}>
              {LISTING_SORT_LABEL[s]}
            </option>
          ))}
        </Select>
        <div role="group" aria-label="Layout" className="hidden rounded-md border border-line-strong bg-white p-0.5 sm:flex">
          {(['grid', 'list'] as const).map((v) => {
            const Icon = v === 'grid' ? LayoutGrid : List;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                aria-label={v === 'grid' ? 'Grid view' : 'List view'}
                onClick={() => navigate({ view: v === 'grid' ? undefined : 'list', page: params.get('page') ?? undefined })}
                className={cn('flex size-9 items-center justify-center rounded-[6px] text-muted', view === v && 'bg-forest text-white')}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterFields({ idPrefix, onApplied }: { idPrefix: string; onApplied?: () => void }) {
  const params = useSearchParams();
  const { navigate } = useMarketplaceNav();
  const formRef = React.useRef<HTMLFormElement>(null);
  const id = (s: string) => `${idPrefix}-${s}`;

  const apply = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const get = (k: string) => {
      const v = String(fd.get(k) ?? '').trim();
      return v || undefined;
    };
    navigate({
      category: get('category'),
      locality: get('locality'),
      km: get('km'),
      harvest: get('harvest'),
      availability: get('availability'),
      minQty: get('minQty'),
      minPrice: get('minPrice'),
      maxPrice: get('maxPrice'),
      verified: fd.get('verified') ? '1' : undefined,
    });
    onApplied?.();
  };

  // Selects and the checkbox apply instantly; number fields apply on blur / Enter / the button.
  const instant = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    if (!onApplied && e.currentTarget.form) apply(e.currentTarget.form);
  };

  return (
    <form
      ref={formRef}
      action="/marketplace"
      method="get"
      key={params.toString()}
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      className="flex flex-col gap-5"
    >
      {params.get('q') ? <input type="hidden" name="q" value={params.get('q') ?? ''} /> : null}
      <FilterGroup label="Crop" htmlFor={id('category')}>
        <Select id={id('category')} name="category" defaultValue={params.get('category') ?? ''} onChange={instant}>
          <option value="">All crops</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FilterGroup>
      <FilterGroup label="Village or town" htmlFor={id('locality')}>
        <Select id={id('locality')} name="locality" defaultValue={params.get('locality') ?? ''} onChange={instant}>
          <option value="">Anywhere near Patiala</option>
          {LOCALITIES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} (~{l.kmFromPatiala} km)
            </option>
          ))}
        </Select>
      </FilterGroup>
      <FilterGroup label="Distance from Patiala" htmlFor={id('km')}>
        <Select id={id('km')} name="km" defaultValue={params.get('km') ?? ''} onChange={instant}>
          <option value="">Any distance</option>
          {DISTANCE_OPTIONS.map((km) => (
            <option key={km} value={km}>
              Within {km} km
            </option>
          ))}
        </Select>
      </FilterGroup>
      <FilterGroup label="Harvest window" htmlFor={id('harvest')}>
        <Select id={id('harvest')} name="harvest" defaultValue={params.get('harvest') ?? ''} onChange={instant}>
          <option value="">Any time</option>
          {HARVEST_WINDOW_OPTIONS.map((h) => (
            <option key={h.days} value={h.days}>
              {h.label}
            </option>
          ))}
        </Select>
      </FilterGroup>
      <FilterGroup label="Availability" htmlFor={id('availability')}>
        <Select id={id('availability')} name="availability" defaultValue={params.get('availability') ?? ''} onChange={instant}>
          <option value="">Any availability</option>
          <option value="pre_harvest">Pre-harvest only</option>
          <option value="ready_now">Ready now only</option>
        </Select>
      </FilterGroup>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Asking price (₹ per kg)</legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor={id('minPrice')} className="sr-only">
              Minimum price per kg
            </Label>
            <Input id={id('minPrice')} name="minPrice" inputMode="numeric" pattern="[0-9]*" placeholder="Min" defaultValue={params.get('minPrice') ?? ''} />
          </div>
          <div>
            <Label htmlFor={id('maxPrice')} className="sr-only">
              Maximum price per kg
            </Label>
            <Input id={id('maxPrice')} name="maxPrice" inputMode="numeric" pattern="[0-9]*" placeholder="Max" defaultValue={params.get('maxPrice') ?? ''} />
          </div>
        </div>
      </fieldset>
      <FilterGroup label="Minimum quantity available (kg)" htmlFor={id('minQty')}>
        <Input id={id('minQty')} name="minQty" inputMode="numeric" pattern="[0-9]*" placeholder="e.g. 500" defaultValue={params.get('minQty') ?? ''} />
      </FilterGroup>
      <label htmlFor={id('verified')} className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm font-medium">
        <Checkbox id={id('verified')} name="verified" value="1" defaultChecked={params.get('verified') === '1'} onChange={instant} />
        Verified farmers only
      </label>
      <Button type="submit" variant={onApplied ? 'primary' : 'secondary'}>
        {onApplied ? 'Show results' : 'Apply price and quantity'}
      </Button>
    </form>
  );
}

function FilterGroup({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function FilterSidebar({ activeCount }: { activeCount: number }) {
  const { navigate } = useMarketplaceNav();
  return (
    <aside aria-labelledby="filters-heading" className="hidden lg:block">
      <div className="sticky top-24 flex flex-col gap-4 rounded-lg border border-line bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 id="filters-heading" className="text-lg font-extrabold">
            Filters
          </h2>
          {activeCount ? <ClearAll onClear={() => navigate(CLEAR)} /> : null}
        </div>
        <FilterFields idPrefix="side" />
      </div>
    </aside>
  );
}

const CLEAR: Overrides = { category: undefined, locality: undefined, km: undefined, harvest: undefined, availability: undefined, minQty: undefined, minPrice: undefined, maxPrice: undefined, verified: undefined };

function ClearAll({ onClear }: { onClear: () => void }) {
  return (
    <button type="button" onClick={onClear} className="min-h-10 text-sm font-semibold text-forest underline underline-offset-4">
      Clear all
    </button>
  );
}

export function MobileFilters({ activeCount }: { activeCount: number }) {
  const [open, setOpen] = React.useState(false);
  const { navigate } = useMarketplaceNav();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="lg:hidden">
          <SlidersHorizontal /> Filters{activeCount ? ` (${activeCount})` : ''}
        </Button>
      </DialogTrigger>
      <SheetContent title="Filters" side="left">
        <div className="flex flex-col gap-4">
          {activeCount ? (
            <ClearAll
              onClear={() => {
                navigate(CLEAR);
                setOpen(false);
              }}
            />
          ) : null}
          <FilterFields idPrefix="sheet" onApplied={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Dialog>
  );
}

export function ActiveChips({ chips }: { chips: { key: string; label: string }[] }) {
  const { navigate } = useMarketplaceNav();
  if (!chips.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <li key={c.key}>
          <button
            type="button"
            onClick={() => navigate(c.key === 'price' ? { minPrice: undefined, maxPrice: undefined } : { [c.key]: undefined })}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-forest/30 bg-sage-soft px-3 text-[13px] font-medium text-forest-deep hover:border-forest"
            aria-label={`Remove filter: ${c.label}`}
          >
            {c.label} <X className="size-3.5" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
