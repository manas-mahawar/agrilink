import type { Metadata } from 'next';
import { LegalPage } from '@/components/site/legal-page';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Privacy notice', description: 'What AgriLink collects, why, who can see it and how to ask for it to be deleted.' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" updated="21 October 2026">
      <h2>What we collect</h2>
      <ul>
        <li>Account details: email address, name, account type (farmer or buyer), and optionally organisation, buyer type, district and village.</li>
        <li>Your mobile number, if you add it to your profile.</li>
        <li>What you post: listings, photos, offers, messages on offers, orders, ratings and reports.</li>
        <li>Technical data needed to keep you signed in and the site secure (session cookies, IP address in server logs).</li>
      </ul>
      <h2>Who can see what</h2>
      <ul>
        <li>Anyone can see a farmer’s public profile (name, district, village, bio) and their active listings.</li>
        <li>Your mobile number and email are never shown publicly. They are shared only with the other party of an order, and only after the farmer confirms that order.</li>
        <li>An exact farm address is never collected or shown. Listings show the village or town and an approximate distance from Patiala.</li>
        <li>Offers and orders are visible only to the buyer and farmer involved, and to AgriLink administrators for support and moderation.</li>
        <li>Reports are seen only by the person who sent them and by administrators. The reported person is not told who reported them.</li>
      </ul>
      <h2>Photos</h2>
      <p>Uploaded photos are re-encoded on our server, which removes embedded location (GPS) and camera data before they are stored.</p>
      <h2>Where data is stored</h2>
      <p>Data is stored with our database and hosting providers (Supabase and Vercel). Administrator actions are recorded in an audit log.</p>
      <h2>Payments</h2>
      <p>AgriLink does not process payments today and does not collect card or bank details.</p>
      <h2>Your choices</h2>
      <p>
        You can edit your profile at any time from your dashboard. To ask for a copy of your data or for your account to be deleted, email{' '}
        <a className="font-semibold text-forest underline" href={`mailto:${publicEnv.contactEmail}`}>
          {publicEnv.contactEmail}
        </a>
        . Records of completed orders may be kept where needed to resolve disputes.
      </p>
    </LegalPage>
  );
}
