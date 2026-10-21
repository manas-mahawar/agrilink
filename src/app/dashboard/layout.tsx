import type { Metadata } from 'next';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { EnvironmentBanner } from '@/components/site/environment-banner';
import { SiteHeader } from '@/components/site/site-header';
import { Notice } from '@/components/ui/primitives';
import { OPEN_OFFER_STATUSES } from '@/domain/offers';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/server/auth';
import { countUnreadNotifications } from '@/server/data/dashboard';

export const metadata: Metadata = { title: { default: 'Dashboard', template: '%s · AgriLink dashboard' }, robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/dashboard');
  const supabase = await createClient();
  // Offers waiting on this user: pending ones for farmers, countered ones for buyers.
  const [unread, { count: openOffers }] = await Promise.all([
    countUnreadNotifications(),
    supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq(user.accountType === 'farmer' ? 'farmer_id' : 'buyer_id', user.id)
      .eq('status', user.accountType === 'farmer' ? OPEN_OFFER_STATUSES[0] : OPEN_OFFER_STATUSES[1])
      .gt('expires_at', new Date().toISOString()),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <EnvironmentBanner />
      <SiteHeader />
      <div className="container-page grid flex-1 gap-6 py-6 lg:grid-cols-[232px_1fr] lg:gap-10 lg:py-10">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="mb-3 hidden lg:block">
            <p className="truncate font-display text-lg font-extrabold">{user.organisationName || user.displayName}</p>
            <p className="text-sm capitalize text-muted">
              {user.accountType} account{user.isDemo ? ' · demo' : ''}
            </p>
          </div>
          <DashboardNav accountType={user.accountType} isAdmin={user.isAdmin} unread={unread} openOffers={openOffers ?? 0} />
        </aside>
        <main id="main" className="flex min-w-0 flex-col gap-6">
          {user.suspendedAt ? (
            <Notice tone="danger" title="Your account is suspended">
              You can view your history, but you can’t create listings, make offers or change orders. Contact AgriLink support if you think this is a mistake.
            </Notice>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
