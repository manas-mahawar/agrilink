'use client';

import { Flag } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormError, Select, Textarea } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import { Notice } from '@/components/ui/primitives';
import { SubmitButton } from '@/components/ui/submit-button';
import { useFormAction } from '@/components/ui/use-form-action';
import { REPORT_REASON_LABEL, REPORT_REASONS } from '@/domain/validation';
import { getBrowserClient } from '@/lib/supabase/browser';
import { submitReportAction } from '@/server/actions/reports';
import { isSupabaseConfigured } from '@/lib/env';

export function ReportButton({ listingId, userId, label = 'Report this listing' }: { listingId?: string; userId?: string; label?: string }) {
  const [open, setOpen] = React.useState(false);
  const [signedIn, setSignedIn] = React.useState<boolean | null>(isSupabaseConfigured ? null : false);
  const pathname = usePathname();
  React.useEffect(() => {
    if (!open) return;
    const supabase = getBrowserClient();
    if (!supabase) return;
    supabase.auth.getClaims().then(({ data }) => setSignedIn(Boolean(data?.claims?.sub)));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted underline-offset-4 hover:text-danger hover:underline">
          <Flag className="size-4" aria-hidden="true" /> {label}
        </button>
      </DialogTrigger>
      <DialogContent title={label} description="Reports go to the AgriLink team. The person you report is not told who reported them.">
        {signedIn === false ? (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] text-ink-soft">Please log in to send a report, so the team can follow up with you.</p>
            <Button asChild>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Log in</Link>
            </Button>
          </div>
        ) : (
          <ReportForm listingId={listingId} userId={userId} onDone={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReportForm({ listingId, userId, onDone }: { listingId?: string; userId?: string; onDone: () => void }) {
  const { state, pending, formProps, fieldErrors: fe, formError } = useFormAction(submitReportAction);
  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="ok">{state.message}</Notice>
        <Button variant="secondary" onClick={onDone}>
          Close
        </Button>
      </div>
    );
  }
  return (
    <form {...formProps} className="flex flex-col gap-4">
      {listingId ? <input type="hidden" name="listingId" value={listingId} /> : null}
      {userId ? <input type="hidden" name="reportedUserId" value={userId} /> : null}
      <FormError message={formError} />
      <Field id="report-reason" label="What is wrong?" error={fe?.reason}>
        {(p) => (
          <Select {...p} name="reason" defaultValue="" required>
            <option value="" disabled>
              Choose a reason
            </option>
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {REPORT_REASON_LABEL[r]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field id="report-details" label="Details" optional error={fe?.details}>
        {(p) => <Textarea {...p} name="details" rows={4} maxLength={1000} placeholder="What did you notice?" />}
      </Field>
      <SubmitButton variant="danger" pending={pending} pendingLabel="Sending…">
        Send report
      </SubmitButton>
    </form>
  );
}
