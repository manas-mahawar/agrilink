import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@/content/images';
import { publicEnv } from '@/lib/env';

const COLUMNS = [
  {
    title: 'Marketplace',
    links: [
      { href: '/marketplace', label: 'Explore Produce' },
      { href: '/register?role=farmer', label: 'List Your Produce' },
      { href: '/#how-it-works', label: 'How It Works' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/services', label: 'Services' },
      { href: '/contact', label: 'Contact' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-forest-deep text-[#c9d6c4]">
      <div className="container-page grid gap-8 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Link href="/" aria-label="AgriLink home" className="inline-flex self-start rounded-xl bg-cream px-[18px] py-3.5">
            <Image src={BRAND.logoFull.src} width={BRAND.logoFull.width} height={BRAND.logoFull.height} alt="" className="h-auto w-[248px] max-w-full object-contain" />
          </Link>
          <p className="max-w-sm text-sm">
            A pre-harvest marketplace for farmers and buyers in and around Patiala, Punjab. Find the buyer before the produce becomes a
            distress sale.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2.5">
            <strong className="text-sm text-white">{col.title}</strong>
            {col.links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm hover:text-white hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="container-page flex flex-wrap justify-between gap-2 border-t border-white/10 py-6 text-[13px]">
        <span>© {new Date().getFullYear()} AgriLink · Patiala, Punjab · {publicEnv.contactEmail}</span>
        <span>Prices in ₹ · Illustrative photos from Unsplash</span>
      </div>
    </footer>
  );
}
