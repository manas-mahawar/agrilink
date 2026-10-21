/**
 * Seeds the illustrative demo catalogue into a DEMO Supabase project.
 *
 *   npm run seed:demo -- --target-is-demo            (first run)
 *   npm run seed:demo -- --target-is-demo --reset    (delete existing demo data first)
 *
 * Safety rails — the script refuses to run unless ALL of these hold:
 *   1. The flag --target-is-demo is passed.
 *   2. NEXT_PUBLIC_DEMO_MODE=true in the environment.
 *   3. The target database has app_config.demo_data_visible = true. You set that once, by hand,
 *      in the demo project's SQL editor (docs/SUPABASE_SETUP.md). The production project keeps
 *      it false, so this script cannot write there by accident — and even if demo rows existed
 *      there they would stay invisible.
 *   4. DEMO_ACCOUNT_PASSWORD is set (at least 12 characters). No password is stored in code.
 *
 * Every row it creates is flagged is_demo. Offers, counter-offers, orders and the review are
 * made through the same database functions the app uses, signed in as the demo users.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEMO_ACTIVITY, DEMO_BUYERS, DEMO_FARMERS, DEMO_LISTINGS } from '../src/content/demo-catalog';
import { PRODUCE } from '../src/content/images';

const args = new Set(process.argv.slice(2));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const password = process.env.DEMO_ACCOUNT_PASSWORD || '';
const DAY = 86_400_000;

function stop(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const emailFor = (key: string) => {
  if (key === 'gurpreet') return process.env.DEMO_FARMER_EMAIL || 'demo.farmer@agrilink-demo.example.com';
  if (key === 'sidhu') return process.env.DEMO_BUYER_EMAIL || 'demo.buyer@agrilink-demo.example.com';
  return `demo.${key}@agrilink-demo.example.com`;
};
const isoInDays = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

async function must<T>(label: string, p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) stop(`${label}: ${error.message}`);
  return (data ?? []) as NonNullable<T>;
}

async function signedIn(email: string): Promise<SupabaseClient> {
  const c = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) stop(`Sign-in as ${email} failed: ${error.message}`);
  return c;
}

async function main() {
  if (!args.has('--target-is-demo')) stop('Refusing to run without --target-is-demo. Point this script only at your DEMO Supabase project.');
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') stop('NEXT_PUBLIC_DEMO_MODE must be "true" for the demo project.');
  if (!url || !anonKey || !secretKey) stop('Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY for the DEMO project.');
  if (password.length < 12) stop('Set DEMO_ACCOUNT_PASSWORD (at least 12 characters). It is used for every demo account.');

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const config = await must('Reading app_config', admin.from('app_config').select('demo_data_visible').eq('id', 1).maybeSingle());
  if (!(config as { demo_data_visible?: boolean }).demo_data_visible) {
    stop('This database is not marked as a demo project (app_config.demo_data_visible is false). Refusing to seed. See docs/SUPABASE_SETUP.md → Demo project.');
  }
  console.log(`Seeding demo data into ${new URL(url).host}`);

  const existing = await must('Checking for existing demo data', admin.from('profiles').select('id').eq('is_demo', true).limit(1));
  if (existing.length) {
    if (!args.has('--reset')) stop('Demo data already exists. Re-run with --reset to delete and recreate it.');
    console.log('• Removing existing demo data');
    const demoOrders = await must('Listing demo orders', admin.from('orders').select('id').eq('is_demo', true));
    if (demoOrders.length) await must('Deleting demo orders', admin.from('orders').delete().in('id', demoOrders.map((o) => o.id)));
    const demoProfiles = await must('Listing demo users', admin.from('profiles').select('id').eq('is_demo', true));
    const demoImages = await must('Listing demo photos', admin.from('listing_images').select('storage_path, listing:listings!inner(is_demo)').eq('listing.is_demo', true));
    const paths = demoImages.flatMap((i) => [i.storage_path, i.storage_path.replace(/\.webp$/, '-thumb.webp')]);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from('listing-images').remove(paths.slice(i, i + 100));
      if (error) stop(`Removing demo photos: ${error.message}`);
    }
    for (const p of demoProfiles) {
      const { error } = await admin.auth.admin.deleteUser(p.id);
      if (error) stop(`Deleting demo user ${p.id}: ${error.message}`);
    }
  }

  console.log('• Creating demo accounts');
  for (const f of DEMO_FARMERS) {
    const { error } = await admin.auth.admin.createUser({
      id: f.id,
      email: emailFor(f.key),
      password,
      email_confirm: true,
      user_metadata: { account_type: 'farmer', display_name: f.displayName, district: f.district, village: f.village },
    });
    if (error) stop(`Creating ${f.displayName}: ${error.message}`);
    await must(
      `Updating ${f.displayName}`,
      admin
        .from('profiles')
        .update({
          is_demo: true,
          bio: f.bio,
          village: f.village,
          created_at: new Date(Date.now() - f.joinedDaysAgo * DAY).toISOString(),
          // Demo only: shown as "Verified · demo" in the app. No real verification took place.
          verified_at: f.verified ? new Date(Date.now() - Math.max(1, f.joinedDaysAgo - 5) * DAY).toISOString() : null,
        })
        .eq('id', f.id),
    );
  }
  for (const b of DEMO_BUYERS) {
    const { error } = await admin.auth.admin.createUser({
      id: b.id,
      email: emailFor(b.key),
      password,
      email_confirm: true,
      user_metadata: { account_type: 'buyer', display_name: b.displayName, organisation_name: b.organisationName, buyer_type: b.buyerType, district: b.district },
    });
    if (error) stop(`Creating ${b.organisationName}: ${error.message}`);
    await must(`Updating ${b.organisationName}`, admin.from('profiles').update({ is_demo: true }).eq('id', b.id));
  }

  console.log('• Creating demo listings and uploading photos');
  for (const l of DEMO_LISTINGS) {
    const farmer = DEMO_FARMERS.find((f) => f.key === l.farmerKey)!;
    const harvest = l.harvestInDays === null ? null : isoInDays(l.harvestInDays);
    await must(
      `Listing ${l.produceName} ${l.variety}`,
      admin.from('listings').insert({
        id: l.id,
        farmer_id: farmer.id,
        category_id: l.categoryId,
        locality_id: l.localityId,
        produce_name: l.produceName,
        variety: l.variety,
        description: l.description,
        unit: l.unit,
        quantity_total: l.quantityTotal,
        min_order_qty: l.minOrderQty,
        max_order_qty: l.maxOrderQty,
        price_per_unit_paise: l.pricePerUnitPaise,
        availability_type: l.availabilityType,
        expected_harvest_date: harvest,
        available_until: l.availableForDays === null ? null : isoInDays((l.harvestInDays ?? 0) + l.availableForDays),
        quality_grade: l.qualityGrade,
        quality_notes: l.qualityNotes,
        status: 'active',
        is_demo: true,
        published_at: new Date(Date.now() - l.publishedDaysAgo * DAY).toISOString(),
      }),
    );
    for (const [i, key] of l.images.entries()) {
      const file = readFileSync(path.join(process.cwd(), 'public', PRODUCE[key].src));
      const objectPath = `${farmer.id}/${l.id}/demo-${i + 1}.webp`;
      for (const p of [objectPath, objectPath.replace(/\.webp$/, '-thumb.webp')]) {
        const { error } = await admin.storage.from('listing-images').upload(p, file, { contentType: 'image/webp', upsert: false });
        if (error) stop(`Uploading ${p}: ${error.message}`);
      }
      await must(
        'Image row',
        admin.from('listing_images').insert({ listing_id: l.id, storage_path: objectPath, position: i, alt_text: `${PRODUCE[key].alt} (illustrative demo photo)` }),
      );
    }
  }

  console.log('• Creating demo offers and orders through the app’s own database functions');
  const listingN = (n: number) => DEMO_LISTINGS[n - 1];
  for (const o of DEMO_ACTIVITY.offers) {
    const listing = listingN(o.listing);
    const farmerKey = listing.farmerKey;
    const buyerClient = await signedIn(emailFor(o.buyer));
    const offerId = (await must(
      `Offer ${o.key}`,
      buyerClient.rpc('create_offer', {
        p_listing_id: listing.id,
        p_quantity: o.quantity,
        p_price_per_unit_paise: o.pricePerUnitPaise,
        p_fulfilment_method: o.fulfilment,
        p_message: 'message' in o ? o.message : null,
      }),
    )) as string;
    let version = 1;
    if ('counter' in o) {
      const farmerClient = await signedIn(emailFor(farmerKey));
      await must(`Counter ${o.key}`, farmerClient.rpc('counter_offer', { p_offer_id: offerId, p_expected_version: version, p_quantity: o.quantity, p_price_per_unit_paise: o.counter.pricePerUnitPaise, p_message: null }));
      version += 1;
    }
    if (!('accept' in o)) continue;
    const accepter = await signedIn(emailFor(o.accept === 'farmer' ? farmerKey : o.buyer));
    const orderId = (await must(`Accept ${o.key}`, accepter.rpc('accept_offer', { p_offer_id: offerId, p_expected_version: version }))) as string;
    const farmerClient = await signedIn(emailFor(farmerKey));
    for (const step of o.orderSteps) {
      const actor = step === 'complete' ? buyerClient : farmerClient;
      await must(
        `Order ${o.key} ${step}`,
        actor.rpc('transition_order', { p_order_id: orderId, p_action: step, p_note: null, p_fulfilment_date: step === 'confirm' ? isoInDays(7) : null }),
      );
    }
    if ('review' in o) {
      await must(`Review ${o.key}`, buyerClient.rpc('review_order', { p_order_id: orderId, p_rating: o.review.rating, p_comment: o.review.comment }));
    }
  }

  console.log(`\n✔ Demo data ready: ${DEMO_FARMERS.length} farmers, ${DEMO_BUYERS.length} buyers, ${DEMO_LISTINGS.length} listings, ${DEMO_ACTIVITY.offers.length} offers.`);
  console.log(`  Demo sign-in: ${emailFor('gurpreet')} (farmer) and ${emailFor('sidhu')} (buyer), password from DEMO_ACCOUNT_PASSWORD.\n`);
}

main().catch((e) => stop(e instanceof Error ? e.message : String(e)));
