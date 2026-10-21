'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CATEGORIES, LOCALITIES } from '@/content/reference';
import { type ListingStatus, MAX_LISTING_IMAGES } from '@/domain/listings';
import { formToObject, listingSchema } from '@/domain/validation';
import { thumbPathFor } from '@/server/data/mappers';
import { ImageRejected, processListingImage } from '@/server/images';
import { type ActionResult, actionContext, fail, fromDbError, fromZod } from './shared';

function refreshListing(id?: string) {
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/marketplace', 'layout');
  revalidatePath('/');
  if (id) revalidatePath(`/marketplace/${id}`);
}

async function farmerContext() {
  const ctx = await actionContext();
  if (!ctx.ok) return ctx;
  if (ctx.user.accountType !== 'farmer') return fail('Only farmer accounts can manage listings.');
  return ctx;
}

function toRow(v: z.infer<typeof listingSchema>) {
  return {
    category_id: v.categoryId,
    locality_id: v.localityId,
    produce_name: v.produceName,
    variety: v.variety ?? null,
    description: v.description ?? null,
    unit: v.unit,
    quantity_total: v.quantityTotal,
    min_order_qty: v.minOrderQty,
    max_order_qty: v.maxOrderQty ?? null,
    price_per_unit_paise: v.price,
    availability_type: v.availabilityType,
    expected_harvest_date: v.expectedHarvestDate ?? null,
    available_until: v.availableUntil ?? null,
    quality_grade: v.qualityGrade,
    quality_notes: v.qualityNotes ?? null,
  };
}

function checkReferences(v: z.infer<typeof listingSchema>) {
  if (!CATEGORIES.some((c) => c.id === v.categoryId)) return fail('Choose a category.', { fieldErrors: { categoryId: 'Choose a category.' } });
  if (!LOCALITIES.some((l) => l.id === v.localityId)) return fail('Choose a village or town.', { fieldErrors: { localityId: 'Choose a village or town.' } });
  return null;
}

export async function createListingAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = listingSchema.safeParse(formToObject(form));
  if (!parsed.success) return fromZod(parsed.error);
  const bad = checkReferences(parsed.data);
  if (bad) return bad;
  const ctx = await farmerContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from('listings')
    .insert({ ...toRow(parsed.data), farmer_id: ctx.user.id, status: parsed.data.publish })
    .select('id')
    .single();
  if (error) return fromDbError(error);
  refreshListing();
  redirect(`/dashboard/listings/${data.id}?created=1`);
}

export async function updateListingAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const id = String(form.get('listingId') ?? '');
  if (!z.uuid().safeParse(id).success) return fail('That listing could not be found.');
  const parsed = listingSchema.safeParse(formToObject(form));
  if (!parsed.success) return fromZod(parsed.error);
  const bad = checkReferences(parsed.data);
  if (bad) return bad;
  const ctx = await farmerContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase.from('listings').update(toRow(parsed.data)).eq('id', id).eq('farmer_id', ctx.user.id).select('id');
  if (error) {
    if (error.code === '23514' && /quantities_consistent|min_within_total/.test(error.message)) {
      return fail('The expected quantity can’t be lower than what is already reserved or sold, or below the minimum order.', {
        fieldErrors: { quantityTotal: 'Too low for what is already reserved or sold.' },
      });
    }
    return fromDbError(error);
  }
  if (!data?.length) return fail('That listing could not be found.');
  refreshListing(id);
  return { ok: true, message: 'Listing saved.' };
}

const STATUS_MESSAGES: Partial<Record<ListingStatus, string>> = {
  active: 'Listing published. Buyers can now see it and make offers.',
  paused: 'Listing paused. It is hidden from the marketplace until you resume it.',
  archived: 'Listing archived. Open offers on it have been closed.',
};

export async function setListingStatusAction(listingId: string, status: 'active' | 'paused' | 'archived'): Promise<ActionResult> {
  if (!z.uuid().safeParse(listingId).success || !['active', 'paused', 'archived'].includes(status)) return fail('That change is not allowed.');
  const ctx = await farmerContext();
  if (!ctx.ok) return ctx;
  // The database trigger enforces which status changes are allowed.
  const { data, error } = await ctx.supabase.from('listings').update({ status }).eq('id', listingId).eq('farmer_id', ctx.user.id).select('id');
  if (error) return fromDbError(error);
  if (!data?.length) return fail('That listing could not be found.');
  refreshListing(listingId);
  return { ok: true, message: STATUS_MESSAGES[status] };
}

export async function deleteDraftListingAction(listingId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(listingId).success) return fail('That listing could not be found.');
  const ctx = await farmerContext();
  if (!ctx.ok) return ctx;
  const { data: images } = await ctx.supabase.from('listing_images').select('storage_path').eq('listing_id', listingId);
  const { data, error } = await ctx.supabase.from('listings').delete().eq('id', listingId).eq('farmer_id', ctx.user.id).eq('status', 'draft').select('id');
  if (error) return fromDbError(error);
  if (!data?.length) return fail('Only drafts can be deleted. Archive a published listing instead.');
  const paths = (images ?? []).flatMap((i) => [String(i.storage_path), thumbPathFor(String(i.storage_path))]);
  if (paths.length) await ctx.supabase.storage.from('listing-images').remove(paths);
  refreshListing();
  redirect('/dashboard/listings?deleted=1');
}

export async function uploadListingImagesAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const listingId = String(form.get('listingId') ?? '');
  if (!z.uuid().safeParse(listingId).success) return fail('That listing could not be found.');
  const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return fail('Choose at least one photo.');
  const ctx = await farmerContext();
  if (!ctx.ok) return ctx;

  const { data: listing } = await ctx.supabase.from('listings').select('id, status, produce_name, variety').eq('id', listingId).eq('farmer_id', ctx.user.id).maybeSingle();
  if (!listing) return fail('That listing could not be found.');
  if (listing.status === 'archived') return fail('Archived listings cannot be changed.');
  const { data: existing } = await ctx.supabase.from('listing_images').select('position').eq('listing_id', listingId);
  const room = MAX_LISTING_IMAGES - (existing?.length ?? 0);
  if (room <= 0) return fail(`A listing can have up to ${MAX_LISTING_IMAGES} photos. Remove one first.`);
  if (files.length > room) return fail(`You can add ${room} more photo${room === 1 ? '' : 's'} to this listing.`);

  let position = Math.max(-1, ...(existing ?? []).map((e) => Number(e.position))) + 1;
  const alt = `${listing.variety ? `${listing.produce_name} · ${listing.variety}` : listing.produce_name} — photo from the farmer`;
  let added = 0;
  for (const file of files) {
    let processed;
    try {
      processed = await processListingImage(file);
    } catch (e) {
      return fail(e instanceof ImageRejected ? `${file.name}: ${e.message}` : 'A photo could not be processed.', added ? { code: 'PARTIAL' } : {});
    }
    const path = `${ctx.user.id}/${listingId}/${randomUUID()}.webp`;
    const bucket = ctx.supabase.storage.from('listing-images');
    const up1 = await bucket.upload(path, processed.main, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
    if (up1.error) return fail('Upload failed. Please try again.');
    const up2 = await bucket.upload(thumbPathFor(path), processed.thumb, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
    if (up2.error) {
      await bucket.remove([path]);
      return fail('Upload failed. Please try again.');
    }
    const { error } = await ctx.supabase
      .from('listing_images')
      .insert({ listing_id: listingId, storage_path: path, position: position++, width: processed.width, height: processed.height, alt_text: alt });
    if (error) {
      await bucket.remove([path, thumbPathFor(path)]);
      return fromDbError(error);
    }
    added++;
  }
  refreshListing(listingId);
  return { ok: true, message: `${added} photo${added === 1 ? '' : 's'} added.` };
}

export async function deleteListingImageAction(imageId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(imageId).success) return fail('That photo could not be found.');
  const ctx = await farmerContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase.from('listing_images').delete().eq('id', imageId).select('storage_path, listing_id');
  if (error) return fromDbError(error);
  if (!data?.length) return fail('That photo could not be found.');
  const path = String(data[0].storage_path);
  await ctx.supabase.storage.from('listing-images').remove([path, thumbPathFor(path)]);
  refreshListing(String(data[0].listing_id));
  return { ok: true, message: 'Photo removed.' };
}

export async function makeCoverImageAction(imageId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(imageId).success) return fail('That photo could not be found.');
  const ctx = await farmerContext();
  if (!ctx.ok) return ctx;
  const { data: img } = await ctx.supabase.from('listing_images').select('listing_id').eq('id', imageId).maybeSingle();
  if (!img) return fail('That photo could not be found.');
  const { data: all } = await ctx.supabase.from('listing_images').select('id, position').eq('listing_id', img.listing_id).order('position');
  const ordered = [imageId, ...(all ?? []).map((i) => String(i.id)).filter((i) => i !== imageId)];
  for (const [index, id] of ordered.entries()) {
    const { error } = await ctx.supabase.from('listing_images').update({ position: index }).eq('id', id);
    if (error) return fromDbError(error);
  }
  refreshListing(String(img.listing_id));
  return { ok: true, message: 'Cover photo updated.' };
}
