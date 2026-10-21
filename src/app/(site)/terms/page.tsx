import type { Metadata } from 'next';
import { LegalPage } from '@/components/site/legal-page';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Terms of use', description: 'The rules for using AgriLink as a farmer or buyer during the Patiala pilot.' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="21 October 2026">
      <h2>What AgriLink is</h2>
      <p>
        AgriLink is a listing and negotiation platform that connects farmers and buyers around Patiala, Punjab. AgriLink is not a party to any sale, does not buy or sell
        produce, and does not guarantee quality, quantity, delivery or payment.
      </p>
      <h2>Accounts</h2>
      <ul>
        <li>You must give accurate information and keep your password safe.</li>
        <li>Farmer accounts list produce; buyer accounts make offers. An account has one type.</li>
        <li>We may suspend accounts that break these terms, post misleading listings or abuse other users.</li>
      </ul>
      <h2>Listings and quality</h2>
      <ul>
        <li>Quality grades and descriptions are declared by the farmer. AgriLink does not inspect produce.</li>
        <li>A “Verified farmer” badge means AgriLink staff checked that farmer’s identity and farm. It is not a guarantee of any particular lot.</li>
        <li>Mandi reference prices, when shown, come from public sources with a date. They are a reference, not a price offer.</li>
      </ul>
      <h2>Offers and orders</h2>
      <ul>
        <li>An offer is an invitation to agree terms. It becomes an order only when the other party accepts it on AgriLink.</li>
        <li>Accepting an offer reserves that quantity on the listing. The farmer then confirms a pickup or delivery date.</li>
        <li>Either side may cancel an order before it is completed, with a reason. Cancellations are recorded.</li>
        <li>Farmers remain free to sell unsold produce through any other channel, including the mandi.</li>
      </ul>
      <h2>Payment</h2>
      <p>Payment is agreed and settled directly between buyer and farmer. AgriLink records order status only and does not hold or transfer money.</p>
      <h2>Not allowed</h2>
      <ul>
        <li>Misleading photos, prices or quantities; listing produce you do not have or expect to have.</li>
        <li>Harassment, spam, fake offers, or attempts to access other people’s data.</li>
      </ul>
      <h2>Contact</h2>
      <p>
        Questions about these terms:{' '}
        <a className="font-semibold text-forest underline" href={`mailto:${publicEnv.contactEmail}`}>
          {publicEnv.contactEmail}
        </a>
        .
      </p>
    </LegalPage>
  );
}
