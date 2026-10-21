'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="container-page flex min-h-[70vh] flex-col items-start justify-center gap-5 py-20">
      <span className="eyebrow">Something went wrong</span>
      <h1 className="text-[clamp(2rem,4vw,2.8rem)] font-extrabold text-forest-deep">We couldn’t load this page</h1>
      <p className="max-w-lg text-lg text-muted">
        This is usually temporary. Try again, or go back to the marketplace.
        {error.digest ? <span className="mt-2 block text-sm">Reference: {error.digest}</span> : null}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="secondary">
          <Link href="/marketplace">Explore produce</Link>
        </Button>
      </div>
    </main>
  );
}
