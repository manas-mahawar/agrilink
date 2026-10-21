'use server';

// Administrator actions. Each one calls a SECURITY DEFINER function that re-checks
// administrator rights and writes an audit record; the checks here only give early,
// friendly errors.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { type ActionResult, actionContext, fail, fromDbError } from './shared';

async function adminContext() {
  const ctx = await actionContext();
  if (!ctx.ok) return ctx;
  if (!ctx.user.isAdmin) return fail('This action needs administrator access.');
  return ctx;
}

const uuid = z.uuid();
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

function done(message: string): ActionResult {
  revalidatePath('/admin', 'layout');
  revalidatePath('/marketplace', 'layout');
  revalidatePath('/');
  return { ok: true, message };
}

export async function adminSetListingHiddenAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const p = z.object({ listingId: uuid, hidden: z.enum(['true', 'false']), reason: text(500) }).safeParse(Object.fromEntries(form));
  if (!p.success) return fail('Check the form and try again.');
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  const hidden = p.data.hidden === 'true';
  const { error } = await ctx.supabase.rpc('admin_set_listing_hidden', { p_listing_id: p.data.listingId, p_hidden: hidden, p_reason: p.data.reason });
  if (error) return fromDbError(error);
  return done(hidden ? 'Listing hidden from the marketplace. The farmer has been notified.' : 'Listing restored.');
}

export async function adminSetUserSuspendedAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const p = z.object({ userId: uuid, suspended: z.enum(['true', 'false']), reason: text(500) }).safeParse(Object.fromEntries(form));
  if (!p.success) return fail('Check the form and try again.');
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  const suspended = p.data.suspended === 'true';
  const { error } = await ctx.supabase.rpc('admin_set_user_suspended', { p_user_id: p.data.userId, p_suspended: suspended, p_reason: p.data.reason });
  if (error) return fromDbError(error);
  return done(suspended ? 'Account suspended.' : 'Suspension lifted.');
}

export async function adminSetFarmerVerifiedAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const p = z.object({ userId: uuid, verified: z.enum(['true', 'false']), note: text(500) }).safeParse(Object.fromEntries(form));
  if (!p.success) return fail('Check the form and try again.');
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  const verified = p.data.verified === 'true';
  const { error } = await ctx.supabase.rpc('admin_set_farmer_verified', { p_user_id: p.data.userId, p_verified: verified, p_note: p.data.note });
  if (error) return fromDbError(error);
  return done(verified ? 'Farmer marked as verified.' : 'Verification removed.');
}

export async function adminResolveReportAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const p = z.object({ reportId: uuid, status: z.enum(['reviewing', 'actioned', 'dismissed']), note: text(1000) }).safeParse(Object.fromEntries(form));
  if (!p.success) return fail('Choose an outcome.');
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase.rpc('admin_resolve_report', { p_report_id: p.data.reportId, p_status: p.data.status, p_note: p.data.note });
  if (error) return fromDbError(error);
  return done(p.data.status === 'reviewing' ? 'Marked as under review.' : 'Report closed. The reporter has been notified.');
}

export async function adminCancelOrderAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const p = z.object({ orderId: uuid, note: z.string().trim().min(3, 'Give a reason.').max(500) }).safeParse(Object.fromEntries(form));
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Give a reason.', { fieldErrors: { note: 'Give a reason.' } });
  const ctx = await adminContext();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase.rpc('transition_order', { p_order_id: p.data.orderId, p_action: 'cancel', p_note: p.data.note, p_fulfilment_date: null });
  if (error) return fromDbError(error);
  revalidatePath('/dashboard', 'layout');
  return done('Order cancelled. Both parties have been notified.');
}
