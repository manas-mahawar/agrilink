import type { Metadata } from 'next';
import Link from 'next/link';
import { EnvironmentBanner } from '@/components/site/environment-banner';
import { SiteHeader } from '@/components/site/site-header';
import { requireAdmin } from '@/server/auth';

export const metadata: Metadata = { title: { default: 'Administration', template: '%s · AgriLink admin' }, robots: { index: false, follow: false } };

const NAV = [
  ['/admin', 'Overview'],
  ['/admin/reports', 'Reports'],
  ['/admin/listings', 'Listings'],
  ['/admin/users', 'Users'],
  ['/admin/orders', 'Orders'],
  ['/admin/audit', 'Audit log'],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-dvh flex-col">
      <EnvironmentBanner />
      <SiteHeader />
      <div className="border-b border-line bg-ink text-cream">
        <nav aria-label="Administration" className="container-page flex gap-1 overflow-x-auto py-2">
          <span className="mr-3 inline-flex min-h-10 shrink-0 items-center text-xs font-bold uppercase tracking-[0.08em] text-saffron">Admin</span>
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="inline-flex min-h-10 shrink-0 items-center rounded-md px-3 text-sm font-medium text-cream/90 hover:bg-white/10">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <main id="main" className="container-page flex flex-1 flex-col gap-6 py-8">
        {children}
      </main>
    </div>
  );
}
