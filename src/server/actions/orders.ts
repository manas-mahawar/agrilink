'use server';

import { revalidatePath } from 'next/cache';
import { formToObject, orderActionSchema, reviewSchema } from '@/domain/validation';
import { type ActionResult, actionContext, fromDbError, fromZod } from './shared';

const DONE: Record<string, string> = {
  confirm: 'Order confirmed. The buyer has been notified.',
  start_preparing: 'Marked as being prepared.',
  mark_ready: 'Marked as ready for pickup or delivery.',
  complete: 'Order marked as completed.',
  cancel: 'Order cancelled.',
};

export async function orderTransitionAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = orderActionSchema.safeParse(formToObject(form));
  if (!parsed.success) return fromZod(parsed.error);
  const ctx = await actionContext();
  if (!ctx.ok) return ctx;
  const v = parsed.data;
  const { error } = await ctx.supabase.rpc('transition_order', {
    p_order_id: v.orderId,
    p_action: v.action,
    p_note: v.note ?? null,
    p_fulfilment_date: v.fulfilmentDate ?? null,
  });
  if (error) return fromDbError(error);
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/admin', 'layout');
  return { ok: true, message: DONE[v.action] };
}

export async function reviewOrderAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(formToObject(form));
  if (!parsed.success) return fromZod(parsed.error);
  const ctx = await actionContext();
  if (!ctx.ok) return ctx;
  const v = parsed.data;
  const { error } = await ctx.supabase.rpc('review_order', { p_order_id: v.orderId, p_rating: v.rating, p_comment: v.comment ?? null });
  if (error) return fromDbError(error);
  revalidatePath('/dashboard', 'layout');
  return { ok: true, message: 'Thanks — your rating has been saved.' };
}
