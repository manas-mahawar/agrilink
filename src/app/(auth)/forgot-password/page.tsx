import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth/auth-forms';
import { AuthShell } from '@/components/auth/auth-shell';
import { SCENES } from '@/content/images';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      image={SCENES.womanFarmerCrop}
      quote="Find the buyer before the produce becomes a distress sale."
      title="Reset your password"
      description={
        <>
          Enter your account email and we’ll send a reset link.{' '}
          <Link href="/login" className="font-semibold text-forest underline">
            Back to log in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
