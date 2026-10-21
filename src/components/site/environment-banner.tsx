import Link from 'next/link';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';

/** Makes the environment obvious: preview (no database) or demo (seeded sample data). */
export function EnvironmentBanner() {
  if (!isSupabaseConfigured) {
    return (
      <div className="bg-wait-bg text-wait-fg">
        <p className="container-page py-2 text-[13px]">
          <strong>Preview mode.</strong> Not connected to a database yet — listings shown are illustrative demo data and accounts are
          disabled. See the README to connect Supabase.
        </p>
      </div>
    );
  }
  if (!publicEnv.demoMode) return null;
  return (
    <div className="bg-forest-deep text-[#e9efe4]">
      <p className="container-page py-2 text-[13px]">
        <strong>Demo environment.</strong> Farmers, buyers, listings and prices here are illustrative sample data, not real trades.{' '}
        <Link href="/login" className="font-semibold text-[#f3d08a] underline underline-offset-2">
          Explore as a demo farmer or buyer
        </Link>
      </p>
    </div>
  );
}
