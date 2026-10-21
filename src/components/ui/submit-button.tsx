'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from './button';

/** A submit button that disables itself and shows progress while its form action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  pending: pendingProp,
  ...props
}: ButtonProps & { pendingLabel?: string; /** Pass when the form is submitted via useFormAction. */ pending?: boolean }) {
  const status = useFormStatus();
  const pending = status.pending || Boolean(pendingProp);
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending ? (
        <>
          <svg viewBox="0 0 24 24" className="animate-spin" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {pendingLabel ?? 'Working…'}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
