import 'server-only';
// Data Access Layer for the current user. Every protected page, action and route handler
// calls one of these; hiding UI is never treated as security.
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { isSupabaseConfigured, storagePublicUrl } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export interface SessionUser {
  id: string;
  email: string | null;
  accountType: 'farmer' | 'buyer';
  displayName: string;
  organisationName: string | null;
  district: string | null;
  verifiedAt: string | null;
  suspendedAt: string | null;
  isDemo: boolean;
  isAdmin: boolean;
  avatarUrl: string | null;
}

/** The signed-in user, validated against Supabase Auth (JWT signature and expiry). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  const [{ data: profile }, { data: admin }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, account_type, display_name, organisation_name, district, verified_at, suspended_at, is_demo, avatar_path')
      .eq('id', sub)
      .maybeSingle(),
    supabase.rpc('is_admin'),
  ]);
  if (!profile) return null;
  return {
    id: sub,
    email: (data.claims.email as string | undefined) ?? null,
    accountType: profile.account_type,
    displayName: profile.display_name,
    organisationName: profile.organisation_name,
    district: profile.district,
    verifiedAt: profile.verified_at,
    suspendedAt: profile.suspended_at,
    isDemo: profile.is_demo,
    isAdmin: admin === true,
    avatarUrl: profile.avatar_path ? storagePublicUrl('avatars', profile.avatar_path) : null,
  };
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  return user;
}

export async function requireFarmer(next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (user.accountType !== 'farmer') redirect('/dashboard/buyer');
  return user;
}

export async function requireBuyer(next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (user.accountType !== 'buyer') redirect('/dashboard/farmer');
  return user;
}

/** Administrators only. Others get a plain 404 so the area's existence is not advertised. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user?.isAdmin) notFound();
  return user;
}

export function dashboardHome(user: Pick<SessionUser, 'accountType'>) {
  return user.accountType === 'farmer' ? '/dashboard/farmer' : '/dashboard/buyer';
}
