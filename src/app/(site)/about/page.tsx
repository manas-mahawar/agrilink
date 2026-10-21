import { ArrowRight, Eye, Hourglass, Mail, MapPin, Store, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { SCENES } from '@/content/images';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = {
  title: 'About',
  description: 'Why AgriLink exists: helping farmers around Patiala find buyers before harvest, and helping businesses plan local supply.',
};

const PROBLEMS = [
  { icon: Eye, title: 'Limited visibility', text: 'Farmers often see little of buyer demand or competing offers before they have to sell.' },
  { icon: Hourglass, title: 'Perishable, so pressured', text: 'Tomatoes and onions can’t wait for long. Once they’re picked, timing can force a rushed decision.' },
  { icon: Users, title: 'Hard to plan supply', text: 'Retailers, restaurants and processors struggle to find dependable local suppliers far enough ahead.' },
  { icon: Store, title: 'Channels matter, options are few', text: 'Mandis and traders remain important. Finding additional buyers and comparing opportunities alongside them is what’s hard.' },
];

const STEPS = [
  ['List', 'Farmers list their crop, expected quantity, asking price, location and harvest date.'],
  ['Discover', 'Buyers explore produce that is available now and produce that is coming up.'],
  ['Match', 'Relevant listings surface by crop, quantity, location, price and availability.'],
  ['Negotiate', 'Farmers and buyers exchange offers and counteroffers, all on record.'],
  ['Confirm', 'Both sides agree on price, quantity, quality and delivery terms.'],
  ['Fulfil', 'Order progress, payment status and feedback on the transaction can be recorded.'],
];

const PRINCIPLES = [
  ['Farmer First', 'Make it easier for farmers to discover buyers and compare opportunities — without removing their freedom to use existing market channels.'],
  ['Transparency Matters', 'Present asking prices clearly, and show mandi price references only when reliable, properly dated source data is available.'],
  ['Trust Before Transactions', 'Encourage clear terms, crop photographs, declared quality, user verification and feedback after every transaction.'],
  ['Local Before Global', 'Start with the agricultural ecosystem in Patiala, learn from real users, and expand only when the model proves useful.'],
];

const PHASES = [
  { tag: 'Phase 1 · Starting point', title: 'Pilot', text: 'Validate the marketplace with a focused group of local farmers and buyers around Patiala.', note: 'Pilot target: 20–50 farmers and 10–30 buyers. This is a goal, not current participation.', current: true },
  { tag: 'Phase 2', title: 'Growth', text: 'Onboard more farmers, buyers and logistics partners as the pilot shows what works.' },
  { tag: 'Phase 3', title: 'Expansion', text: 'Explore more crops and nearby districts — only if the pilot demonstrates real value.' },
];

// Schematic only: positions are illustrative, distances approximate.
const MAP_TOWNS = [
  { name: 'Sanaur', x: 58, y: 56 },
  { name: 'Bahadurgarh', x: 55, y: 38 },
  { name: 'Rajpura', x: 80, y: 30 },
  { name: 'Ghanaur', x: 85, y: 52 },
  { name: 'Nabha', x: 20, y: 30 },
  { name: 'Samana', x: 30, y: 78 },
  { name: 'Patran', x: 48, y: 90 },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-forest-deep text-cream">
        <Image src={SCENES.farmerPaddyWalk.src} alt="" fill priority sizes="100vw" className="-z-20 object-cover" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(16,59,40,0.92)_0%,rgba(16,59,40,0.75)_45%,rgba(16,59,40,0.2)_100%)]" />
        <div className="container-page flex min-h-[560px] flex-col justify-center gap-6 py-20">
          <span className="inline-flex h-8 items-center gap-2 self-start rounded-full bg-cream/15 px-3 text-[13px] font-semibold text-cream">
            <MapPin className="size-[15px]" aria-hidden="true" /> Starting in Patiala, Punjab
          </span>
          <h1 className="max-w-3xl text-[clamp(2.4rem,5vw,4rem)] font-extrabold leading-[1.05] tracking-[-0.035em] text-white">
            Bridging the Gap Between Farmers and <span className="text-saffron">Opportunity.</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-on-forest">
            Every harvest represents months of hard work. AgriLink helps farmers discover buyers before harvest and helps businesses find the produce they need — building a
            more connected local agricultural marketplace.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="accent">
              <Link href="/marketplace">
                Explore the Marketplace <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outlineLight">
              <Link href="/#how-it-works">How It Works</Link>
            </Button>
          </div>
          <p className="text-sm font-semibold tracking-wide text-on-forest-muted">Starting local. Scaling smart.</p>
        </div>
      </section>

      <section className="container-page grid items-center gap-12 py-22 lg:grid-cols-[1fr_1.1fr]">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
          <Image src={SCENES.farmerHoePaddy.src} alt={SCENES.farmerHoePaddy.alt} fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
        </div>
        <div className="flex flex-col gap-5">
          <span className="eyebrow">Why AgriLink exists</span>
          <h2 className="text-[clamp(1.9rem,3vw,2.5rem)] font-extrabold text-forest-deep">The Problem Was Never the Produce. It Was the Connection.</h2>
          <p className="leading-relaxed text-[#475047]">
            Farmers around Patiala grow good crops. What is often missing is a clear view of who wants them, at what price, and when — early enough to make a considered decision.
          </p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {PROBLEMS.map((p) => (
              <li key={p.title} className="flex flex-col gap-2 rounded-lg border border-line bg-white p-4">
                <p.icon className="size-5 text-forest" aria-hidden="true" />
                <strong>{p.title}</strong>
                <span className="text-sm leading-relaxed text-muted">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="container-page flex flex-col gap-8 py-22">
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              { img: SCENES.farmerWheatHarvest, cap: 'Harvest in the field', title: 'Field', text: 'Crop planned and growing' },
              { img: SCENES.tractorTrolleyField, cap: 'On the way to market', title: 'Mandi · trader · direct buyer', text: 'Existing and new channels' },
              { img: SCENES.marketStallVegetables, cap: 'At the market stall', title: 'Kitchen, shelf, factory', text: 'Where the produce is used' },
            ].map((s) => (
              <li key={s.cap} className="flex flex-col gap-3">
                <div className="relative aspect-[3/2] overflow-hidden rounded-lg">
                  <Image src={s.img.src} alt={s.img.alt} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
                </div>
                <span className="eyebrow">{s.cap}</span>
                <strong className="text-lg">{s.title}</strong>
                <span className="text-sm text-muted">{s.text}</span>
              </li>
            ))}
          </ol>
          <div className="grid gap-3 rounded-xl border border-dashed border-saffron bg-wait-bg/50 p-6 md:grid-cols-[auto_1fr] md:items-center">
            <Badge tone="saffron">The missing link</Badge>
            <p className="font-display text-lg font-extrabold">Who wants it? At what price? When? — Weeks to decide, then days.</p>
          </div>
          <blockquote className="mx-auto max-w-3xl text-center font-display text-[clamp(1.4rem,2.4vw,1.9rem)] font-extrabold leading-snug text-forest-deep">
            “We believe farmers deserve the opportunity to find their buyers before their harvest is ready.”
          </blockquote>
        </div>
      </section>

      <section className="container-page flex flex-col gap-9 py-22">
        <div className="flex max-w-2xl flex-col gap-2.5">
          <span className="eyebrow">Our solution</span>
          <h2 className="text-[clamp(1.9rem,3vw,2.5rem)] font-extrabold text-forest-deep">A Simpler Way From Harvest to Market.</h2>
          <p className="text-[#475047]">One shared place where a farmer’s listing and a buyer’s plan meet, with every offer and agreement on record.</p>
        </div>
        <ol className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex flex-col gap-2 border-t-2 border-forest pt-4">
              <span className="text-sm font-extrabold tracking-[0.04em] text-eyebrow">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="text-xl font-extrabold text-forest-deep">{t}</h3>
              <p className="text-sm leading-relaxed text-[#475047]">{d}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/marketplace">See it in the marketplace</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/register?role=farmer">List your produce</Link>
          </Button>
        </div>
      </section>

      <section className="bg-forest text-cream">
        <div className="container-page flex flex-col gap-9 py-22">
          <div className="flex max-w-2xl flex-col gap-2.5">
            <span className="eyebrow text-on-forest-muted">Our core principles</span>
            <h2 className="text-[clamp(1.9rem,3vw,2.5rem)] font-extrabold text-white">Built Around What Matters.</h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map(([t, d], i) => (
              <li key={t} className="flex flex-col gap-2.5 rounded-lg bg-forest-deep/60 p-5">
                <span className="font-display text-2xl font-extrabold text-saffron">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="text-lg font-extrabold text-white">{t}</h3>
                <p className="text-sm leading-relaxed text-on-forest">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page grid items-start gap-12 py-22 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <span className="eyebrow">Why we start local</span>
          <h2 className="text-[clamp(1.9rem,3vw,2.5rem)] font-extrabold text-forest-deep">Rooted in Patiala. Designed to Grow.</h2>
          <p className="leading-relaxed text-[#475047]">
            A marketplace works only when buyers and sellers can actually meet. Starting with one district keeps distances short, lets pickup and delivery work with local
            transporters, and lets us learn directly from the farmers and buyers using it.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Starting crops:</span>
            {['Tomatoes', 'Potatoes', 'Onions'].map((c) => (
              <Badge key={c} tone="ok">
                {c}
              </Badge>
            ))}
          </div>
        </div>
        <figure className="flex flex-col gap-2">
          <div className="relative aspect-square w-full max-w-[460px] self-center rounded-xl border border-line bg-white" role="img" aria-label="Schematic map of the launch area: Patiala in the centre with Sanaur, Bahadurgarh, Rajpura, Ghanaur, Nabha, Samana and Patran around it, within roughly 55 km.">
            <span className="absolute left-1/2 top-1/2 size-[56%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-line-strong" aria-hidden="true" />
            <span className="absolute left-1/2 top-1/2 size-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-line" aria-hidden="true" />
            <span className="absolute left-[78%] top-[20%] text-[11px] text-muted" aria-hidden="true">~30 km</span>
            <span className="absolute left-[86%] top-[8%] text-[11px] text-muted" aria-hidden="true">~55 km</span>
            <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" aria-hidden="true">
              <span className="size-4 rounded-full border-[3px] border-white bg-forest shadow-card" />
              <strong className="text-sm">Patiala</strong>
            </span>
            {MAP_TOWNS.map((t) => (
              <span key={t.name} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5" style={{ left: `${t.x}%`, top: `${t.y}%` }} aria-hidden="true">
                <span className="size-2.5 rounded-full bg-saffron" />
                <span className="text-xs font-medium">{t.name}</span>
              </span>
            ))}
          </div>
          <figcaption className="text-center text-xs text-muted">Schematic of the launch area — distances approximate, not to scale.</figcaption>
        </figure>
      </section>

      <section className="border-t border-line bg-white">
        <div className="container-page flex flex-col gap-8 py-22">
          <span className="eyebrow">The planned path</span>
          <ol className="grid gap-4 md:grid-cols-3">
            {PHASES.map((p) => (
              <li key={p.title} className={p.current ? 'flex flex-col gap-2.5 rounded-lg border-2 border-forest bg-sage-soft p-6' : 'flex flex-col gap-2.5 rounded-lg border border-line bg-cream p-6'}>
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-eyebrow">{p.tag}</span>
                <h3 className="text-2xl font-extrabold text-forest-deep">{p.title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{p.text}</p>
                {p.note ? <p className="rounded-md bg-white p-3 text-[13px] text-muted">{p.note}</p> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative isolate overflow-hidden text-cream">
        <Image src={SCENES.combineWheatField.src} alt="" fill sizes="100vw" className="-z-20 object-cover" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-forest-deep/85" />
        <div className="container-page flex flex-col items-start gap-5 py-24">
          <span className="eyebrow text-on-forest-muted">Our vision</span>
          <h2 className="max-w-3xl text-[clamp(1.9rem,3.4vw,2.8rem)] font-extrabold text-white">A Future Where Finding a Buyer Is Part of the Harvest Plan.</h2>
          <p className="max-w-2xl leading-relaxed text-on-forest">
            We are working towards a more connected agricultural ecosystem. Farmers would discover opportunities earlier, buyers would plan procurement with more confidence, and
            clear, dated information would help both sides make better decisions.
          </p>
          <p className="max-w-2xl font-semibold text-white">It starts small, with three crops in one district. We will measure whether it helps before claiming that it does.</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="accent">
              <Link href="/register?role=farmer">List your produce</Link>
            </Button>
            <Button asChild variant="outlineLight">
              <Link href="/marketplace">Explore the Marketplace</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container-page py-20">
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-white p-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-extrabold">Talk to us</h2>
            <p className="text-muted">Farmer, buyer, FPO or transporter around Patiala? We’d like to hear from you.</p>
            <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-forest" aria-hidden="true" /> Patiala, Punjab
              </span>
              <a href={`mailto:${publicEnv.contactEmail}`} className="inline-flex items-center gap-1.5 font-semibold text-forest underline underline-offset-4">
                <Mail className="size-4" aria-hidden="true" /> {publicEnv.contactEmail}
              </a>
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/contact">Contact page</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
