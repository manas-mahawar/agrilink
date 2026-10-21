// Guard against accidental exposure: on Supabase every new function in `public` is
// executable by anon/authenticated by default. Only this allowlist may be callable.
import { afterAll, describe, expect, it } from 'vitest';
import { owner, pool, q } from './helpers';

afterAll(async () => {
  await pool.end();
});

const POLICY_HELPERS = [
  'current_account_type', 'demo_data_visible', 'has_deal_on_listing', 'is_active_account', 'is_active_farmer',
  'is_admin', 'is_api_role', 'is_public_seller', 'shares_deal_with', 'try_uuid',
];
const ANON = [...POLICY_HELPERS, 'get_farmer_stats', 'search_listings'].sort();
const AUTHENTICATED = [
  ...ANON,
  'accept_offer', 'admin_list_users', 'admin_overview', 'admin_resolve_report', 'admin_set_farmer_verified',
  'admin_set_listing_hidden', 'admin_set_user_suspended', 'counter_offer', 'create_offer', 'get_order_contacts',
  'owns_listing_folder', 'reject_offer', 'review_order', 'transition_order', 'withdraw_offer',
].sort();

async function callable(role: string) {
  const r = await q<{ proname: string }>(
    owner,
    `select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype
        and has_function_privilege($1, p.oid, 'execute') order by 1`,
    [role],
  );
  return r.rows.map((x) => x.proname);
}

describe('function privileges', () => {
  it('anon can execute only the policy helpers and public stats', async () => {
    expect(await callable('anon')).toEqual(ANON);
  });
  it('authenticated can execute only the API functions', async () => {
    expect(await callable('authenticated')).toEqual(AUTHENTICATED);
  });
  it('every public table has row level security enabled', async () => {
    const r = await q<{ relname: string }>(
      owner,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(r.rows).toEqual([]);
  });
  it('views run with the caller’s permissions', async () => {
    const r = await q<{ relname: string; opts: string[] | null }>(
      owner,
      `select c.relname, c.reloptions as opts from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'v'`,
    );
    for (const v of r.rows) expect(v.opts ?? []).toContain('security_invoker=true');
  });
});
