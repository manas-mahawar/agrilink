'use client';

import * as React from 'react';
import type { ActionResult } from '@/server/actions/shared';

/**
 * Wraps a Server Action for a form.
 * - Unlike `<form action={fn}>`, the form is NOT cleared when the action returns an error,
 *   so people don't have to retype everything.
 * - `onResult` runs as soon as the action returns — before the refreshed page may unmount
 *   the form — which makes it the right place for toasts.
 * - Without JavaScript the plain `action` still works (progressive enhancement).
 */
export function useFormAction<T>(
  fn: (prev: ActionResult<T> | null, form: FormData) => Promise<ActionResult<T>>,
  opts: { onResult?: (result: ActionResult<T>) => void } = {},
) {
  const [noJsState, formAction] = React.useActionState(fn, null);
  const [jsState, setJsState] = React.useState<ActionResult<T> | null>(null);
  const [pending, startTransition] = React.useTransition();
  const onResult = React.useRef(opts.onResult);
  React.useEffect(() => {
    onResult.current = opts.onResult;
  });

  const onSubmit = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
      startTransition(async () => {
        const result = await fn(null, fd);
        // A redirect() in the action never returns here; Next.js navigates instead.
        setJsState(result);
        onResult.current?.(result);
      });
    },
    [fn],
  );

  const state = jsState ?? noJsState;
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const formError = state && !state.ok ? (fieldErrors?._form ?? (fieldErrors && Object.keys(fieldErrors).length ? undefined : state.error)) : undefined;
  return { state, pending, formProps: { action: formAction, onSubmit, noValidate: true }, fieldErrors, formError };
}
