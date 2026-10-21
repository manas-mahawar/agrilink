import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: 'AgriLink — Find the buyer before the produce becomes a distress sale',
    template: '%s · AgriLink',
  },
  description:
    'AgriLink is a pre-harvest marketplace for Patiala, Punjab. Farmers list tomatoes, potatoes and onions before harvest; retailers, restaurants, hotels and processors find local supply and agree terms early.',
  applicationName: 'AgriLink',
  openGraph: {
    type: 'website',
    siteName: 'AgriLink',
    locale: 'en_IN',
    title: 'AgriLink — pre-harvest produce marketplace for Patiala',
    description: 'Farmers find buyers before harvest. Buyers plan supply with nearby growers.',
  },
  robots: publicEnv.demoMode ? { index: false, follow: false } : undefined,
};

export const viewport: Viewport = {
  themeColor: '#174c32',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body className="min-h-dvh bg-cream text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-forest focus:shadow-lift"
        >
          Skip to content
        </a>
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            classNames: {
              toast: 'rounded-lg border-0 bg-ink text-cream shadow-pop font-sans text-sm',
              description: 'text-cream/80',
              error: 'bg-[#5c1d16]',
            },
          }}
        />
      </body>
    </html>
  );
}
