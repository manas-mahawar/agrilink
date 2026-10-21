import { BadgeCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ProfileForm } from '@/components/dashboard/profile-form';
import { Card, PageHeader } from '@/components/ui/primitives';
import { formatDate } from '@/lib/utils';
import { requireUser } from '@/server/auth';
import { getOwnProfile } from '@/server/data/dashboard';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const user = await requireUser('/dashboard/profile');
  const profile = await getOwnProfile(user.id);
  return (
    <>
      <PageHeader
        title="Profile"
        description={user.accountType === 'farmer' ? 'Your name, village and description appear on your public farmer profile.' : 'Farmers see your business name when you make an offer.'}
        actions={
          user.accountType === 'farmer' ? (
            <Link href={`/farmers/${user.id}`} className="text-sm font-semibold text-forest underline">
              View public profile
            </Link>
          ) : undefined
        }
      />
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-5 text-sm">
        <span>
          <span className="text-muted">Email:</span> <strong>{user.email}</strong>
        </span>
        <span className="capitalize">
          <span className="text-muted">Account:</span> <strong>{user.accountType}</strong>
        </span>
        <span>
          <span className="text-muted">Member since:</span> <strong>{profile ? formatDate(profile.created_at) : '—'}</strong>
        </span>
        {user.accountType === 'farmer' ? (
          user.verifiedAt ? (
            <span className="inline-flex items-center gap-1.5 text-ok-fg">
              <BadgeCheck className="size-4" aria-hidden="true" /> Verified on {formatDate(user.verifiedAt)}
            </span>
          ) : (
            <span className="text-muted">Not yet verified — the AgriLink team verifies farmers after checking identity and farm.</span>
          )
        ) : null}
      </Card>
      <ProfileForm
        accountType={user.accountType}
        values={{
          displayName: profile?.display_name ?? user.displayName,
          organisationName: profile?.organisation_name ?? '',
          buyerType: profile?.buyer_type ?? '',
          district: profile?.district ?? '',
          village: profile?.village ?? '',
          bio: profile?.bio ?? '',
          phone: profile?.phone ?? '',
        }}
      />
      <p className="text-sm text-muted">
        To change your email, password or account type, or to delete your account, use{' '}
        <Link href="/forgot-password" className="font-semibold text-forest underline">
          password reset
        </Link>{' '}
        or <Link href="/contact" className="font-semibold text-forest underline">contact us</Link>.
      </p>
    </>
  );
}
