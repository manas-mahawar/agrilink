import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DemoSignIn, LoginForm } from '@/components/auth/auth-forms';
import { AuthShell } from '@/components/auth/auth-shell';
import { Notice } from '@/components/ui/primitives';
import { SCENES } from '@/content/images';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';
import { safeNextPath } from '@/lib/utils';
import { dashboardHome, getSessionUser } from '@/server/auth';
import { serverEnv } from '@/server/env';

export const metadata: Metadata = { title: 'Log in', robots: { index: false } };

const ERRORS: Record<string, string> = {
  link_expired: 'That link has expired or was already used. Log in, or request a new link.',
  link_invalid: 'That link is not valid. Log in, or request a new link.',
  unavailable: 'Accounts are not available in this preview.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = rawNext ? safeNextPath(rawNext) : undefined;
  const user = await getSessionUser();
  if (user) redirect(next ?? dashboardHome(user));
  const demo = publicEnv.demoMode && Boolean(serverEnv.demoAccountPassword) && isSupabaseConfigured;

  return (
    <AuthShell
      image={SCENES.womanFarmerCrop}
      quote="Find the buyer before the produce becomes a distress sale."
      title="Log in to AgriLink"
      description={
        <>
          New here?{' '}
          <Link href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'} className="font-semibold text-forest underline">
            Create an account
          </Link>
        </>
      }
    >
      {error && ERRORS[error] ? <Notice tone="warn">{ERRORS[error]}</Notice> : null}
      {!isSupabaseConfigured ? (
        <Notice tone="info" title="Preview mode">
          Accounts switch on once the site is connected to Supabase. You can still browse the marketplace.
        </Notice>
      ) : null}
      {demo ? <DemoSignIn /> : null}
      <LoginForm next={next} />
    </AuthShell>
  );
}
