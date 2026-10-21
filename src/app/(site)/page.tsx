import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  ClipboardList,
  FileCheck2,
  Handshake,
  MapPin,
  PackageCheck,
  Search,
  SlidersHorizontal,
  Sprout,
  Star,
  Truck,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { ListingCard } from '@/components/marketplace/listing-card';
import { SavedListingsProvider } from '@/components/marketplace/saved-listings';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form-controls';
import { InfoTip } from '@/components/ui/overlays';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { PRODUCE, SCENES } from '@/content/images';
import { CATEGORIES, LOCALITIES } from '@/content/reference';
import { searchListings } from '@/server/data/catalog';

export const revalidate = 300;

const HOW_STEPS = [
  { icon: Sprout, title: 'List', text: 'Farmers post the crop, expected quantity, harvest date, asking price, declared quality and photos — before harvest.' },
  { icon: Search, title: 'Discover', text: 'Buyers search by crop, village, distance, quantity and harvest window around Patiala.' },
  { icon: SlidersHorizontal, title: 'Match', text: 'Filters surface listings that fit the buyer’s location, quantity range and timing.' },
  { icon: Handshake, title: 'Negotiate', text: 'Buyers make offers; farmers accept, decline or counter. Every revision is recorded.' },
  { icon: FileCheck2, title: 'Confirm', text: 'When both sides agree on quantity, price, quality and delivery, the order is created.' },
  { icon: Truck, title: 'Fulfil', text: 'Pickup or delivery is planned and the order is tracked through to completion.' },
];

const FARMER_BENEFITS = [
  ['Find buyers before harvest', 'List a standing crop and start conversations weeks before it has to move.'],
  ['Compare offers side by side', 'See every offer against your asking price, and counter on price or quantity.'],
  ['Improve price transparency', 'Where sourced mandi data exists, see the reference price with its date and market.'],
  ['Keep your existing channels', 'Sell part of the crop here and the rest through the mandi or your usual buyers.'],
];
const BUYER_BENEFITS = [
  ['Discover nearby farmers', 'Browse growers by village and distance from Patiala.'],
  ['Plan purchases in advance', 'Line up quantities against expected harvest dates instead of buying day to day.'],
  ['Compare prices and quantities', 'Asking price per unit and per kg, available volume and order range on every listing.'],
  ['Review supplier profiles', 'Check verification status, declared quality, photos and ratings from completed orders.'],
];
const TRUST = [
  { icon: BadgeCheck, title: 'Farmer profiles', text: 'Each listing links to the farmer’s village, listing history and — once checked by AgriLink — a verified badge.' },
  { icon: Camera, title: 'Crop photographs', text: 'Farmers attach photos of the standing crop, sample crates and close-ups.' },
  { icon: ClipboardList, title: 'Declared quality', text: 'Grade and condition are declared up front, so grading terms can be agreed before confirming.' },
  { icon: PackageCheck, title: 'Clear order terms', text: 'Quantity, price, quality and delivery are fixed in the order both parties agree.' },
  { icon: Star, title: 'Ratings and history', text: 'Completed orders and buyer ratings build a track record — shown only once they exist.' },
];

export default async function HomePage() {
  const preview = await searchListings({ sort: 'harvest', pageSize: 4 });
  const anyDemo = preview.items.some((l) => l.isDemo);

  return (
    <>
      {/* Hero */}
      <section className="container-page grid items-center gap-12 pb-18 pt-12 lg:grid-cols-[1.05fr_1fr] lg:pb-20 lg:pt-14">
        <div className="flex flex-col gap-6">
          <span className="inline-flex h-8 items-center gap-2 self-start rounded-full border border-line bg-white px-3 text-[13px] font-semibold text-forest">
            <MapPin className="size-[15px]" aria-hidden="true" /> Launching in Patiala, Punjab
          </span>
          <h1 className="text-[clamp(2.5rem,5vw,4.25rem)] font-extrabold leading-[1.04] tracking-[-0.035em] text-forest-deep">
            Better Harvests Start With Better Connections.
          </h1>
          <p className="max-w-[540px] text-lg leading-relaxed text-[#475047]">
            Farmers around Patiala list tomatoes, potatoes and onions before harvest and agree terms with buyers early. Retailers,
            restaurants, hotels and processors get a direct line to nearby growers, and can plan purchases weeks ahead.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/marketplace">
                Explore Produce <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/register?role=farmer">List Your Produce</Link>
            </Button>
          </div>
          <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-ink-soft">
            {['Direct farmer-to-buyer deals', 'Mandi references only with date and source', 'Farmers can still sell the rest at the mandi'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 text-forest" strokeWidth={2.4} aria-hidden="true" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <figure className="relative isolate flex min-h-[500px] flex-col justify-center gap-4 overflow-hidden rounded-[20px] bg-forest p-5 sm:p-10">
          <Image src={SCENES.farmerWheatHarvest.src} alt={SCENES.farmerWheatHarvest.alt} fill priority sizes="(min-width: 1024px) 48vw, 100vw" className="-z-20 object-cover" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(16,59,40,0.5)_0%,rgba(16,59,40,0.06)_32%,rgba(16,59,40,0.06)_62%,rgba(16,59,40,0.78)_100%)]" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#e7f2de]">One listing, start to finish</span>
            <Badge tone="light">Illustrative</Badge>
          </div>
          <div className="flex w-full max-w-[360px] items-center gap-3.5 self-start rounded-lg border border-line bg-white p-3.5 shadow-pop">
            <Image src={PRODUCE.tomatoHeap.src} alt="" width={88} height={88} className="size-[88px] shrink-0 rounded-[10px] object-cover" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[13px] font-semibold text-muted">Listed 6 weeks before harvest</span>
              <strong className="font-display text-base">Tomato · Punjab Ratta</strong>
              <span className="tabular text-sm text-ink-soft">
                <strong>₹1,600</strong>/quintal asking · 120 quintals · Sanaur
              </span>
            </div>
          </div>
          <div className="w-full max-w-[380px] self-end rounded-lg border border-line bg-white p-[18px] shadow-pop">
            <strong className="mb-3 block font-display text-[15px]">Offer thread</strong>
            <ol className="tabular flex flex-col text-sm">
              <li className="grid grid-cols-[16px_1fr] gap-2.5 pb-3">
                <span className="mt-1.5 size-2.5 rounded-full bg-saffron" />
                <span>
                  <span className="text-muted">Restaurant, Patiala offers</span> <strong>₹1,500/quintal</strong> for 20 quintals
                </span>
              </li>
              <li className="grid grid-cols-[16px_1fr] gap-2.5 pb-3">
                <span className="mt-1.5 size-2.5 rounded-full bg-leaf" />
                <span>
                  <span className="text-muted">Farmer counters at</span> <strong>₹1,575/quintal</strong>
                </span>
              </li>
              <li className="grid grid-cols-[16px_1fr] gap-2.5 border-t border-line-soft pt-3">
                <span className="mt-1.5 size-2.5 rounded-full bg-forest" />
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <strong>Agreed · 20 quintals at ₹1,575</strong>
                  <Badge tone="ok">Order created</Badge>
                </span>
              </li>
            </ol>
          </div>
          <figcaption className="flex items-center gap-2.5 text-sm font-semibold text-[#f3ebdd]">
            <span className="size-2 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
            Find the buyer before the produce becomes a distress sale.
          </figcaption>
        </figure>
      </section>

      {/* Marketplace preview */}
      <section className="border-y border-line bg-white">
        <div className="container-page flex flex-col gap-7 py-18 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex max-w-2xl flex-col gap-2.5">
              <span className="eyebrow">Marketplace</span>
              <h2 className="text-[clamp(1.9rem,3vw,2.5rem)] font-extrabold text-forest-deep">Produce from around Patiala, before it is harvested</h2>
            </div>
            {anyDemo ? <Badge tone="demo">Sample listings · illustrative demo data</Badge> : null}
          </div>
          <form action="/marketplace" method="get" role="search" className="flex flex-wrap gap-2.5 rounded-xl border border-line bg-cream p-2.5">
            <div className="relative min-w-0 flex-[2_1_300px]">
              <label htmlFor="home-q" className="sr-only">
                Search crop or variety
              </label>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input id="home-q" name="q" type="search" placeholder="Search tomato, potato, onion, variety…" className="pl-10" />
            </div>
            <div className="min-w-0 flex-[1_1_200px]">
              <label htmlFor="home-loc" className="sr-only">
                Location
              </label>
              <Select id="home-loc" name="locality" defaultValue="">
                <option value="">All of Patiala district</option>
                {LOCALITIES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} (~{l.kmFromPatiala} km)
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" className="flex-[1_0_auto]">
              Search produce
            </Button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-3.5">
            <nav aria-label="Browse by category" className="flex flex-wrap gap-2">
              {CATEGORIES.slice(0, 3).map((c) => (
                <Link key={c.id} href={`/marketplace?category=${c.id}`} className="inline-flex min-h-10 items-center rounded-full border border-line-strong bg-white px-3.5 text-sm font-medium hover:border-forest">
                  {c.name}
                </Link>
              ))}
              <Link href="/marketplace" className="inline-flex min-h-10 items-center rounded-full border border-forest bg-forest px-3.5 text-sm font-medium text-white">
                All produce
              </Link>
            </nav>
            <div className="flex flex-wrap items-center gap-4 text-[13px] text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-forest" aria-hidden="true" /> Asking price — set by the farmer
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-saffron" aria-hidden="true" /> Mandi reference — sourced and dated
                <InfoTip label="About mandi reference prices">
                  A mandi reference is the modal price reported for a regulated market (APMC mandi) on a given date, usually per quintal.
                  AgriLink will show it only when a dated figure from AGMARKNET or data.gov.in is attached — never estimated.
                </InfoTip>
              </span>
            </div>
          </div>
          {preview.items.length ? (
            <SavedListingsProvider>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {preview.items.map((l, i) => (
                  <ListingCard key={l.id} listing={l} priority={i < 2} />
                ))}
              </div>
            </SavedListingsProvider>
          ) : (
            <EmptyState icon={<Sprout />} title="Listings will appear here as farmers add them" action={<Button asChild><Link href="/register?role=farmer">List your produce</Link></Button>}>
              AgriLink is starting with farmers around Patiala. Be one of the first to list a crop before harvest.
            </EmptyState>
          )}
          <div className="flex justify-center">
            <Button asChild>
              <Link href="/marketplace">
                See all produce <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="container-page flex scroll-mt-20 flex-col gap-10 py-22">
        <div className="flex max-w-2xl flex-col gap-2.5">
          <span className="eyebrow">How AgriLink works</span>
          <h2 className="text-[clamp(1.9rem,3vw,2.5rem)] font-extrabold text-forest-deep">From a standing crop to a confirmed order, in six steps</h2>
        </div>
        <div className="relative aspect-[16/5] min-h-[170px] overflow-hidden rounded-xl bg-sage">
          <Image src={SCENES.greenFieldRows.src} alt={SCENES.greenFieldRows.alt} fill sizes="(min-width: 1240px) 1192px, 100vw" className="object-cover" />
        </div>
        <ol className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-6">
          {HOW_STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2 border-t-2 border-forest pt-4">
              <span className="flex items-center gap-2 text-sm font-extrabold tracking-[0.04em] text-eyebrow">
                <s.icon className="size-[18px]" aria-hidden="true" /> {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-xl font-extrabold text-forest-deep">{s.title}</h3>
              <p className="text-sm leading-relaxed text-[#475047]">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Benefits */}
      <section className="container-page grid gap-6 pb-22 lg:grid-cols-2">
        <div className="flex flex-col gap-6 overflow-hidden rounded-xl bg-forest p-8 text-cream sm:p-10">
          <div className="relative -mx-8 -mt-8 aspect-video sm:-mx-10 sm:-mt-10">
            <Image src={SCENES.womenFarmersField.src} alt={SCENES.womenFarmersField.alt} fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="eyebrow text-on-forest-muted">For farmers</span>
            <h2 className="text-3xl font-extrabold text-white">Sell with more information, and more time</h2>
          </div>
          <BenefitList items={FARMER_BENEFITS} dark />
          <Button asChild variant="cream" className="mt-auto self-start">
            <Link href="/register?role=farmer">List your produce</Link>
          </Button>
        </div>
        <div className="flex flex-col gap-6 overflow-hidden rounded-xl border border-line bg-white p-8 sm:p-10">
          <div className="relative -mx-8 -mt-8 aspect-video sm:-mx-10 sm:-mt-10">
            <Image src={SCENES.marketChilliesBuyer.src} alt={SCENES.marketChilliesBuyer.alt} fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="eyebrow">For buyers</span>
            <h2 className="text-3xl font-extrabold text-forest-deep">Plan supply with growers you can see</h2>
          </div>
          <BenefitList items={BUYER_BENEFITS} />
          <Button asChild className="mt-auto self-start">
            <Link href="/marketplace">Explore produce</Link>
          </Button>
        </div>
      </section>

      {/* Price transparency */}
      <section className="border-y border-line bg-white">
        <div className="container-page grid items-center gap-12 py-22 lg:grid-cols-2">
          <div className="flex flex-col gap-4.5">
            <span className="eyebrow">Price transparency</span>
            <h2 className="text-[clamp(1.9rem,3vw,2.5rem)] font-extrabold text-forest-deep">See the asking price next to the mandi, with the date and source</h2>
            <p className="leading-relaxed text-[#475047]">
              Every listing shows the farmer’s asking price per unit, with the per-kg equivalent. Once a dated modal price for a nearby
              mandi is connected from AGMARKNET or data.gov.in, it will appear beside the listing with the market, arrival date, unit and
              source — so both sides negotiate from the same reference.
            </p>
            <p className="leading-relaxed text-[#475047]">When no sourced figure exists, the listing says so plainly. AgriLink never fills the gap with an estimate.</p>
            <div className="relative mt-1.5 aspect-[3/2] overflow-hidden rounded-xl">
              <Image src={SCENES.vegetableMarketStreet.src} alt={SCENES.vegetableMarketStreet.alt} fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
            </div>
          </div>
          <div className="flex flex-col gap-5 rounded-lg border border-line bg-paper p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <strong className="font-display text-[17px]">Tomato · Grade A</strong>
              <Badge tone="saffron">Example values — not market data</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <PriceTile label="Farmer’s asking price" tone="forest" perQ="₹1,600" perKg="₹16.00" />
              <PriceTile label="Mandi reference (modal)" tone="saffron" perQ="₹1,450" perKg="₹14.50" />
            </div>
            <div className="flex flex-col gap-2" aria-hidden="true">
              <Bar label="Asking" pct={80} className="bg-forest" />
              <Bar label="Mandi" pct={72.5} className="bg-saffron" />
            </div>
            <p className="tabular text-sm text-ink-soft">
              Asking is <strong>₹150 per quintal (10.3%) above</strong> the reference in this example.
            </p>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-4 text-[13px]">
              <div>
                <dt className="text-muted">Market</dt>
                <dd className="font-semibold">Patiala APMC (example)</dd>
              </div>
              <div>
                <dt className="text-muted">Arrival date</dt>
                <dd className="font-semibold">Shown from source</dd>
              </div>
              <div>
                <dt className="text-muted">Unit</dt>
                <dd className="flex items-center gap-1.5 font-semibold">
                  ₹ per quintal
                  <InfoTip label="What is a quintal?">1 quintal = 100 kg. Indian mandis usually report prices per quintal.</InfoTip>
                </dd>
              </div>
              <div>
                <dt className="text-muted">Source</dt>
                <dd className="font-semibold">AGMARKNET / data.gov.in</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="container-page flex flex-col gap-9 py-22">
        <div className="flex max-w-2xl flex-col gap-2.5">
          <span className="eyebrow">Trust and verification</span>
          <h2 className="text-[clamp(1.9rem,3vw,2.5rem)] font-extrabold text-forest-deep">Know who you are dealing with before you commit</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {TRUST.map((t) => (
            <div key={t.title} className="flex flex-col gap-2.5 rounded-lg border border-line bg-white p-5">
              <span className="flex size-10 items-center justify-center rounded-[10px] bg-sage text-forest">
                <t.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="text-[17px] font-extrabold">{t.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTAs */}
      <section className="container-page grid gap-5 pb-24 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-4 rounded-xl bg-forest-deep p-10 text-cream">
          <span className="eyebrow text-on-forest-muted">Farmers</span>
          <h2 className="text-[28px] font-extrabold text-white">List your crop while it is still in the field</h2>
          <p className="max-w-md text-[15px] text-on-forest">Set your asking price, quantity range and harvest date. Compare offers and decide — you can still sell the rest through the mandi.</p>
          <Button asChild variant="accent">
            <Link href="/register?role=farmer">List Your Produce</Link>
          </Button>
        </div>
        <div className="flex flex-col items-start gap-4 rounded-xl bg-wait-bg p-10">
          <span className="eyebrow text-wait-fg">Buyers</span>
          <h2 className="text-[28px] font-extrabold">Line up supply for the weeks ahead</h2>
          <p className="max-w-md text-[15px] text-[#4a433a]">Browse pre-harvest listings near Patiala, check declared quality and farmer profiles, and make offers on the quantity you need.</p>
          <Button asChild>
            <Link href="/marketplace">Explore Produce</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function BenefitList({ items, dark = false }: { items: string[][]; dark?: boolean }) {
  return (
    <ul className="flex flex-col gap-4.5">
      {items.map(([title, text]) => (
        <li key={title} className="grid grid-cols-[28px_1fr] gap-3">
          <span className={dark ? 'flex size-7 items-center justify-center rounded-lg bg-leaf/30' : 'flex size-7 items-center justify-center rounded-lg bg-wait-bg'}>
            <Check className={dark ? 'size-[15px] text-[#e7f2de]' : 'size-[15px] text-wait-fg'} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <div>
            <strong className="block">{title}</strong>
            <span className={dark ? 'text-sm text-on-forest' : 'text-sm text-muted'}>{text}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PriceTile({ label, perQ, perKg, tone }: { label: string; perQ: string; perKg: string; tone: 'forest' | 'saffron' }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-white p-4">
      <span className={tone === 'forest' ? 'text-xs font-bold uppercase tracking-[0.06em] text-forest' : 'text-xs font-bold uppercase tracking-[0.06em] text-wait-fg'}>{label}</span>
      <span className="tabular font-display text-[26px] font-extrabold leading-tight text-forest-deep">
        {perQ}
        <span className="text-sm font-semibold text-muted"> /quintal</span>
      </span>
      <span className="tabular text-[13px] text-muted">= {perKg} per kg</span>
    </div>
  );
}

function Bar({ label, pct, className }: { label: string; pct: number; className: string }) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-muted">
      <span className="w-16">{label}</span>
      <div className="h-2.5 flex-1 rounded-full bg-line-soft">
        <div className={`h-2.5 rounded-full ${className}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
