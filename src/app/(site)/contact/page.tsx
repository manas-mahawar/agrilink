import { Mail, MapPin, Sprout, Store, Truck, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with AgriLink — farmers, buyers, FPOs and transporters around Patiala, Punjab.',
};

const WHO = [
  { icon: Sprout, title: 'Farmers', text: 'Questions about listing a crop, verification, or how offers work.' },
  { icon: Store, title: 'Buyers', text: 'Retailers, restaurants, hotels, wholesalers and processors planning supply.' },
  { icon: Users, title: 'FPOs', text: 'Farmer Producer Organisations interested in helping members list crops.' },
  { icon: Truck, title: 'Transporters', text: 'Local transport operators interested in pickup and delivery.' },
];

export default function ContactPage() {
  const email = publicEnv.contactEmail;
  return (
    <div className="container-page flex flex-col gap-10 pb-20 pt-14">
      <div className="flex max-w-2xl flex-col gap-3">
        <span className="eyebrow">Contact</span>
        <h1 className="text-[clamp(2.2rem,4vw,3.2rem)] font-extrabold leading-[1.06] text-forest-deep">Talk to us</h1>
        <p className="text-lg text-[#475047]">Farmer, buyer, FPO or transporter around Patiala? We’d like to hear from you. Email is the best way to reach us during the pilot.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card className="flex flex-col gap-5 p-7">
          <a href={`mailto:${email}`} className="group flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sage text-forest">
              <Mail className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm text-muted">Email</span>
              <span className="break-all text-lg font-bold text-forest underline-offset-4 group-hover:underline">{email}</span>
            </span>
          </a>
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sage text-forest">
              <MapPin className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm text-muted">Based in</span>
              <span className="text-lg font-bold">Patiala, Punjab</span>
            </span>
          </div>
          <Button asChild>
            <a href={`mailto:${email}?subject=${encodeURIComponent('AgriLink enquiry')}`}>Write an email</a>
          </Button>
          <p className="text-sm text-muted">
            To report a listing or a person, use the “Report” link on the listing or profile — it goes straight to the moderation queue. See also our{' '}
            <Link href="/privacy" className="font-semibold text-forest underline">
              privacy notice
            </Link>
            .
          </p>
        </Card>
        <ul className="grid gap-4 sm:grid-cols-2">
          {WHO.map((w) => (
            <li key={w.title} className="flex flex-col gap-2 rounded-lg border border-line bg-white p-5">
              <w.icon className="size-5 text-forest" aria-hidden="true" />
              <strong>{w.title}</strong>
              <span className="text-sm text-muted">{w.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
