import { BadgeCheck, CircleSlash, MapPin, Sprout, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListingCard } from '@/components/marketplace/listing-card';
import { ReportButton } from '@/components/marketplace/report-button';
import { SavedListingsProvider } from '@/components/marketplace/saved-listings';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';
import { formatDate, initials } from '@/lib/utils';
import { getFarmerPage, getPublicFarmer } from '@/server/data/catalog';

export const revalidate = 300;

type Props = { params: Promise<{ farmerId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { farmerId } = await params;
  const f = await getPublicFarmer(farmerId);
  if (!f) return { title: 'Farmer not found' };
  return {
    title: `${f.displayName} — farmer near ${f.district ?? 'Patiala'}`,
    description: `Produce listed on AgriLink by ${f.displayName}${f.village ? `, ${f.village}` : ''}.`,
    robots: f.isDemo ? { index: false } : undefined,
  };
}

export default async function FarmerPage({ params }: Props) {
  const { farmerId } = await params;
  const page = await getFarmerPage(farmerId);
  if (!page) notFound();
  const { farmer, listings, stats } = page;
  const place = [farmer.village, farmer.district].filter(Boolean).join(', ');

  return (
    <div className="container-page flex flex-col gap-8 pb-20 pt-10">
      {farmer.isDemo ? (
        <div className="rounded-lg bg-ink px-4 py-3 text-sm text-cream">
          <strong>Demo profile.</strong> This farmer is illustrative sample data, not a real person.
        </div>
      ) : null}
      <Card className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
        <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-sage font-display text-2xl font-extrabold text-forest" aria-hidden="true">
          {initials(farmer.displayName)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[clamp(1.7rem,3vw,2.3rem)] font-extrabold text-forest-deep">{farmer.displayName}</h1>
            {farmer.verifiedAt ? (
              <Badge tone="ok">
                <BadgeCheck aria-hidden="true" /> {farmer.isDemo ? 'Verified · demo' : 'Verified farmer'}
              </Badge>
            ) : (
              <Badge tone="neutral">
                <CircleSlash aria-hidden="true" /> Not yet verified
              </Badge>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {place ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden="true" /> {place}
              </span>
            ) : null}
            <span>On AgriLink since {formatDate(farmer.memberSince)}</span>
          </p>
          {farmer.bio ? <p className="max-w-2xl whitespace-pre-line leading-relaxed text-ink-soft">{farmer.bio}</p> : null}
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-3 sm:w-64">
          <div className="rounded-lg bg-paper p-3">
            <dt className="text-xs text-muted">Completed orders</dt>
            <dd className="tabular font-display text-2xl font-extrabold">{stats.completedOrders}</dd>
          </div>
          <div className="rounded-lg bg-paper p-3">
            <dt className="text-xs text-muted">Buyer rating</dt>
            <dd className="tabular font-display text-2xl font-extrabold">
              {stats.ratingAverage !== null && stats.ratingCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  {stats.ratingAverage.toFixed(1)} <Star className="size-4 fill-saffron text-saffron" aria-label="out of 5" />
                </span>
              ) : (
                <span className="text-base font-semibold text-muted">No ratings yet</span>
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <section aria-labelledby="farmer-listings" className="flex flex-col gap-5">
        <h2 id="farmer-listings" className="text-2xl font-extrabold text-forest-deep">
          Current listings
        </h2>
        {listings.length ? (
          <SavedListingsProvider>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </SavedListingsProvider>
        ) : (
          <EmptyState icon={<Sprout />} title="No active listings right now">
            Check back later, or{' '}
            <Link href="/marketplace" className="font-semibold text-forest underline">
              browse other produce
            </Link>
            .
          </EmptyState>
        )}
      </section>

      {stats.recentReviews.length ? (
        <section aria-labelledby="farmer-reviews" className="flex flex-col gap-4">
          <h2 id="farmer-reviews" className="text-2xl font-extrabold text-forest-deep">
            Ratings from completed orders
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {stats.recentReviews.map((r, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-lg border border-line bg-white p-4">
                <span className="flex items-center gap-0.5" aria-label={`${r.rating} out of 5`}>
                  {Array.from({ length: 5 }, (_, s) => (
                    <Star key={s} className={s < r.rating ? 'size-4 fill-saffron text-saffron' : 'size-4 text-line-strong'} aria-hidden="true" />
                  ))}
                </span>
                {r.comment ? <p className="text-sm text-ink-soft">{r.comment}</p> : null}
                <span className="text-xs text-muted">{formatDate(r.createdAt)} · verified order</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div>
        <ReportButton userId={farmer.id} label="Report this profile" />
      </div>
    </div>
  );
}
