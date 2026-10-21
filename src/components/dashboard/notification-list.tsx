'use client';

import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { cn, formatDateTime } from '@/lib/utils';
import { markNotificationsReadAction } from '@/server/actions/account';
import type { NotificationView } from '@/server/data/types';

export function NotificationList({ items }: { items: NotificationView[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const unread = items.filter((n) => !n.readAt);

  const markAll = () =>
    startTransition(async () => {
      const res = await markNotificationsReadAction('all');
      if (!res.ok) toast.error(res.error);
    });
  const open = (n: NotificationView) => {
    if (!n.readAt) startTransition(() => void markNotificationsReadAction([n.id]));
    if (n.linkPath) router.push(n.linkPath);
  };

  if (!items.length) {
    return (
      <EmptyState icon={<Bell />} title="No notifications yet">
        You’ll be notified here about new offers, counter-offers and order updates.
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted" aria-live="polite">
          {unread.length ? `${unread.length} unread` : 'All caught up'}
        </p>
        {unread.length ? (
          <Button size="sm" variant="secondary" onClick={markAll} disabled={pending}>
            <CheckCheck /> Mark all as read
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
        {items.map((n) => {
          const body = (
            <>
              <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-saffron')} aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn('text-[15px]', !n.readAt && 'font-semibold')}>
                  {n.title}
                  {!n.readAt ? <span className="sr-only"> (unread)</span> : null}
                </span>
                {n.body ? <span className="text-sm text-muted">{n.body}</span> : null}
                <span className="text-xs text-muted">{formatDateTime(n.createdAt)}</span>
              </span>
            </>
          );
          return (
            <li key={n.id}>
              {n.linkPath ? (
                <Link
                  href={n.linkPath}
                  onClick={(e) => {
                    e.preventDefault();
                    open(n);
                  }}
                  className="flex gap-3 p-4 hover:bg-paper"
                >
                  {body}
                </Link>
              ) : (
                <button type="button" onClick={() => open(n)} className="flex w-full gap-3 p-4 text-left hover:bg-paper">
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
