'use server';

// Offer actions. Every rule (whose turn it is, quantity limits, versions, rate limits) is
// enforced again inside the database functions; these actions validate input for friendly
// messages and pass the caller's session through so RLS and auth.uid() apply.
import { revalidatePath } from 'next/cache';
import { counterSchema, formToObject, offerDecisionSchema, offerSchema } from '@/domain/validation';
import { type ActionResult, actionContext, fail, fromDbError, fromZod } from './shared';

function refresh(listingId?: string) {
  revalidatePath('/dashboard', 'layout');
  if (listingId) revalidatePath(`/marketplace/${listingId}`);
}

export async function createOfferAction(_prev: ActionResult<{ offerId: string }> | null, form: FormData): Promise<ActionResult<{ offerId: string }>> {
  const parsed = offerSchema.safeParse(formToObject(form));
  if (!parsed.success) return fromZod(parsed.error);
  const ctx = await actionContext();
  if (!ctx.ok) return ctx;
  if (ctx.user.accountType !== 'buyer') return fail('Only buyer accounts can make offers.');
  const v = parsed.data;
  const { data, error } = await ctx.supabase.rpc('create_offer', {
    p_listing_id: v.listingId,
    p_quantity: v.quantity,
    p_price_per_unit_paise: v.price,
    p_fulfilment_method: v.fulfilmentMethod,
    p_message: v.message ?? null,
  });
  if (error) return fromDbError(error);
  refresh(v.listingId);
  return { ok: true, data: { offerId: String(data) }, message: 'Offer sent. The farmer has been notified.' };
}

export async function counterOfferAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = counterSchema.safeParse(formToObject(form));
  if (!parsed.success) return fromZod(parsed.error);
  const ctx = await actionContext();
  if (!ctx.ok) return ctx;
  const v = parsed.data;
  const { error } = await ctx.supabase.rpc('counter_offer', {
    p_offer_id: v.offerId,
    p_expected_version: v.version,
    p_quantity: v.quantity,
    p_price_per_unit_paise: v.price,
    p_message: v.message ?? null,
  });
  if (error) return fromDbError(error);
  refresh();
  return { ok: true, message: 'Counter-offer sent.' };
}

type Decision = 'accept' | 'reject' | 'withdraw';

export async function decideOfferAction(decision: Decision, _prev: ActionResult<{ orderId?: string }> | null, form: FormData): Promise<ActionResult<{ orderId?: string }>> {
  const parsed = offerDecisionSchema.safeParse(formToObject(form));
  if (!parsed.success) return fromZod(parsed.error);
  const ctx = await actionContext();
  if (!ctx.ok) return ctx;
  const v = parsed.data;
  if (decision === 'accept') {
    const { data, error } = await ctx.supabase.rpc('accept_offer', { p_offer_id: v.offerId, p_expected_version: v.version });
    if (error) return fromDbError(error);
    refresh();
    // Accepting reserves quantity, so public listing pages must show the new availability.
    revalidatePath('/marketplace', 'layout');
    return { ok: true, data: { orderId: String(data) }, message: 'Offer accepted. An order has been created.' };
  }
  if (decision === 'reject') {
    const { error } = await ctx.supabase.rpc('reject_offer', { p_offer_id: v.offerId, p_expected_version: v.version, p_reason: v.reason ?? null });
    if (error) return fromDbError(error);
    refresh();
    return { ok: true, message: 'Offer declined.' };
  }
  const { error } = await ctx.supabase.rpc('withdraw_offer', { p_offer_id: v.offerId, p_expected_version: v.version });
  if (error) return fromDbError(error);
  refresh();
  return { ok: true, message: 'Offer withdrawn.' };
}
