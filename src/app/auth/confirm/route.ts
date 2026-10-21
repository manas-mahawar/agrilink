import type { EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/utils';

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

// Landing point for links in Supabase emails (sign-up confirmation, password reset).
// Supports both the token_hash template (recommended, works across devices) and the PKCE
// ?code= flow (works in the same browser that started it).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const code = url.searchParams.get('code');
  const next = safeNextPath(url.searchParams.get('next'), '/dashboard');
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));

  if (!isSupabaseConfigured) return fail('unavailable');
  const supabase = await createClient();

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail('link_expired');
    return NextResponse.redirect(new URL(type === 'recovery' ? '/reset-password' : next, url.origin));
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail('link_expired');
    return NextResponse.redirect(new URL(next, url.origin));
  }
  if (url.searchParams.get('error_code')) return fail('link_expired');
  return fail('link_invalid');
}
