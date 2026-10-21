import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/auth/auth-forms';
import { AuthShell } from '@/components/auth/auth-shell';
import { Notice } from '@/components/ui/primitives';
import { SCENES } from '@/content/images';
import { isSupabaseConfigured } from '@/lib/env';
import { safeNextPath } from '@/lib/utils';
import { dashboardHome, getSessionUser } from '@/server/auth';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string; next?: string }> }) {
  const { role, next: rawNext } = await searchParams;
  const next = rawNext ? safeNextPath(rawNext) : undefined;
  const user = await getSessionUser();
  if (user) redirect(next ?? dashboardHome(user));
  return (
    <AuthShell
      image={SCENES.farmerTractorField}
      quote="List your crop while it is still in the field."
      title="Create your AgriLink account"
      description={
        <>
          Already registered?{' '}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-semibold text-forest underline">
            Log in
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured ? (
        <Notice tone="info" title="Preview mode">
          Registration switches on once the site is connected to Supabase.
        </Notice>
      ) : null}
      <RegisterForm initialRole={role === 'farmer' ? 'farmer' : 'buyer'} next={next} />
    </AuthShell>
  );
}
