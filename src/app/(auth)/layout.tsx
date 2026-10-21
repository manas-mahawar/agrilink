import Link from 'next/link';
import { FullLogo } from '@/components/site/logo';
import { EnvironmentBanner } from '@/components/site/environment-banner';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <EnvironmentBanner />
      <header className="container-page flex h-[76px] items-center justify-between">
        <Link href="/" aria-label="AgriLink home" className="rounded-md">
          <FullLogo priority className="w-[150px]" />
        </Link>
        <Link href="/marketplace" className="inline-flex min-h-10 items-center text-sm font-semibold text-forest hover:underline">
          Explore produce
        </Link>
      </header>
      <main id="main" className="container-page flex flex-1 items-start justify-center pb-16 pt-4 lg:items-center">
        {children}
      </main>
    </div>
  );
}
