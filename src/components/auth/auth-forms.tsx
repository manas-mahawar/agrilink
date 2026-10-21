'use client';

import { Eye, EyeOff, MailCheck, Sprout, Store } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormError, Input, Select } from '@/components/ui/form-controls';
import { Notice } from '@/components/ui/primitives';
import { SubmitButton } from '@/components/ui/submit-button';
import { useFormAction } from '@/components/ui/use-form-action';
import { BUYER_TYPE_LABEL, BUYER_TYPES } from '@/domain/validation';
import { cn } from '@/lib/utils';
import { demoSignInAction, forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from '@/server/actions/auth';

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-12" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:text-ink"
      >
        {show ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
      </button>
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const { pending, formProps, fieldErrors: fe, formError } = useFormAction(signInAction);
  return (
    <form {...formProps} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormError message={formError} />
      <Field id="login-email" label="Email" error={fe?.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}
      </Field>
      <Field id="login-password" label="Password" error={fe?.password}>
        {(p) => <PasswordInput {...p} name="password" autoComplete="current-password" required />}
      </Field>
      <div className="-mt-1 flex justify-end">
        <Link href="/forgot-password" className="inline-flex min-h-10 items-center text-sm font-semibold text-forest hover:underline">
          Forgot password?
        </Link>
      </div>
      <SubmitButton size="lg" pending={pending} pendingLabel="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}

export function DemoSignIn() {
  const [pending, startTransition] = React.useTransition();
  const go = (role: 'farmer' | 'buyer') =>
    startTransition(async () => {
      const res = await demoSignInAction(role);
      if (res && !res.ok) toast.error(res.error);
    });
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-line-strong bg-paper p-4">
      <p className="text-sm">
        <strong>Demo environment.</strong> Explore with a sample account — its data is illustrative and separate from the real marketplace.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" disabled={pending} onClick={() => go('farmer')}>
          <Sprout /> Demo farmer
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => go('buyer')}>
          <Store /> Demo buyer
        </Button>
      </div>
    </div>
  );
}

export function RegisterForm({ initialRole, next }: { initialRole: 'farmer' | 'buyer'; next?: string }) {
  const { state, pending, formProps, fieldErrors: fe, formError } = useFormAction(signUpAction);
  const [role, setRole] = React.useState<'farmer' | 'buyer'>(initialRole);

  if (state?.ok) {
    return (
      <div className="flex flex-col items-start gap-3" role="status">
        <span className="flex size-12 items-center justify-center rounded-full bg-ok-bg text-ok-fg">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-extrabold">Check your email</h2>
        <p className="text-ink-soft">{state.message}</p>
        <p className="text-sm text-muted">Didn’t get it? Check spam, or wait a minute and register again with the same email.</p>
      </div>
    );
  }

  return (
    <form {...formProps} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormError message={formError} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">I want to</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {(
            [
              ['farmer', Sprout, 'Sell my produce', 'List crops before harvest'],
              ['buyer', Store, 'Buy produce', 'For shops, restaurants, hotels, processors'],
            ] as const
          ).map(([value, Icon, title, sub]) => (
            <label
              key={value}
              className={cn(
                'flex min-h-[76px] cursor-pointer gap-3 rounded-[10px] border-2 p-3.5 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-saffron',
                role === value ? 'border-forest bg-sage-soft' : 'border-line-strong bg-white',
              )}
            >
              <input type="radio" name="accountType" value={value} checked={role === value} onChange={() => setRole(value)} className="sr-only" />
              <Icon className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden="true" />
              <span className="flex flex-col">
                <strong className="text-[15px]">{title}</strong>
                <span className="text-[13px] text-muted">{sub}</span>
              </span>
            </label>
          ))}
        </div>
        {fe?.accountType ? <p className="text-[13px] font-medium text-danger">{fe.accountType}</p> : null}
      </fieldset>
      <Field id="reg-name" label="Your full name" error={fe?.displayName}>
        {(p) => <Input {...p} name="displayName" autoComplete="name" required maxLength={80} />}
      </Field>
      {role === 'buyer' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="reg-org" label="Business name" error={fe?.organisationName}>
            {(p) => <Input {...p} name="organisationName" autoComplete="organization" maxLength={120} />}
          </Field>
          <Field id="reg-btype" label="Type of business" optional error={fe?.buyerType}>
            {(p) => (
              <Select {...p} name="buyerType" defaultValue="">
                <option value="">Choose…</option>
                {BUYER_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {BUYER_TYPE_LABEL[b]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="reg-district" label="District" optional error={fe?.district}>
          {(p) => <Input {...p} name="district" defaultValue="Patiala" maxLength={80} />}
        </Field>
        <Field id="reg-phone" label="Mobile number" optional hint="Shared only with the other side of a confirmed order." error={fe?.phone}>
          {(p) => <Input {...p} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" />}
        </Field>
      </div>
      <Field id="reg-email" label="Email" error={fe?.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}
      </Field>
      <Field id="reg-password" label="Password" hint="At least 8 characters, with letters and a number." error={fe?.password}>
        {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" required />}
      </Field>
      <div>
        <label htmlFor="reg-terms" className="flex cursor-pointer items-start gap-2.5 text-sm">
          <Checkbox id="reg-terms" name="acceptTerms" className="mt-0.5" aria-invalid={fe?.acceptTerms ? true : undefined} />
          <span>
            I agree to the{' '}
            <Link href="/terms" target="_blank" className="font-semibold text-forest underline">
              terms of use
            </Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" className="font-semibold text-forest underline">
              privacy notice
            </Link>
            .
          </span>
        </label>
        {fe?.acceptTerms ? <p className="mt-1.5 text-[13px] font-medium text-danger">{fe.acceptTerms}</p> : null}
      </div>
      <SubmitButton size="lg" pending={pending} pendingLabel="Creating account…">
        Create {role} account
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { state, pending, formProps, fieldErrors: fe, formError } = useFormAction(forgotPasswordAction);
  if (state?.ok) return <Notice tone="ok">{state.message}</Notice>;
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <FormError message={formError} />
      <Field id="forgot-email" label="Email" error={fe?.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}
      </Field>
      <SubmitButton size="lg" pending={pending} pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const { pending, formProps, fieldErrors: fe, formError } = useFormAction(resetPasswordAction);
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <FormError message={formError} />
      <Field id="reset-password" label="New password" hint="At least 8 characters, with letters and a number." error={fe?.password}>
        {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" required />}
      </Field>
      <Field id="reset-confirm" label="Confirm new password" error={fe?.confirmPassword}>
        {(p) => <PasswordInput {...p} name="confirmPassword" autoComplete="new-password" required />}
      </Field>
      <SubmitButton size="lg" pending={pending} pendingLabel="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}
