// Helpers for database tests: run SQL as anonymous visitors, specific users, the service
// role or the owner, exactly like PostgREST does (SET ROLE + request.jwt.claims).
import { randomUUID } from 'node:crypto';
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.STACK_DB_URL ?? 'postgres://postgres@127.0.0.1:54322/postgres',
  max: 10,
});

export type Who = { kind: 'anon' } | { kind: 'user'; id: string } | { kind: 'service' } | { kind: 'owner' };
export const anon: Who = { kind: 'anon' };
export const owner: Who = { kind: 'owner' };
export const service: Who = { kind: 'service' };
export const user = (id: string): Who => ({ kind: 'user', id });

export interface DbError extends Error {
  code?: string;
  hint?: string;
}

/** Run `sql` as `who` inside its own transaction (committed unless it throws). */
export async function q<T extends pg.QueryResultRow = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (who.kind === 'anon') {
      await client.query('set local role anon');
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })]);
    } else if (who.kind === 'user') {
      await client.query('set local role authenticated');
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: who.id, role: 'authenticated', aud: 'authenticated' }),
      ]);
    } else if (who.kind === 'service') {
      await client.query('set local role service_role');
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })]);
    }
    const res = await client.query<T>(sql, params);
    await client.query('commit');
    return res;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Assert that a query fails; returns the database error for further checks. */
export async function fails(promise: Promise<unknown>): Promise<DbError> {
  try {
    await promise;
  } catch (e) {
    return e as DbError;
  }
  throw new Error('Expected the query to fail, but it succeeded');
}

/** Wipe all app data and auth users (keeps reference data and configuration). */
export async function resetData() {
  await q(
    owner,
    `truncate public.payment_events, public.refunds, public.payments, public.order_reviews, public.order_status_history,
              public.orders, public.offer_events, public.offers, public.reports, public.notifications, public.audit_events,
              public.favorites, public.listing_images, public.listings, public.profile_contacts, public.profiles,
              public.admins restart identity cascade`,
  );
  await q(owner, 'delete from storage.objects');
  await q(owner, 'delete from auth.users');
  await q(owner, 'update public.app_config set demo_data_visible = false');
}

let seq = 0;
/** Create an auth user exactly as Supabase Auth would; the trigger creates the profile. */
export async function createUser(opts: {
  accountType: 'farmer' | 'buyer';
  name?: string;
  phone?: string;
  organisationName?: string;
  extraMeta?: Record<string, unknown>;
}): Promise<string> {
  const id = randomUUID();
  seq += 1;
  const meta = {
    account_type: opts.accountType,
    display_name: opts.name ?? `${opts.accountType} ${seq}`,
    phone: opts.phone,
    organisation_name: opts.organisationName ?? (opts.accountType === 'buyer' ? `Business ${seq}` : undefined),
    ...opts.extraMeta,
  };
  await q(
    owner,
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now(), '{"provider":"email"}', $3, now(), now())`,
    [id, `user${seq}-${id.slice(0, 8)}@example.com`, JSON.stringify(meta)],
  );
  return id;
}

export async function makeAdmin(id: string) {
  await q(owner, 'insert into public.admins (user_id, note) values ($1, $2)', [id, 'test admin']);
}

export interface ListingOpts {
  status?: 'draft' | 'active';
  quantityTotal?: number;
  minOrderQty?: number;
  maxOrderQty?: number | null;
  pricePaise?: number;
  unit?: 'kg' | 'quintal' | 'tonne';
  produceName?: string;
}

/** Insert a listing as the farmer (through RLS, like the app does). */
export async function createListing(farmerId: string, o: ListingOpts = {}): Promise<string> {
  const r = await q<{ id: string }>(
    user(farmerId),
    `insert into public.listings (farmer_id, category_id, locality_id, produce_name, unit, quantity_total, min_order_qty, max_order_qty,
                                  price_per_unit_paise, availability_type, expected_harvest_date, quality_grade, status)
     values ($1, 'tomatoes', 'sanaur', $2, $3, $4, $5, $6, $7, 'pre_harvest', current_date + 30, 'grade_a', $8)
     returning id`,
    [
      farmerId,
      o.produceName ?? 'Tomato',
      o.unit ?? 'quintal',
      o.quantityTotal ?? 100,
      o.minOrderQty ?? 5,
      o.maxOrderQty === undefined ? null : o.maxOrderQty,
      o.pricePaise ?? 160000,
      o.status ?? 'active',
    ],
  );
  return r.rows[0].id;
}

export async function rpc<T = unknown>(who: Who, fn: string, args: Record<string, unknown>): Promise<T> {
  const names = Object.keys(args);
  const sql = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as result`;
  const r = await q<{ result: T }>(who, sql, Object.values(args));
  return r.rows[0].result;
}

export async function offerRow(id: string) {
  return (await q(owner, 'select * from public.offers where id = $1', [id])).rows[0] as Record<string, unknown> & {
    status: string;
    version: number;
  };
}
export async function listingRow(id: string) {
  return (await q(owner, 'select * from public.listings where id = $1', [id])).rows[0] as Record<string, unknown> & {
    status: string;
    quantity_reserved: string;
    quantity_sold: string;
    quantity_available: string;
  };
}
export async function orderRow(id: string) {
  return (await q(owner, 'select * from public.orders where id = $1', [id])).rows[0] as Record<string, unknown> & { status: string };
}
