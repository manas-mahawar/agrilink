import type { Metadata } from 'next';
import { NotificationList } from '@/components/dashboard/notification-list';
import { PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/server/auth';
import { listNotifications } from '@/server/data/dashboard';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  await requireUser('/dashboard/notifications');
  const items = await listNotifications(100);
  return (
    <>
      <PageHeader title="Notifications" />
      <NotificationList items={items} />
    </>
  );
}
