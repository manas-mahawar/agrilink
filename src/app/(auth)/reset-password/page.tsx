import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/auth/auth-forms';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/primitives';
import { SCENES } from '@/content/images';
import { getSessionUser } from '@/server/auth';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };

export default async function ResetPasswordPage() {
  // The emailed link signs the person in (see /auth/confirm); without that session there is
  // nothing to reset.
  const user = await getSessionUser();
  return (
    <AuthShell image={SCENES.womanFarmerCrop} quote="Find the buyer before the produce becomes a distress sale." title="Choose a new password">
      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="flex flex-col gap-4">
          <Notice tone="warn">This page opens from the link in your password reset email. The link may have expired.</Notice>
          <Button asChild>
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
