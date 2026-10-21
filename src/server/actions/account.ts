'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { formToObject, profileSchema } from '@/domain/validation';
import { type ActionResult, actionContext, fail, fromDbError, fromZod } from './shared';

export async function updateProfileAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(formToObject(form));
  if (!parsed.success) return fromZod(parsed.error);
  const ctx = await actionContext();
  if (!ctx.ok) return ctx;
  const v = parsed.data;
  const isBuyer = ctx.user.accountType === 'buyer';
  if (isBuyer && !v.organisationName) return fail('Enter your business name.', { fieldErrors: { organisationName: 'Enter your business name.' } });
  const { error } = await ctx.supabase
    .from('profiles')
    .update({
      display_name: v.displayName,
      organisation_name: isBuyer ? v.organisationName : null,
      buyer_type: isBuyer ? (v.buyerType ?? null) : null,
      district: v.district ?? null,
      village: v.village ?? null,
      bio: v.bio ?? null,
    })
    .eq('id', ctx.user.id);
  if (error) return fromDbError(error);
  const { error: contactError } = await ctx.supabase.from('profile_contacts').upsert({ user_id: ctx.user.id, phone: v.phone ?? null }, { onConflict: 'user_id' });
  if (contactError) return fromDbError(contactError);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Profile saved.' };
}

export async function markNotificationsReadAction(ids: string[] | 'all'): Promise<ActionResult> {
  const ctx = await actionContext();
  if (!ctx.ok) return ctx;
  let q = ctx.supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null).eq('user_id', ctx.user.id);
  if (ids !== 'all') {
    const valid = ids.filter((i) => z.uuid().safeParse(i).success).slice(0, 200);
    if (!valid.length) return { ok: true };
    q = q.in('id', valid);
  }
  const { error } = await q;
  if (error) return fromDbError(error);
  revalidatePath('/dashboard', 'layout');
  return { ok: true };
}
