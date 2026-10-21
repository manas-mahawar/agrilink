'use server';

import { redirect } from 'next/navigation';
import { forgotPasswordSchema, formToObject, loginSchema, registerSchema, resetPasswordSchema } from '@/domain/validation';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/utils';
import { getSessionUser, dashboardHome } from '@/server/auth';
import { DEMO_ACCOUNTS, serverEnv } from '@/server/env';
import { type ActionResult, fail, fromZod, limitByIp } from './shared';

const NOT_CONFIGURED = 'Accounts are not available in this preview. The site owner needs to connect Supabase first (see the README).';

function confirmUrl(next: string) {
  return `${publicEnv.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`;
}

export async function signUpAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail(NOT_CONFIGURED);
  const limited = await limitByIp('signup', 5, 60 * 60_000);
  if (limited) return limited;
  const parsed = registerSchema.safeParse(formToObject(form));
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  const next = safeNextPath(String(form.get('next') ?? ''), v.accountType === 'farmer' ? '/dashboard/farmer' : '/dashboard/buyer');

  const supabase = await createClient();
  // Only these fields are read by the database trigger. account_type is limited to
  // farmer/buyer there; admin rights can never come from sign-up data.
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: confirmUrl(next),
      data: {
        account_type: v.accountType,
        display_name: v.displayName,
        organisation_name: v.accountType === 'buyer' ? v.organisationName : undefined,
        buyer_type: v.accountType === 'buyer' ? v.buyerType : undefined,
        district: v.district,
        phone: v.phone,
      },
    },
  });
  if (error) {
    if (error.code === 'weak_password') return fail(error.message, { fieldErrors: { password: error.message } });
    if (error.code === 'over_email_send_rate_limit' || error.status === 429) return fail('Too many sign-up attempts. Please wait a few minutes and try again.');
    if (error.code === 'user_already_exists' || error.code === 'email_exists') {
      return fail('An account with this email already exists. Log in instead, or reset your password.');
    }
    console.error('[agrilink] sign-up failed', { code: error.code, status: error.status });
    return fail('We could not create your account. Please try again.');
  }
  if (data.session) redirect(next);
  // Email confirmation is on: Supabase sends a link. (If the address is already registered,
  // Supabase deliberately returns the same response, so we don't reveal which emails exist.)
  return { ok: true, message: `We have sent a confirmation link to ${v.email}. Open it on this device to finish creating your account.` };
}

export async function signInAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail(NOT_CONFIGURED);
  const limited = await limitByIp('signin', 10, 15 * 60_000);
  if (limited) return limited;
  const parsed = loginSchema.safeParse(formToObject(form));
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === 'email_not_confirmed') return fail('Please confirm your email first — check your inbox for the link we sent.');
    if (error.status === 429) return fail('Too many attempts. Please wait a few minutes and try again.');
    return fail('That email and password don’t match an account.');
  }
  const user = await getSessionUser();
  redirect(safeNextPath(String(form.get('next') ?? ''), user ? dashboardHome(user) : '/dashboard'));
}

export async function forgotPasswordAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail(NOT_CONFIGURED);
  const limited = await limitByIp('forgot', 5, 60 * 60_000);
  if (limited) return limited;
  const parsed = forgotPasswordSchema.safeParse(formToObject(form));
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: confirmUrl('/reset-password') });
  if (error && error.status !== 429) console.error('[agrilink] reset email failed', { code: error.code, status: error.status });
  // Same answer whether or not the account exists.
  return { ok: true, message: 'If an account exists for that email, a reset link is on its way. It expires in one hour.' };
}

export async function resetPasswordAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail(NOT_CONFIGURED);
  const parsed = resetPasswordSchema.safeParse(formToObject(form));
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return fail('Your reset link has expired. Request a new one.', { code: 'AUTH_REQUIRED' });
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === 'same_password') return fail('Choose a password different from your old one.', { fieldErrors: { password: 'Choose a different password.' } });
    if (error.code === 'weak_password') return fail(error.message, { fieldErrors: { password: error.message } });
    return fail('We could not update your password. Request a new reset link and try again.');
  }
  const user = await getSessionUser();
  redirect(user ? `${dashboardHome(user)}?password=updated` : '/dashboard');
}

/**
 * Demo sign-in: a real Supabase password sign-in to a seeded demo account. It only works on a
 * deployment that is in demo mode AND has DEMO_ACCOUNT_PASSWORD set — i.e. one pointed at a
 * separate demo Supabase project. It grants nothing beyond what that account normally has.
 */
export async function demoSignInAction(role: 'farmer' | 'buyer'): Promise<ActionResult> {
  if (!isSupabaseConfigured || !publicEnv.demoMode || !serverEnv.demoAccountPassword) {
    return fail('Demo accounts are not enabled on this site.');
  }
  const limited = await limitByIp('demo', 20, 15 * 60_000);
  if (limited) return limited;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: DEMO_ACCOUNTS[role], password: serverEnv.demoAccountPassword });
  if (error) {
    console.error('[agrilink] demo sign-in failed', { role, code: error.code });
    return fail('The demo account is not set up yet. Run the demo seed script (see the README).');
  }
  redirect(role === 'farmer' ? '/dashboard/farmer' : '/dashboard/buyer');
}
