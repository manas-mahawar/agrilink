// Row Level Security and privilege tests: what each kind of user may and may not do.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { anon, createListing, createUser, fails, makeAdmin, owner, pool, q, resetData, rpc, service, user } from './helpers';

let farmerA: string;
let farmerB: string;
let buyer: string;
let buyer2: string;
let admin: string;

beforeAll(async () => {
  await resetData();
});
afterAll(async () => {
  await pool.end();
});
beforeEach(async () => {
  await resetData();
  farmerA = await createUser({ accountType: 'farmer', name: 'Gurpreet Singh', phone: '+91 98765 43210' });
  farmerB = await createUser({ accountType: 'farmer', name: 'Harjinder Kaur' });
  buyer = await createUser({ accountType: 'buyer', name: 'Harleen Sidhu', organisationName: 'Sidhu Veg Mart', phone: '9811122233' });
  buyer2 = await createUser({ accountType: 'buyer', name: 'Rohit Bansal' });
  admin = await createUser({ accountType: 'buyer', name: 'Admin Person' });
  await makeAdmin(admin);
});

describe('sign-up trigger', () => {
  it('creates a profile and private contact row from sign-up metadata', async () => {
    const p = (await q(owner, 'select * from public.profiles where id = $1', [buyer])).rows[0];
    expect(p.account_type).toBe('buyer');
    expect(p.organisation_name).toBe('Sidhu Veg Mart');
    const c = (await q(owner, 'select phone from public.profile_contacts where user_id = $1', [buyer])).rows[0];
    expect(c.phone).toBe('9811122233');
  });

  it('never creates an administrator from metadata, and defaults unknown account types to buyer', async () => {
    const id = await createUser({ accountType: 'buyer', extraMeta: { account_type: 'admin', is_admin: true, role: 'admin' } });
    const p = (await q(owner, 'select account_type from public.profiles where id = $1', [id])).rows[0];
    expect(p.account_type).toBe('buyer');
    expect((await rpc(user(id), 'is_admin', {})) as boolean).toBe(false);
  });
});

describe('anonymous visitors', () => {
  it('can read reference data', async () => {
    expect((await q(anon, 'select * from public.categories')).rowCount).toBeGreaterThan(3);
    expect((await q(anon, 'select * from public.localities')).rowCount).toBeGreaterThan(5);
  });

  it('cannot read private tables', async () => {
    for (const t of ['admins', 'app_config', 'payment_events', 'refunds']) {
      const e = await fails(q(anon, `select * from public.${t}`));
      expect(e.code).toBe('42501');
    }
    for (const t of ['notifications', 'offers', 'orders', 'audit_events', 'reports', 'profile_contacts', 'favorites', 'payments']) {
      const e = await fails(q(anon, `select * from public.${t}`));
      expect(e.code).toBe('42501');
    }
  });

  it('see only live, visible, non-demo listings of active farmers', async () => {
    const live = await createListing(farmerA);
    const draft = await createListing(farmerA, { status: 'draft' });
    const paused = await createListing(farmerA);
    await q(user(farmerA), `update public.listings set status = 'paused' where id = $1`, [paused]);
    const hidden = await createListing(farmerA);
    await q(owner, 'update public.listings set hidden_by_admin = true where id = $1', [hidden]);
    const demo = await createListing(farmerB);
    await q(owner, 'update public.listings set is_demo = true where id = $1', [demo]);

    const ids = (await q<{ id: string }>(anon, 'select id from public.marketplace_listings')).rows.map((r) => r.id);
    expect(ids).toEqual([live]);

    // Demo rows appear only when the project is configured as a demo environment.
    await q(owner, 'update public.app_config set demo_data_visible = true');
    const withDemo = (await q<{ id: string }>(anon, 'select id from public.listings')).rows.map((r) => r.id).sort();
    expect(withDemo).toEqual([live, demo].sort());
    expect(draft).toBeDefined();
  });

  it("hide a suspended farmer's listings and profile", async () => {
    await createListing(farmerA);
    await q(owner, 'update public.profiles set suspended_at = now() where id = $1', [farmerA]);
    expect((await q(anon, 'select id from public.listings')).rowCount).toBe(0);
    expect((await q(anon, 'select id from public.profiles where id = $1', [farmerA])).rowCount).toBe(0);
  });

  it('can see farmer profiles but not buyer profiles', async () => {
    expect((await q(anon, 'select id from public.profiles where id = $1', [farmerA])).rowCount).toBe(1);
    expect((await q(anon, 'select id from public.profiles where id = $1', [buyer])).rowCount).toBe(0);
  });

  it('cannot write anything', async () => {
    expect((await fails(q(anon, `insert into public.listings (farmer_id, category_id, locality_id, produce_name, quantity_total, min_order_qty, price_per_unit_paise, availability_type, status) values ($1,'tomatoes','sanaur','X',1,1,1,'ready_now','active')`, [farmerA]))).code).toBe('42501');
    expect((await fails(rpc(anon, 'create_offer', { p_listing_id: farmerA, p_quantity: 1, p_price_per_unit_paise: 1 }))).code).toBe('42501');
  });
});

describe('profiles', () => {
  it('owners can edit permitted fields only', async () => {
    await q(user(buyer), `update public.profiles set display_name = 'New Name', bio = 'Hello' where id = $1`, [buyer]);
    expect((await q(owner, 'select display_name from public.profiles where id = $1', [buyer])).rows[0].display_name).toBe('New Name');
    for (const col of ["account_type = 'farmer'", 'verified_at = now()', 'suspended_at = null', 'is_demo = true']) {
      const e = await fails(q(user(buyer), `update public.profiles set ${col} where id = $1`, [buyer]));
      expect(e.code).toBe('42501');
    }
  });

  it("cannot edit someone else's profile", async () => {
    const r = await q(user(buyer), `update public.profiles set display_name = 'Hacked' where id = $1`, [farmerA]);
    expect(r.rowCount).toBe(0);
  });

  it('phone numbers are private to the owner', async () => {
    expect((await q(user(buyer), 'select phone from public.profile_contacts')).rows).toEqual([{ phone: '9811122233' }]);
    expect((await q(user(farmerA), 'select * from public.profile_contacts where user_id = $1', [buyer])).rowCount).toBe(0);
    const r = await q(user(farmerA), `update public.profile_contacts set phone = '9999999999' where user_id = $1`, [buyer]);
    expect(r.rowCount).toBe(0);
  });
});

describe('listings', () => {
  it('only active farmers create listings, only for themselves', async () => {
    await createListing(farmerA);
    expect((await fails(createListing(buyer))).code).toBe('42501');
    const e = await fails(
      q(user(farmerA), `insert into public.listings (farmer_id, category_id, locality_id, produce_name, quantity_total, min_order_qty, price_per_unit_paise, availability_type, status)
                        values ($1,'tomatoes','sanaur','Tomato',10,1,1000,'ready_now','active')`, [farmerB]),
    );
    expect(e.code).toBe('42501');
    await q(owner, 'update public.profiles set suspended_at = now() where id = $1', [farmerA]);
    expect((await fails(createListing(farmerA))).code).toBe('42501');
  });

  it('protected columns cannot be written by farmers', async () => {
    const id = await createListing(farmerA);
    for (const col of ['quantity_reserved = 10', 'quantity_sold = 5', 'hidden_by_admin = false', 'is_demo = true', `farmer_id = '${farmerB}'`]) {
      const e = await fails(q(user(farmerA), `update public.listings set ${col} where id = $1`, [id]));
      expect(e.code).toBe('42501');
    }
  });

  it("farmers cannot change another farmer's listing", async () => {
    const id = await createListing(farmerA);
    const r = await q(user(farmerB), `update public.listings set price_per_unit_paise = 1 where id = $1`, [id]);
    expect(r.rowCount).toBe(0);
    const d = await q(user(farmerB), `delete from public.listings where id = $1`, [id]);
    expect(d.rowCount).toBe(0);
  });

  it('enforces the listing lifecycle', async () => {
    const id = await createListing(farmerA, { status: 'draft' });
    await q(user(farmerA), `update public.listings set status = 'active' where id = $1`, [id]);
    await q(user(farmerA), `update public.listings set status = 'paused' where id = $1`, [id]);
    await q(user(farmerA), `update public.listings set status = 'active' where id = $1`, [id]);
    const e = await fails(q(user(farmerA), `update public.listings set status = 'sold_out' where id = $1`, [id]));
    expect(e.code).toBe('23514');
    await q(user(farmerA), `update public.listings set status = 'archived' where id = $1`, [id]);
    const e2 = await fails(q(user(farmerA), `update public.listings set produce_name = 'Changed' where id = $1`, [id]));
    expect(e2.message).toMatch(/Archived listings cannot be edited/);
    const pub = (await q(owner, 'select published_at from public.listings where id = $1', [id])).rows[0];
    expect(pub.published_at).not.toBeNull();
  });

  it('only drafts can be deleted', async () => {
    const draft = await createListing(farmerA, { status: 'draft' });
    const live = await createListing(farmerA);
    expect((await q(user(farmerA), 'delete from public.listings where id = $1', [draft])).rowCount).toBe(1);
    expect((await q(user(farmerA), 'delete from public.listings where id = $1', [live])).rowCount).toBe(0);
  });

  it('a moderated listing cannot be republished by its farmer', async () => {
    const id = await createListing(farmerA);
    await q(user(farmerA), `update public.listings set status = 'paused' where id = $1`, [id]);
    await q(owner, 'update public.listings set hidden_by_admin = true where id = $1', [id]);
    const e = await fails(q(user(farmerA), `update public.listings set status = 'active' where id = $1`, [id]));
    expect(e.message).toMatch(/hidden by moderators/);
  });

  it('database constraints reject impossible listings', async () => {
    const insert = (qty: number, min: number, price: number, availability = 'ready_now') =>
      q(user(farmerA), `insert into public.listings (farmer_id, category_id, locality_id, produce_name, quantity_total, min_order_qty, price_per_unit_paise, availability_type, status)
                        values ($1,'tomatoes','sanaur','Tomato',$2,$3,$4,$5,'active')`, [farmerA, qty, min, price, availability]);
    expect((await fails(insert(0, 1, 1000))).code).toBe('23514'); // zero quantity
    expect((await fails(insert(10, 1, 0))).code).toBe('23514'); // zero price
    expect((await fails(insert(10, 20, 1000))).code).toBe('23514'); // minimum above total
    expect((await fails(insert(10, 1, 1000, 'pre_harvest'))).code).toBe('23514'); // pre-harvest needs a date
    await insert(10, 1, 1000);
  });
});

describe('listing images', () => {
  it('owners attach images under their own folder only', async () => {
    const id = await createListing(farmerA);
    await q(user(farmerA), 'insert into public.listing_images (listing_id, storage_path) values ($1, $2)', [id, `${farmerA}/${id}/a.webp`]);
    const wrongFolder = await fails(q(user(farmerA), 'insert into public.listing_images (listing_id, storage_path) values ($1, $2)', [id, `${farmerB}/${id}/b.webp`]));
    expect(wrongFolder.message).toMatch(/does not belong/);
    const other = await fails(q(user(farmerB), 'insert into public.listing_images (listing_id, storage_path) values ($1, $2)', [id, `${farmerA}/${id}/c.webp`]));
    expect(other.code).toBe('42501');
    expect((await q(anon, 'select storage_path from public.listing_images')).rowCount).toBe(1);
  });

  it('allows at most six images per listing', async () => {
    const id = await createListing(farmerA);
    for (let i = 0; i < 6; i++) {
      await q(user(farmerA), 'insert into public.listing_images (listing_id, storage_path, position) values ($1, $2, $3)', [id, `${farmerA}/${id}/${i}.webp`, i]);
    }
    const e = await fails(q(user(farmerA), 'insert into public.listing_images (listing_id, storage_path) values ($1, $2)', [id, `${farmerA}/${id}/7.webp`]));
    expect(e.message).toMatch(/at most 6/);
  });
});

describe('favourites', () => {
  it('buyers save listings; nobody sees anyone else’s favourites', async () => {
    const id = await createListing(farmerA);
    await q(user(buyer), 'insert into public.favorites (user_id, listing_id) values ($1, $2)', [buyer, id]);
    expect((await q(user(buyer2), 'select * from public.favorites')).rowCount).toBe(0);
    expect((await fails(q(user(farmerB), 'insert into public.favorites (user_id, listing_id) values ($1, $2)', [farmerB, id]))).code).toBe('42501');
    expect((await fails(q(user(buyer2), 'insert into public.favorites (user_id, listing_id) values ($1, $2)', [buyer, id]))).code).toBe('42501');
  });
});

describe('notifications', () => {
  it('users read and mark only their own notifications', async () => {
    const id = await createListing(farmerA);
    await rpc(user(buyer), 'create_offer', { p_listing_id: id, p_quantity: 10, p_price_per_unit_paise: 150000 });
    const mine = await q<{ id: string }>(user(farmerA), 'select id from public.notifications');
    expect(mine.rowCount).toBe(1);
    expect((await q(user(buyer2), 'select id from public.notifications')).rowCount).toBe(0);
    expect((await q(user(buyer2), 'update public.notifications set read_at = now() where id = $1', [mine.rows[0].id])).rowCount).toBe(0);
    await q(user(farmerA), 'update public.notifications set read_at = now() where id = $1', [mine.rows[0].id]);
    const e = await fails(q(user(farmerA), `update public.notifications set title = 'x' where id = $1`, [mine.rows[0].id]));
    expect(e.code).toBe('42501');
    const ins = await fails(q(user(farmerA), `insert into public.notifications (user_id, type, title) values ($1, 'offer_received', 'fake')`, [farmerA]));
    expect(ins.code).toBe('42501');
  });
});

describe('reports and moderation', () => {
  it('users report listings they can see, but not their own; only admins see all reports', async () => {
    const id = await createListing(farmerA);
    await q(user(buyer), `insert into public.reports (reporter_id, listing_id, reason, details) values ($1, $2, 'misleading', 'Photos look old')`, [buyer, id]);
    const own = await fails(q(user(farmerA), `insert into public.reports (reporter_id, listing_id, reason) values ($1, $2, 'spam')`, [farmerA, id]));
    expect(own.message).toMatch(/own listing/);
    const status = await fails(q(user(buyer2), `insert into public.reports (reporter_id, listing_id, reason, status) values ($1, $2, 'spam', 'actioned')`, [buyer2, id]));
    expect(status.code).toBe('42501');
    expect((await q(user(buyer2), 'select * from public.reports')).rowCount).toBe(0);
    expect((await q(user(buyer), 'select * from public.reports')).rowCount).toBe(1);
    expect((await q(user(admin), 'select * from public.reports')).rowCount).toBe(1);
  });

  it('admin functions refuse non-admins and audit admins', async () => {
    const id = await createListing(farmerA);
    const e = await fails(rpc(user(buyer), 'admin_set_listing_hidden', { p_listing_id: id, p_hidden: true, p_reason: 'test' }));
    expect(e.message).toBe('ADMIN_ONLY');
    await rpc(user(admin), 'admin_set_listing_hidden', { p_listing_id: id, p_hidden: true, p_reason: 'Misleading photos' });
    expect((await q(anon, 'select id from public.listings')).rowCount).toBe(0);
    const audit = await q(user(admin), 'select action from public.audit_events');
    expect(audit.rows.map((r) => r.action)).toContain('listing.hide');
    expect((await q(user(buyer), 'select * from public.audit_events')).rowCount).toBe(0);
    expect((await fails(rpc(user(buyer), 'admin_list_users', {}))).message).toBe('ADMIN_ONLY');
    const users = await q(user(admin), 'select * from public.admin_list_users()');
    expect(users.rowCount).toBe(5);
    expect(Object.keys(users.rows[0])).not.toContain('phone');
  });

  it('admins cannot suspend themselves; suspension blocks activity', async () => {
    expect((await fails(rpc(user(admin), 'admin_set_user_suspended', { p_user_id: admin, p_suspended: true, p_reason: 'x y z' }))).message).toBe('CANNOT_SUSPEND_SELF');
    const id = await createListing(farmerA);
    await rpc(user(admin), 'admin_set_user_suspended', { p_user_id: buyer, p_suspended: true, p_reason: 'Repeated spam offers' });
    const e = await fails(rpc(user(buyer), 'create_offer', { p_listing_id: id, p_quantity: 10, p_price_per_unit_paise: 150000 }));
    expect(e.message).toBe('ACCOUNT_SUSPENDED');
  });

  it('verification is admin-only and needs a note', async () => {
    expect((await fails(rpc(user(admin), 'admin_set_farmer_verified', { p_user_id: farmerA, p_verified: true, p_note: '' }))).message).toBe('NOTE_REQUIRED');
    await rpc(user(admin), 'admin_set_farmer_verified', { p_user_id: farmerA, p_verified: true, p_note: 'Aadhaar and land record seen in person' });
    expect((await q(anon, 'select verified_at from public.profiles where id = $1', [farmerA])).rows[0].verified_at).not.toBeNull();
  });
});

describe('storage policies', () => {
  const insertObject = (who: string, bucket: string, name: string) =>
    q(user(who), `insert into storage.objects (bucket_id, name, owner, owner_id) values ($1, $2, $3::uuid, $3::text)`, [bucket, name, who]);

  it('farmers upload only into their own listing folders', async () => {
    const id = await createListing(farmerA);
    await insertObject(farmerA, 'listing-images', `${farmerA}/${id}/one.webp`);
    expect((await fails(insertObject(farmerB, 'listing-images', `${farmerA}/${id}/two.webp`))).code).toBe('42501');
    expect((await fails(insertObject(farmerB, 'listing-images', `${farmerB}/${id}/three.webp`))).code).toBe('42501');
    expect((await fails(insertObject(farmerA, 'listing-images', `${farmerA}/not-a-uuid/x.webp`))).code).toBe('42501');
    expect((await fails(insertObject(buyer, 'listing-images', `${buyer}/${id}/x.webp`))).code).toBe('42501');
    const del = await q(user(farmerB), `delete from storage.objects where name = $1`, [`${farmerA}/${id}/one.webp`]);
    expect(del.rowCount).toBe(0);
  });

  it('avatars go only into the owner’s folder', async () => {
    await insertObject(buyer, 'avatars', `${buyer}/me.webp`);
    expect((await fails(insertObject(buyer, 'avatars', `${buyer2}/me.webp`))).code).toBe('42501');
  });
});

describe('payments groundwork', () => {
  it('clients cannot touch payment data; only the service role applies verified events, once', async () => {
    const listing = await createListing(farmerA);
    const offer = await rpc<string>(user(buyer), 'create_offer', { p_listing_id: listing, p_quantity: 10, p_price_per_unit_paise: 150000 });
    const o = (await q(owner, 'select version from public.offers where id = $1', [offer])).rows[0];
    const orderId = await rpc<string>(user(farmerA), 'accept_offer', { p_offer_id: offer, p_expected_version: o.version });

    expect((await fails(q(user(buyer), `update public.orders set payment_status = 'paid' where id = $1`, [orderId]))).code).toBe('42501');
    expect((await fails(q(user(buyer), `insert into public.payments (order_id, provider, amount_paise) values ($1, 'razorpay', 1)`, [orderId]))).code).toBe('42501');
    const args = { p_provider: 'razorpay', p_provider_event_id: 'evt_1', p_event_type: 'payment.captured', p_payload: {}, p_signature_verified: true };
    expect((await fails(rpc(user(buyer), 'apply_payment_event', args))).code).toBe('42501');

    await q(owner, `insert into public.payments (order_id, provider, provider_order_id, amount_paise) values ($1, 'razorpay', 'order_X', 1500000)`, [orderId]);
    const payload = { payload: { payment: { entity: { id: 'pay_1', order_id: 'order_X', amount: 1500000 } } } };
    expect(await rpc(service, 'apply_payment_event', { ...args, p_payload: payload })).toBe('applied: captured');
    expect(await rpc(service, 'apply_payment_event', { ...args, p_payload: payload })).toBe('duplicate');
    expect((await q(owner, 'select payment_status from public.orders where id = $1', [orderId])).rows[0].payment_status).toBe('paid');

    const unverified = await rpc(service, 'apply_payment_event', { ...args, p_provider_event_id: 'evt_2', p_signature_verified: false, p_payload: payload });
    expect(unverified).toBe('rejected');
    const mismatch = await rpc(service, 'apply_payment_event', {
      ...args, p_provider_event_id: 'evt_3', p_payload: { payload: { payment: { entity: { id: 'pay_2', order_id: 'order_X', amount: 1 } } } },
    });
    expect(mismatch).toBe('flagged: amount mismatch');
    // Participants can read the payment row for their order; others cannot.
    expect((await q(user(buyer), 'select status from public.payments')).rows[0].status).toBe('captured');
    expect((await q(user(buyer2), 'select status from public.payments')).rowCount).toBe(0);
  });
});
