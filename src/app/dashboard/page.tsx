import { redirect } from 'next/navigation';
import { dashboardHome, requireUser } from '@/server/auth';

export default async function DashboardIndex() {
  const user = await requireUser('/dashboard');
  redirect(dashboardHome(user));
}
