import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { PRODUCE, SCENES, type SiteImage } from '@/content/images';

export const metadata: Metadata = {
  title: 'Services',
  description: 'What AgriLink offers farmers and buyers around Patiala, with an honest status label on every service.',
};

type Status = 'available' | 'partial' | 'integration' | 'planned';
const STATUS: Record<Status, { label: string; tone: 'ok' | 'info' | 'wait' | 'neutral'; help: string }> = {
  available: { label: 'Available', tone: 'ok', help: 'works on this site with an account' },
  partial: { label: 'Partly available', tone: 'info', help: 'a basic version works; more needs an integration' },
  integration: { label: 'Needs integration', tone: 'wait', help: 'needs a data source or partner' },
  planned: { label: 'Planned', tone: 'neutral', help: 'not built yet' },
};

interface Item {
  title: string;
  status: Status;
  text: string;
  img?: SiteImage;
}
interface Group {
  n: string;
  title: string;
  text: string;
  img: SiteImage;
  band: string;
  items: Item[];
}

const GROUPS: Group[] = [
  {
    n: '01',
    title: 'For farmers',
    text: 'Find buyers while the crop is still in the field, and decide with more information.',
    img: SCENES.womenFarmersLeafy,
    band: 'bg-white',
    items: [
      { title: 'Pre-harvest listings', status: 'available', img: PRODUCE.tomatoPlantsField, text: 'List the crop, expected quantity in kg, quintals or tonnes, order range, asking price, harvest date, village, declared quality and up to six photos.' },
      { title: 'Offer comparison', status: 'available', text: 'See every offer on a listing side by side, compared with your asking price.' },
      { title: 'Negotiation', status: 'available', text: 'Accept, decline or counter on price and quantity. Every revision is kept in the offer history.' },
      { title: 'Order tracking', status: 'available', text: 'Follow each order from Pending confirmation to Confirmed, Preparing, Ready and Completed, with the buyer’s rating at the end.' },
    ],
  },
  {
    n: '02',
    title: 'For buyers',
    text: 'Retailers, restaurants, hotels, wholesalers and processors can plan supply with nearby growers.',
    img: SCENES.marketChilliesBuyer,
    band: 'bg-cream',
    items: [
      { title: 'Produce discovery', status: 'available', img: SCENES.marketStallVegetables, text: 'Search and filter by crop, village, distance from Patiala, asking price, available quantity and harvest window.' },
      { title: 'Purchase planning', status: 'available', text: 'Save listings to your dashboard and come back to them as harvest dates approach.' },
      { title: 'Offers and counteroffers', status: 'available', text: 'Offer on the quantity you need. Nothing is binding until both sides agree the same terms.' },
      { title: 'Supplier profiles', status: 'available', text: 'Check a farmer’s village, verification status, declared quality, completed orders and ratings before you commit.' },
    ],
  },
  {
    n: '03',
    title: 'Supporting services',
    text: 'What still needs a data source, a partner or more work before AgriLink can offer it fully.',
    img: SCENES.tractorTrolleyField,
    band: 'bg-white',
    items: [
      { title: 'Mandi price reference', status: 'integration', img: SCENES.vegetableMarketStreet, text: 'Dated modal prices for nearby mandis from AGMARKNET or data.gov.in, shown beside listings with the market, date, unit and source. Until connected, listings say “Not connected yet”.' },
      { title: 'Verified accounts', status: 'partial', text: 'AgriLink staff can mark a farmer as verified after checking them, and the badge shows only then. Phone OTP and document checks still need an integration.' },
      { title: 'Logistics coordination', status: 'planned', img: SCENES.potatoSacksTransport, text: 'Pickup and delivery arranged with local transporters once an order is confirmed. No partners are in place yet.' },
      { title: 'FPO onboarding', status: 'planned', text: 'Farmer Producer Organisations helping members list crops and pool supply.' },
      { title: 'Payments', status: 'planned', text: 'Payment is settled directly between buyer and farmer today. AgriLink does not take or hold money; online payment will only be added with a licensed payment provider.' },
    ],
  },
];

export default function ServicesPage() {
  return (
    <>
      <section className="container-page flex flex-col gap-6 pb-14 pt-14">
        <span className="eyebrow">Services</span>
        <h1 className="max-w-3xl text-[clamp(2.2rem,4.4vw,3.4rem)] font-extrabold leading-[1.06] text-forest-deep">Everything a pre-harvest deal needs, in one place.</h1>
        <p className="max-w-2xl text-lg text-[#475047]">
          What AgriLink offers farmers and buyers around Patiala — with a plain label on each service showing whether it works today or still needs a data source or partner.
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          {(Object.keys(STATUS) as Status[]).map((s) => (
            <li key={s} className="flex items-center gap-2">
              <Badge tone={STATUS[s].tone}>{STATUS[s].label}</Badge> {STATUS[s].help}
            </li>
          ))}
        </ul>
      </section>

      {GROUPS.map((g) => (
        <section key={g.n} aria-labelledby={`grp-${g.n}`} className={`${g.band} border-t border-line`}>
          <div className="container-page grid gap-10 py-18 lg:grid-cols-[360px_1fr]">
            <div className="flex flex-col gap-4">
              <span className="font-display text-3xl font-extrabold text-wait-fg">{g.n}</span>
              <h2 id={`grp-${g.n}`} className="text-3xl font-extrabold text-forest-deep">
                {g.title}
              </h2>
              <p className="text-[#475047]">{g.text}</p>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Image src={g.img.src} alt={g.img.alt} fill sizes="(min-width: 1024px) 360px, 100vw" className="object-cover" />
              </div>
            </div>
            <ul className="grid content-start gap-4 sm:grid-cols-2">
              {g.items.map((it) => (
                <li key={it.title} className="flex flex-col overflow-hidden rounded-lg border border-line bg-white">
                  {it.img ? (
                    <div className="relative aspect-[16/9]">
                      <Image src={it.img.src} alt={it.img.alt} fill sizes="(min-width: 1024px) 380px, 100vw" className="object-cover" />
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2.5 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-extrabold">{it.title}</h3>
                      <Badge tone={STATUS[it.status].tone}>{STATUS[it.status].label}</Badge>
                    </div>
                    <p className="text-sm leading-relaxed text-muted">{it.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section className="container-page grid gap-5 border-t border-line py-20 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-4 rounded-xl bg-forest-deep p-10 text-cream">
          <span className="eyebrow text-on-forest-muted">Farmers</span>
          <h2 className="text-[28px] font-extrabold text-white">List your crop before it’s harvested</h2>
          <Button asChild variant="accent">
            <Link href="/register?role=farmer">List Your Produce</Link>
          </Button>
        </div>
        <div className="flex flex-col items-start gap-4 rounded-xl bg-wait-bg p-10">
          <span className="eyebrow text-wait-fg">Buyers</span>
          <h2 className="text-[28px] font-extrabold">Find produce for the weeks ahead</h2>
          <Button asChild>
            <Link href="/marketplace">Explore Produce</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
