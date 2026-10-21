import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils';
import { requireAdmin } from '@/server/auth';

export const metadata: Metadata = { title: 'Audit log' };

export default async function AdminAudit() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from('audit_events').select('id, actor_id, actor_role, action, target_type, target_id, details, created_at').order('id', { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await supabase.from('profiles').select('id, display_name').in('id', actorIds) : { data: [] };
  const name = new Map((actors ?? []).map((a) => [a.id as string, a.display_name as string]));
  return (
    <>
      <PageHeader title="Audit log" description="Administrator actions, order cancellations and payment events, newest first. Entries cannot be edited or deleted from the app." />
      {rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line bg-paper text-[13px] text-muted">
              <tr>
                <th className="p-3 font-semibold">When</th>
                <th className="p-3 font-semibold">Who</th>
                <th className="p-3 font-semibold">Action</th>
                <th className="p-3 font-semibold">Target</th>
                <th className="p-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap p-3 text-muted">{formatDateTime(r.created_at)}</td>
                  <td className="p-3">
                    {r.actor_id ? (name.get(r.actor_id) ?? r.actor_id.slice(0, 8)) : 'system'} <span className="text-muted">({r.actor_role})</span>
                  </td>
                  <td className="p-3 font-mono text-[13px]">{r.action}</td>
                  <td className="p-3 font-mono text-[13px]">
                    {r.target_type}:{String(r.target_id ?? '').slice(0, 8)}
                  </td>
                  <td className="max-w-[320px] break-words p-3 text-[13px] text-muted">
                    {Object.entries((r.details ?? {}) as Record<string, unknown>)
                      .filter(([, v]) => v !== null && v !== '')
                      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                      .join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Nothing logged yet" />
      )}
    </>
  );
}
