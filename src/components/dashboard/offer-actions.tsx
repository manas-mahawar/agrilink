'use client';

import { Check, Repeat2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input, Textarea } from '@/components/ui/form-controls';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/overlays';
import { Notice } from '@/components/ui/primitives';
import { SubmitButton } from '@/components/ui/submit-button';
import { useFormAction } from '@/components/ui/use-form-action';
import { formatINR, paiseToRupeeInput, parseRupeesToPaise, totalPaise } from '@/domain/money';
import { allowedOfferActions, MAX_COUNTERS, type OfferStatus, type Party } from '@/domain/offers';
import { formatQuantity, UNIT_LABEL, type Unit } from '@/domain/units';
import { counterOfferAction, decideOfferAction } from '@/server/actions/offers';

interface OfferLike {
  id: string;
  version: number;
  status: OfferStatus;
  expiresAt: string;
  counterCount: number;
  unit: Unit;
  quantity: number;
  pricePerUnitPaise: number;
  orderId: string | null;
}

export function OfferActions({ offer, party }: { offer: OfferLike; party: Party }) {
  const actions = allowedOfferActions(offer, party);
  if (offer.orderId) {
    return (
      <Button asChild>
        <Link href={`/dashboard/orders/${offer.orderId}`}>Open the order</Link>
      </Button>
    );
  }
  if (!actions.length) return null;
  const unit = UNIT_LABEL[offer.unit];
  const terms = `${formatQuantity(offer.quantity, offer.unit)} at ${formatINR(offer.pricePerUnitPaise)}/${unit.singular} = ${formatINR(totalPaise(offer.quantity, offer.pricePerUnitPaise))}`;

  return (
    <div className="flex flex-wrap gap-2.5">
      {actions.includes('accept') ? (
        <DecisionDialog
          offer={offer}
          decision="accept"
          trigger={
            <Button>
              <Check /> Accept
            </Button>
          }
          title="Accept these terms?"
          description={`${terms}. An order is created and the quantity is reserved on the listing.${party === 'farmer' ? ' You then confirm a pickup or delivery date.' : ''}`}
          confirmLabel="Accept and create order"
        />
      ) : null}
      {actions.includes('counter') ? <CounterDialog offer={offer} /> : null}
      {actions.includes('reject') ? (
        <DecisionDialog
          offer={offer}
          decision="reject"
          withReason
          trigger={
            <Button variant="ghost">
              <X /> Decline
            </Button>
          }
          title="Decline this offer?"
          description="The other side is told the offer was declined. They can make a new offer later."
          confirmLabel="Decline offer"
          danger
        />
      ) : null}
      {actions.includes('withdraw') ? (
        <DecisionDialog
          offer={offer}
          decision="withdraw"
          trigger={<Button variant="ghost">Withdraw offer</Button>}
          title="Withdraw your offer?"
          description="The farmer is told you withdrew. You can make a new offer on the listing afterwards."
          confirmLabel="Withdraw offer"
          danger
        />
      ) : null}
    </div>
  );
}

function DecisionDialog({
  offer,
  decision,
  trigger,
  title,
  description,
  confirmLabel,
  danger,
  withReason,
}: {
  offer: OfferLike;
  decision: 'accept' | 'reject' | 'withdraw';
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  withReason?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const action = React.useMemo(() => decideOfferAction.bind(null, decision), [decision]);
  const router = useRouter();
  const { pending, formProps, formError, fieldErrors: fe } = useFormAction(action, {
    onResult: (r) => {
      if (!r.ok) return;
      setOpen(false);
      toast.success(r.message ?? 'Done');
      if (r.data?.orderId) router.push(`/dashboard/orders/${r.data.orderId}`);
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description}>
        <form {...formProps} className="flex flex-col gap-4">
          <input type="hidden" name="offerId" value={offer.id} />
          <input type="hidden" name="version" value={offer.version} />
          <FormError message={formError} />
          {withReason ? (
            <Field id={`reason-${offer.id}`} label="Reason" optional error={fe?.reason}>
              {(p) => <Textarea {...p} name="reason" rows={2} maxLength={300} placeholder="For example: price too low for Grade A" />}
            </Field>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton variant={danger ? 'danger' : 'primary'} pending={pending} pendingLabel="Working…">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CounterDialog({ offer }: { offer: OfferLike }) {
  const [open, setOpen] = React.useState(false);
  const { pending, formProps, formError, fieldErrors: fe } = useFormAction(counterOfferAction, {
    onResult: (r) => {
      if (!r.ok) return;
      setOpen(false);
      toast.success(r.message ?? 'Counter-offer sent.');
    },
  });
  const [qty, setQty] = React.useState(String(offer.quantity));
  const [price, setPrice] = React.useState(paiseToRupeeInput(offer.pricePerUnitPaise));
  const unit = UNIT_LABEL[offer.unit];
  const p = parseRupeesToPaise(price);
  const q = Number(qty);
  const left = MAX_COUNTERS - offer.counterCount;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Repeat2 /> Counter
        </Button>
      </DialogTrigger>
      <DialogContent title="Make a counter-offer" description={`Change the price, the quantity, or both. ${left} counter-offer${left === 1 ? '' : 's'} left on this thread.`}>
        <form {...formProps} className="flex flex-col gap-4">
          <input type="hidden" name="offerId" value={offer.id} />
          <input type="hidden" name="version" value={offer.version} />
          <FormError message={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`cq-${offer.id}`} label={`Quantity (${unit.plural})`} error={fe?.quantity}>
              {(a) => <Input {...a} name="quantity" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />}
            </Field>
            <Field id={`cp-${offer.id}`} label={`Price (₹ per ${unit.singular})`} error={fe?.price}>
              {(a) => <Input {...a} name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />}
            </Field>
          </div>
          <Field id={`cm-${offer.id}`} label="Message" optional error={fe?.message}>
            {(a) => <Textarea {...a} name="message" rows={2} maxLength={500} />}
          </Field>
          {p && q > 0 ? (
            <Notice tone="info">
              New total: <strong className="tabular">{formatINR(totalPaise(q, p))}</strong>
            </Notice>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending} pendingLabel="Sending…">
              Send counter-offer
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
