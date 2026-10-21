import { ArrowLeft, BadgeCheck, CalendarDays, CircleSlash, MapPin, Package, Scale, ShieldCheck, Sprout } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Gallery } from '@/components/marketplace/gallery';
import { ListingCard, listingTitle } from '@/components/marketplace/listing-card';
import { OfferPanel } from '@/components/marketplace/offer-panel';
import { AskingPrice, UnitTip } from '@/components/marketplace/price';
import { ReportButton } from '@/components/marketplace/report-button';
import { SavedListingsProvider, SaveButton } from '@/components/marketplace/saved-listings';
import { InfoTip } from '@/components/ui/overlays';
import { Badge, Card } from '@/components/ui/primitives';
import { AVAILABILITY_LABEL, QUALITY_LABEL } from '@/domain/listings';
import { formatQuantity } from '@/domain/units';
import { formatDate, harvestLabel, initials } from '@/lib/utils';
import { getPublicListing, getSimilarListings } from '@/server/data/catalog';

export const revalidate = 120;

type Props = { params: Promise<{ listingId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listingId } = await params;
  const l = await getPublicListing(listingId);
  if (!l) return { title: 'Listing not found' };
  const title = `${listingTitle(l)} from ${l.localityName}`;
  return {
    title,
    description: `${formatQuantity(l.quantityAvailable, l.unit)} of ${l.produceName.toLowerCase()} from ${l.farmer.displayName} near ${l.localityName}, ${l.district}.`,
    alternates: { canonical: `/marketplace/${l.id}` },
    robots: l.isDemo ? { index: false } : undefined,
  };
}

export default async function ListingPage({ params }: Props) {
  const { listingId } = await params;
  const listing = await getPublicListing(listingId);
  if (!listing) notFound();
  const similar = await getSimilarListings(listing);
  const title = listingTitle(listing);
  const farmer = listing.farmer;

  return (
    <SavedListingsProvider>
      <div className="container-page flex flex-col gap-8 pb-20 pt-8">
        <nav aria-label="Breadcrumb" className="text-sm">
          <Link href="/marketplace" className="inline-flex min-h-10 items-center gap-1.5 font-medium text-forest hover:underline">
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to all produce
          </Link>
        </nav>

        {listing.isDemo ? (
          <div className="rounded-lg border border-ink/15 bg-ink px-4 py-3 text-sm text-cream">
            <strong>Demo listing.</strong> This farmer, crop and price are illustrative sample data, shown so you can see how AgriLink works.
          </div>
        ) : null}

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)] lg:gap-10">
          <div className="flex min-w-0 flex-col gap-8">
            <Gallery images={listing.images} categoryId={listing.categoryId} title={title} />

            <section aria-labelledby="facts-heading" className="flex flex-col gap-4">
              <h2 id="facts-heading" className="text-xl font-extrabold">
                Crop details
              </h2>
              <dl className="grid gap-x-6 gap-y-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-2">
                <Fact icon={Package} label="Available now">
                  <span className="tabular">
                    {formatQuantity(listing.quantityAvailable, listing.unit)} of {formatQuantity(listing.quantityTotal, listing.unit)}
                  </span>{' '}
                  <UnitTip unit={listing.unit} />
                </Fact>
                <Fact icon={Scale} label="Order size">
                  <span className="tabular">
                    {formatQuantity(listing.minOrderQty, listing.unit)}
                    {listing.maxOrderQty ? ` to ${formatQuantity(listing.maxOrderQty, listing.unit)}` : ' minimum'}
                  </span>
                </Fact>
                <Fact icon={CalendarDays} label={listing.availabilityType === 'pre_harvest' ? 'Expected harvest' : 'Availability'}>
                  {listing.expectedHarvestDate ? `${formatDate(listing.expectedHarvestDate)} (${harvestLabel(listing.expectedHarvestDate)})` : AVAILABILITY_LABEL[listing.availabilityType]}
                  {listing.availableUntil ? <span className="block text-[13px] text-muted">Available until {formatDate(listing.availableUntil)}</span> : null}
                </Fact>
                <Fact icon={MapPin} label="Location">
                  {listing.localityName}, {listing.district} · ~{listing.kmFromPatiala} km from Patiala
                  <span className="block text-[13px] text-muted">Exact farm location is shared only after an order is confirmed.</span>
                </Fact>
                <Fact icon={Sprout} label="Declared quality">
                  {QUALITY_LABEL[listing.qualityGrade]}
                  <span className="block text-[13px] text-muted">Declared by the farmer, not inspected by AgriLink.</span>
                </Fact>
                <Fact icon={ShieldCheck} label="Listing type">
                  {AVAILABILITY_LABEL[listing.availabilityType]}
                </Fact>
              </dl>
            </section>

            {listing.description || listing.qualityNotes ? (
              <section aria-labelledby="about-heading" className="flex flex-col gap-3">
                <h2 id="about-heading" className="text-xl font-extrabold">
                  From the farmer
                </h2>
                {listing.description ? <p className="whitespace-pre-line leading-relaxed text-ink-soft">{listing.description}</p> : null}
                {listing.qualityNotes ? (
                  <div className="rounded-lg border border-line bg-paper p-4">
                    <strong className="text-sm">Quality notes</strong>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{listing.qualityNotes}</p>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section aria-labelledby="terms-heading" className="flex flex-col gap-3">
              <h2 id="terms-heading" className="text-xl font-extrabold">
                How a deal works
              </h2>
              <ol className="flex flex-col gap-2.5 text-[15px] text-ink-soft">
                {[
                  'You send an offer with quantity, price per unit and pickup or delivery.',
                  'The farmer accepts, declines or counters. Offers stay open for 7 days.',
                  'When an offer is accepted, the quantity is reserved and an order is created.',
                  'The farmer confirms a pickup or delivery date. Phone numbers are shared with both sides at that point.',
                  'Payment is agreed directly between you. AgriLink does not handle money yet.',
                ].map((t, i) => (
                  <li key={t} className="grid grid-cols-[28px_1fr] gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-sage text-xs font-bold text-forest">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
            <Card className="flex flex-col gap-5 p-5 sm:p-6">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{listing.categoryName}</Badge>
                  <Badge tone={listing.availabilityType === 'ready_now' ? 'ok' : 'wait'}>{AVAILABILITY_LABEL[listing.availabilityType]}</Badge>
                  {listing.status === 'sold_out' ? <Badge tone="danger">Sold out</Badge> : null}
                </div>
                <h1 className="text-[clamp(1.6rem,2.6vw,2.1rem)] font-extrabold leading-tight text-forest-deep">{title}</h1>
                <p className="text-sm text-muted">
                  {listing.localityName}, {listing.district}
                </p>
              </div>
              <AskingPrice pricePerUnitPaise={listing.pricePerUnitPaise} unit={listing.unit} size="lg" />
              <MandiPanel />
              <div className="border-t border-line pt-5">
                <h2 className="mb-3 text-lg font-extrabold">Make an offer</h2>
                <OfferPanel
                  listing={{
                    id: listing.id,
                    farmerId: listing.farmerId,
                    unit: listing.unit,
                    pricePerUnitPaise: listing.pricePerUnitPaise,
                    quantityAvailable: listing.quantityAvailable,
                    minOrderQty: listing.minOrderQty,
                    maxOrderQty: listing.maxOrderQty,
                    status: listing.status,
                    isDemo: listing.isDemo,
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                <SaveButton listingId={listing.id} title={title} variant="inline" />
                <ReportButton listingId={listing.id} />
              </div>
            </Card>

            <Card className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sage font-display text-lg font-extrabold text-forest" aria-hidden="true">
                  {initials(farmer.displayName)}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.06em] text-muted">Farmer</p>
                  <p className="truncate text-lg font-extrabold">{farmer.displayName}</p>
                  <p className="text-sm text-muted">
                    {[farmer.village, farmer.district].filter(Boolean).join(', ') || listing.district} · on AgriLink since {formatDate(farmer.memberSince)}
                  </p>
                </div>
              </div>
              {farmer.verifiedAt ? (
                <p className="flex items-start gap-2 text-sm text-ok-fg">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {farmer.isDemo ? 'Shown as verified in this demo (sample data — no real check took place).' : `Identity and farm checked by AgriLink on ${formatDate(farmer.verifiedAt)}.`}
                </p>
              ) : (
                <p className="flex items-start gap-2 text-sm text-muted">
                  <CircleSlash className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> Not yet verified by AgriLink.
                </p>
              )}
              <Link href={`/farmers/${farmer.id}`} className="inline-flex min-h-10 items-center text-sm font-semibold text-forest underline underline-offset-4">
                View farmer profile and other listings
              </Link>
            </Card>
          </aside>
        </div>

        {similar.length ? (
          <section aria-labelledby="similar-heading" className="flex flex-col gap-5 border-t border-line pt-10">
            <h2 id="similar-heading" className="text-2xl font-extrabold text-forest-deep">
              Similar produce nearby
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </SavedListingsProvider>
  );
}

function Fact({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[22px_1fr] gap-2.5">
      <Icon className="mt-0.5 size-[18px] text-forest" aria-hidden="true" />
      <div>
        <dt className="text-[13px] font-semibold text-muted">{label}</dt>
        <dd className="text-[15px]">{children}</dd>
      </div>
    </div>
  );
}

function MandiPanel() {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-line-strong bg-paper p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-wait-fg">
          Mandi reference
          <InfoTip label="About mandi reference prices">
            The modal price reported for a nearby regulated market on a specific date. AgriLink shows it only when a dated figure from AGMARKNET or data.gov.in is
            connected — it never estimates one.
          </InfoTip>
        </span>
        <Badge tone="neutral">Not connected yet</Badge>
      </div>
      <p className="text-sm text-muted">No sourced mandi price is available for this crop yet, so none is shown.</p>
    </div>
  );
}
