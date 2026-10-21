'use server';

import { formToObject, reportSchema } from '@/domain/validation';
import { type ActionResult, actionContext, fail, fromDbError, fromZod } from './shared';

export async function submitReportAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(formToObject(form));
  if (!parsed.success) return fromZod(parsed.error);
  const ctx = await actionContext();
  if (!ctx.ok) return ctx;
  const v = parsed.data;
  const { error } = await ctx.supabase.from('reports').insert({
    reporter_id: ctx.user.id,
    listing_id: v.listingId ?? null,
    reported_user_id: v.reportedUserId ?? null,
    reason: v.reason,
    details: v.details ?? null,
  });
  if (error?.code === '23505') return fail('You already have an open report about this. Our team will review it.');
  if (error) return fromDbError(error);
  return { ok: true, message: 'Thanks. Your report has been sent to the AgriLink team for review.' };
}
