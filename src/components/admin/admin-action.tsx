'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Field, FormError, Select, Textarea } from '@/components/ui/form-controls';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import { SubmitButton } from '@/components/ui/submit-button';
import { useFormAction } from '@/components/ui/use-form-action';
import {
  adminCancelOrderAction,
  adminResolveReportAction,
  adminSetFarmerVerifiedAction,
  adminSetListingHiddenAction,
  adminSetUserSuspendedAction,
} from '@/server/actions/admin';
import type { ActionResult } from '@/server/actions/shared';

const ACTIONS = {
  hideListing: adminSetListingHiddenAction,
  suspendUser: adminSetUserSuspendedAction,
  verifyFarmer: adminSetFarmerVerifiedAction,
  resolveReport: adminResolveReportAction,
  cancelOrder: adminCancelOrderAction,
} satisfies Record<string, (p: ActionResult | null, f: FormData) => Promise<ActionResult>>;

/** A button that opens a confirmation dialog and runs one audited admin action. */
export function AdminAction({
  kind,
  fields,
  label,
  title,
  description,
  textField,
  textRequired,
  statusChoice,
  confirmLabel,
  variant = 'secondary',
}: {
  kind: keyof typeof ACTIONS;
  fields: Record<string, string>;
  label: string;
  title: string;
  description?: string;
  textField?: { name: string; label: string; placeholder?: string };
  textRequired?: boolean;
  statusChoice?: boolean;
  confirmLabel: string;
  variant?: ButtonProps['variant'];
}) {
  const [open, setOpen] = React.useState(false);
  const { pending, formProps, formError, fieldErrors: fe } = useFormAction(ACTIONS[kind], {
    onResult: (r) => {
      if (!r.ok) return;
      setOpen(false);
      toast.success(r.message ?? 'Done');
    },
  });
  const id = `${kind}-${Object.values(fields).join('-')}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent title={title} description={description}>
        <form {...formProps} className="flex flex-col gap-4">
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <FormError message={formError} />
          {statusChoice ? (
            <Field id={`${id}-status`} label="Outcome">
              {(p) => (
                <Select {...p} name="status" defaultValue="actioned">
                  <option value="actioned">Action taken — close report</option>
                  <option value="dismissed">No problem found — close report</option>
                  <option value="reviewing">Still reviewing</option>
                </Select>
              )}
            </Field>
          ) : null}
          {textField ? (
            <Field id={`${id}-text`} label={textField.label} optional={!textRequired} error={fe?.[textField.name]}>
              {(p) => <Textarea {...p} name={textField.name} rows={3} maxLength={1000} placeholder={textField.placeholder} required={textRequired} />}
            </Field>
          ) : null}
          <p className="text-[13px] text-muted">This action is recorded in the audit log with your account.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton variant={variant === 'danger' ? 'danger' : 'primary'} pending={pending} pendingLabel="Saving…">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
