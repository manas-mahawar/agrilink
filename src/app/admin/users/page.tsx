import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminAction } from '@/components/admin/admin-action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { requireAdmin } from '@/server/auth';

export const metadata: Metadata = { title: 'Users' };

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  account_type: 'farmer' | 'buyer';
  organisation_name: string | null;
  district: string | null;
  created_at: string;
  verified_at: string | null;
  suspended_at: string | null;
  is_demo: boolean;
  listing_count: number;
  order_count: number;
  is_admin: boolean;
}

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireAdmin();
  const { q = '' } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_list_users', { p_search: q.slice(0, 80) || null, p_limit: 100, p_offset: 0 });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as UserRow[];

  return (
    <>
      <PageHeader
        title="Users"
        description="Phone numbers are not shown here. Verify a farmer only after checking their identity and farm, and record how you checked."
      />
      <form className="flex flex-wrap gap-2" action="/admin/users">
        <label htmlFor="au-q" className="sr-only">
          Search users
        </label>
        <Input id="au-q" name="q" defaultValue={q} placeholder="Name, business or email" className="max-w-sm" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line bg-paper text-[13px] text-muted">
              <tr>
                <th className="p-3 font-semibold">Person</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Activity</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((u) => (
                <tr key={u.id} className="align-top">
                  <td className="p-3">
                    <p className="font-semibold">
                      {u.account_type === 'farmer' ? (
                        <Link href={`/farmers/${u.id}`} className="text-forest hover:underline">
                          {u.display_name}
                        </Link>
                      ) : (
                        u.display_name
                      )}
                    </p>
                    {u.organisation_name ? <p className="text-muted">{u.organisation_name}</p> : null}
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>
                  <td className="p-3 capitalize">
                    {u.account_type}
                    {u.is_admin ? <Badge tone="forest" className="ml-2">Admin</Badge> : null}
                    {u.is_demo ? <Badge tone="demo" className="ml-2">Demo</Badge> : null}
                    <p className="text-xs normal-case text-muted">Joined {formatDate(u.created_at)}</p>
                  </td>
                  <td className="tabular p-3 text-muted">
                    {Number(u.listing_count)} listings · {Number(u.order_count)} orders
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {u.suspended_at ? <Badge tone="danger">Suspended</Badge> : <Badge tone="ok">Active</Badge>}
                      {u.account_type === 'farmer' ? u.verified_at ? <Badge tone="ok">Verified</Badge> : <Badge tone="neutral">Not verified</Badge> : null}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {u.account_type === 'farmer' ? (
                        u.verified_at ? (
                          <AdminAction kind="verifyFarmer" fields={{ userId: u.id, verified: 'false' }} label="Remove verification" title="Remove verification?" textField={{ name: 'note', label: 'Reason' }} confirmLabel="Remove" />
                        ) : (
                          <AdminAction
                            kind="verifyFarmer"
                            fields={{ userId: u.id, verified: 'true' }}
                            label="Verify"
                            title={`Verify ${u.display_name}?`}
                            description="Buyers will see a Verified badge on this farmer’s listings and profile."
                            textField={{ name: 'note', label: 'How was this farmer verified?', placeholder: 'e.g. Aadhaar and land record seen in person at Sanaur on 20 Oct' }}
                            textRequired
                            confirmLabel="Mark verified"
                            variant="primary"
                          />
                        )
                      ) : null}
                      {u.id === me.id ? null : u.suspended_at ? (
                        <AdminAction kind="suspendUser" fields={{ userId: u.id, suspended: 'false' }} label="Lift suspension" title="Lift this suspension?" confirmLabel="Lift suspension" />
                      ) : (
                        <AdminAction
                          kind="suspendUser"
                          fields={{ userId: u.id, suspended: 'true' }}
                          label="Suspend"
                          title={`Suspend ${u.display_name}?`}
                          description="They can still sign in and see their history, but cannot list, make offers or change orders. Their listings leave the marketplace."
                          textField={{ name: 'reason', label: 'Reason' }}
                          textRequired
                          confirmLabel="Suspend"
                          variant="danger"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No users found" />
      )}
    </>
  );
}
