import 'server-only';
import { headers } from 'next/headers';
import type { z } from 'zod';
import { type DbErrorLike, GENERIC_ERROR, toUserMessage } from '@/domain/errors';
import { fieldErrors } from '@/domain/validation';
import { isSupabaseConfigured } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, type SessionUser } from '@/server/auth';

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; code?: string };

export const fail = (error: string, extra: Partial<Extract<ActionResult, { ok: false }>> = {}): Extract<ActionResult, { ok: false }> => ({
  ok: false,
  error,
  ...extra,
});

export function fromDbError(error: DbErrorLike | null | undefined) {
  const code = error?.code === 'P0001' && /^[A-Z_]+$/.test(error?.message ?? '') ? (error!.message as string) : undefined;
  if (!code && error) console.error('[agrilink] database error', { code: error.code, message: error.message });
  return fail(toUserMessage(error), code ? { code } : {});
}

export function fromZod(error: z.ZodError) {
  const fe = fieldErrors(error);
  return fail(fe._form ?? 'Please check the highlighted fields.', { fieldErrors: fe });
}

/** Current user + a Supabase client bound to their session (RLS applies), or a failure. */
export async function actionContext(): Promise<
  { ok: true; user: SessionUser; supabase: Awaited<ReturnType<typeof createClient>> } | Extract<ActionResult, { ok: false }>
> {
  if (!isSupabaseConfigured) return fail('Accounts are not available in preview mode.');
  const user = await getSessionUser();
  if (!user) return fail('Please log in to continue.', { code: 'AUTH_REQUIRED' });
  if (user.suspendedAt) return fail('Your account is suspended. Contact AgriLink support.', { code: 'ACCOUNT_SUSPENDED' });
  return { ok: true, user, supabase: await createClient() };
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

/** Per-IP limiter for unauthenticated actions. */
export async function limitByIp(action: string, limit: number, windowMs: number) {
  const ip = await clientIp();
  const r = rateLimit(`${action}:${ip}`, limit, windowMs);
  return r.ok ? null : fail(`Too many attempts. Please wait ${Math.ceil(r.retryAfterMs / 60000)} minute(s) and try again.`);
}

export { GENERIC_ERROR };
