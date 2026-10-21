import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminAction } from '@/components/admin/admin-action';
import { Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { REPORT_REASON_LABEL } from '@/domain/validation';
import { createClient } from '@/lib/supabase/server';
import { cn, formatDateTime } from '@/lib/utils';
import { requireAdmin } from '@/server/auth';

export const metadata: Metadata = { title: 'Reports' };

type Row = Record<string, unknown> & { listing: Record<string, unknown> | null; reporter: Record<string, unknown> | null; reported: Record<string, unknown> | null };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = 'open' } = await searchParams;
  const supabase = await createClient();
  let q = supabase
    .from('reports')
    .select(
      'id, reason, details, status, resolution_note, created_at, resolved_at, listing_id, reported_user_id, listing:listings(id, produce_name, variety, hidden_by_admin, farmer_id), reporter:profiles!reports_reporter_id_fkey(display_name), reported:profiles!reports_reported_user_id_fkey(id, display_name, suspended_at)',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  q = status === 'closed' ? q.in('status', ['actioned', 'dismissed']) : q.in('status', ['open', 'reviewing']);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Reports" description="Reports from signed-in users about listings and people. Reporters are not identified to the person reported." />
      <nav aria-label="Report filters" className="flex gap-2">
        {[
          ['open', 'To review'],
          ['closed', 'Closed'],
        ].map(([k, l]) => (
          <Link
            key={k}
            href={`/admin/reports?status=${k}`}
            aria-current={status === k ? 'page' : undefined}
            className={cn('inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium', status === k ? 'border-forest bg-forest text-white' : 'border-line-strong bg-white')}
          >
            {l}
          </Link>
        ))}
      </nav>
      {rows.length ? (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const listingTitle = r.listing ? `${r.listing.produce_name}${r.listing.variety ? ` · ${r.listing.variety}` : ''}` : null;
            return (
              <li key={String(r.id)} className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.status === 'open' ? 'wait' : r.status === 'reviewing' ? 'info' : r.status === 'actioned' ? 'ok' : 'neutral'}>{String(r.status)}</Badge>
                  <strong>{REPORT_REASON_LABEL[r.reason as keyof typeof REPORT_REASON_LABEL] ?? String(r.reason)}</strong>
                  <span className="text-sm text-muted">· {formatDateTime(String(r.created_at))} · from {String(r.reporter?.display_name ?? 'unknown')}</span>
                </div>
                <p className="text-sm">
                  {listingTitle ? (
                    <>
                      Listing:{' '}
                      <Link href={`/admin/listings?q=${encodeURIComponent(String(r.listing?.produce_name ?? ''))}`} className="font-semibold text-forest underline">
                        {listingTitle}
                      </Link>
                      {r.listing?.hidden_by_admin ? <Badge tone="danger" className="ml-2">Hidden</Badge> : null}
                    </>
                  ) : (
                    <>
                      Person:{' '}
                      <Link href={`/admin/users?q=${encodeURIComponent(String(r.reported?.display_name ?? ''))}`} className="font-semibold text-forest underline">
                        {String(r.reported?.display_name ?? 'unknown')}
                      </Link>
                      {r.reported?.suspended_at ? <Badge tone="danger" className="ml-2">Suspended</Badge> : null}
                    </>
                  )}
                </p>
                {r.details ? <p className="rounded-md bg-paper p-3 text-sm">{String(r.details)}</p> : null}
                {r.resolution_note ? <p className="text-sm text-muted">Note: {String(r.resolution_note)}</p> : null}
                {status !== 'closed' ? (
                  <div className="flex flex-wrap gap-2">
                    <AdminAction
                      kind="resolveReport"
                      fields={{ reportId: String(r.id) }}
                      label="Resolve"
                      title="Resolve report"
                      statusChoice
                      textField={{ name: 'note', label: 'Internal note' }}
                      confirmLabel="Save outcome"
                      variant="primary"
                    />
                    {r.listing && !r.listing.hidden_by_admin ? (
                      <AdminAction
                        kind="hideListing"
                        fields={{ listingId: String(r.listing.id), hidden: 'true' }}
                        label="Hide listing"
                        title="Hide this listing?"
                        description="It disappears from the marketplace and open offers on it are closed. The farmer is told the reason."
                        textField={{ name: 'reason', label: 'Reason shown to the farmer' }}
                        textRequired
                        confirmLabel="Hide listing"
                        variant="danger"
                      />
                    ) : null}
                    {r.reported && !r.reported.suspended_at ? (
                      <AdminAction
                        kind="suspendUser"
                        fields={{ userId: String(r.reported.id), suspended: 'true' }}
                        label="Suspend account"
                        title="Suspend this account?"
                        description="They can still sign in and see their history, but cannot list, make offers or change orders."
                        textField={{ name: 'reason', label: 'Reason' }}
                        textRequired
                        confirmLabel="Suspend"
                        variant="danger"
                      />
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title={status === 'closed' ? 'No closed reports' : 'No reports to review'} />
      )}
    </>
  );
}
