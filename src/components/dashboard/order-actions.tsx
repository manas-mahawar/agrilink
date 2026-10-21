'use client';

import { Star } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input, Textarea } from '@/components/ui/form-controls';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import { SubmitButton } from '@/components/ui/submit-button';
import { useFormAction } from '@/components/ui/use-form-action';
import { allowedOrderActions, ORDER_ACTION_LABEL, type OrderAction, type OrderActor, type OrderStatus } from '@/domain/orders';
import { cn, todayIST } from '@/lib/utils';
import { orderTransitionAction, reviewOrderAction } from '@/server/actions/orders';

const COPY: Record<OrderAction, { title: string; description: string }> = {
  confirm: { title: 'Confirm this order', description: 'Choose the pickup or delivery date. Both sides then see each other’s phone number to arrange the details.' },
  start_preparing: { title: 'Start preparing?', description: 'Let the buyer know you are harvesting, grading or packing this order.' },
  mark_ready: { title: 'Mark as ready?', description: 'Tell the buyer the produce is ready for pickup or dispatch.' },
  complete: { title: 'Confirm you received the produce?', description: 'This completes the order. You can rate the farmer afterwards.' },
  cancel: { title: 'Cancel this order?', description: 'The reserved quantity goes back to the listing. The other side sees your reason. This can’t be undone.' },
};

export function OrderActions({ orderId, status, actor }: { orderId: string; status: OrderStatus; actor: OrderActor }) {
  const actions = allowedOrderActions(status, actor);
  if (!actions.length) return null;
  return (
    <div className="flex flex-wrap gap-2.5">
      {actions.map((a) => (
        <TransitionDialog key={a} orderId={orderId} action={a} />
      ))}
    </div>
  );
}

function TransitionDialog({ orderId, action }: { orderId: string; action: OrderAction }) {
  const [open, setOpen] = React.useState(false);
  const { pending, formProps, formError, fieldErrors: fe } = useFormAction(orderTransitionAction, {
    onResult: (r) => {
      if (!r.ok) return;
      setOpen(false);
      toast.success(r.message ?? 'Updated');
    },
  });
  const danger = action === 'cancel';
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={danger ? 'ghost' : 'primary'} className={cn(danger && 'text-danger')}>
          {ORDER_ACTION_LABEL[action]}
        </Button>
      </DialogTrigger>
      <DialogContent title={COPY[action].title} description={COPY[action].description}>
        <form {...formProps} className="flex flex-col gap-4">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="action" value={action} />
          <FormError message={formError} />
          {action === 'confirm' ? (
            <Field id={`fd-${orderId}`} label="Pickup or delivery date" error={fe?.fulfilmentDate}>
              {(p) => <Input {...p} type="date" name="fulfilmentDate" min={todayIST()} required />}
            </Field>
          ) : null}
          {action === 'confirm' || action === 'cancel' || action === 'mark_ready' ? (
            <Field id={`note-${orderId}-${action}`} label={action === 'cancel' ? 'Reason' : 'Note for the other side'} optional={action !== 'cancel'} error={fe?.note}>
              {(p) => <Textarea {...p} name="note" rows={3} maxLength={500} required={action === 'cancel'} />}
            </Field>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {danger ? 'Keep order' : 'Cancel'}
              </Button>
            </DialogClose>
            <SubmitButton variant={danger ? 'danger' : 'primary'} pending={pending} pendingLabel="Saving…">
              {ORDER_ACTION_LABEL[action]}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewForm({ orderId, farmerName }: { orderId: string; farmerName: string }) {
  const { state, pending, formProps, formError, fieldErrors: fe } = useFormAction(reviewOrderAction, {
    onResult: (r) => {
      if (r.ok) toast.success(r.message ?? 'Rating saved.');
    },
  });
  const [rating, setRating] = React.useState(0);
  if (state?.ok) return <p className="text-sm text-ok-fg">{state.message}</p>;
  return (
    <form {...formProps} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <FormError message={formError} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">How was this order with {farmerName}?</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-md p-1 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-saffron">
              <input type="radio" name="rating" value={n} className="sr-only" checked={rating === n} onChange={() => setRating(n)} />
              <Star className={cn('size-8', n <= rating ? 'fill-saffron text-saffron' : 'text-line-strong')} aria-hidden="true" />
              <span className="sr-only">
                {n} star{n > 1 ? 's' : ''}
              </span>
            </label>
          ))}
        </div>
        {fe?.rating ? <p className="mt-1 text-[13px] font-medium text-danger">{fe.rating}</p> : null}
      </fieldset>
      <Field id={`rc-${orderId}`} label="Comment" optional hint="Shown on the farmer’s public profile without your name." error={fe?.comment}>
        {(p) => <Textarea {...p} name="comment" rows={3} maxLength={500} />}
      </Field>
      <SubmitButton className="self-start" pending={pending} pendingLabel="Saving…">
        Submit rating
      </SubmitButton>
    </form>
  );
}
