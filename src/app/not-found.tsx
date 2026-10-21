import Link from 'next/link';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="container-page flex flex-1 flex-col items-start justify-center gap-5 py-20">
        <span className="font-display text-7xl font-extrabold text-wait-fg">404</span>
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-forest-deep">Page not found</h1>
        <p className="max-w-lg text-lg text-muted">This page doesn’t exist, or the listing is no longer available.</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/">Go to home</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/marketplace">Explore produce</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
