'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { type ActionResult, actionContext, fail, fromDbError } from './shared';

export async function toggleFavorite(listingId: string, save: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(listingId).success) return fail('That listing could not be found.');
  const ctx = await actionContext();
  if (!ctx.ok) return ctx;
  const { supabase, user } = ctx;
  if (user.accountType !== 'buyer') return fail('Saving listings is for buyer accounts.');
  if (save) {
    const { error } = await supabase.from('favorites').insert({ user_id: user.id, listing_id: listingId });
    if (error && error.code !== '23505') return fromDbError(error);
  } else {
    const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('listing_id', listingId);
    if (error) return fromDbError(error);
  }
  revalidatePath('/dashboard/saved');
  revalidatePath('/dashboard/buyer');
  return { ok: true };
}
