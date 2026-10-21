'use client';

import { CheckCircle2, Info, LogIn } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/form-controls';
import { Badge, Notice, Skeleton } from '@/components/ui/primitives';
import { SubmitButton } from '@/components/ui/submit-button';
import { useFormAction } from '@/components/ui/use-form-action';
import { formatINR, paiseToRupeeInput, parseRupeesToPaise, percentDifference, totalPaise } from '@/domain/money';
import { OFFER_STATUS_LABEL, OPEN_OFFER_STATUSES, type OfferStatus } from '@/domain/offers';
import { FULFILMENT_LABEL, FULFILMENT_METHODS } from '@/domain/orders';
import { formatQuantity, UNIT_LABEL, type Unit } from '@/domain/units';
import { getBrowserClient } from '@/lib/supabase/browser';
import { formatDate } from '@/lib/utils';
import { createOfferAction } from '@/server/actions/offers';
import { isSupabaseConfigured } from '@/lib/env';

interface ListingForOffer {
  id: string;
  farmerId: string;
  unit: Unit;
  pricePerUnitPaise: number;
  quantityAvailable: number;
  minOrderQty: number;
  maxOrderQty: number | null;
  status: string;
  isDemo: boolean;
}

type Viewer =
  | { kind: 'loading' }
  | { kind: 'unconfigured' }
  | { kind: 'anonymous' }
  | { kind: 'owner' }
  | { kind: 'farmer' }
  | { kind: 'suspended' }
  | { kind: 'buyer'; openOffer: { status: OfferStatus; quantity: number; price: number; expiresAt: string } | null };

function useViewer(listing: ListingForOffer): [Viewer, () => void] {
  const [viewer, setViewer] = React.useState<Viewer>(isSupabaseConfigured ? { kind: 'loading' } : { kind: 'unconfigured' });
  const [nonce, setNonce] = React.useState(0);
  React.useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getClaims();
      const sub = data?.claims?.sub;
      if (!sub) return !cancelled && setViewer({ kind: 'anonymous' });
      if (sub === listing.farmerId) return !cancelled && setViewer({ kind: 'owner' });
      const { data: profile } = await supabase.from('profiles').select('account_type, suspended_at').eq('id', sub).maybeSingle();
      if (cancelled) return;
      if (profile?.suspended_at) return setViewer({ kind: 'suspended' });
      if (profile?.account_type !== 'buyer') return setViewer({ kind: 'farmer' });
      const { data: offer } = await supabase
        .from('offers')
        .select('status, quantity, price_per_unit_paise, expires_at')
        .eq('listing_id', listing.id)
        .eq('buyer_id', sub)
        .in('status', OPEN_OFFER_STATUSES as OfferStatus[])
        .maybeSingle();
      if (cancelled) return;
      setViewer({
        kind: 'buyer',
        openOffer: offer
          ? { status: offer.status, quantity: Number(offer.quantity), price: Number(offer.price_per_unit_paise), expiresAt: offer.expires_at }
          : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [listing.id, listing.farmerId, nonce]);
  return [viewer, () => setNonce((n) => n + 1)];
}

export function OfferPanel({ listing }: { listing: ListingForOffer }) {
  const [viewer, reload] = useViewer(listing);
  const pathname = usePathname();
  const unit = UNIT_LABEL[listing.unit];
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;

  if (listing.status !== 'active') {
    return <Notice tone="info">This listing is not taking offers right now{listing.status === 'sold_out' ? ' — it has sold out' : ''}.</Notice>;
  }

  switch (viewer.kind) {
    case 'loading':
      return (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading offer options">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-12" />
        </div>
      );
    case 'unconfigured':
      return (
        <Notice tone="info">
          This is a read-only preview. Accounts and offers switch on once the site is connected to its database.
        </Notice>
      );
    case 'anonymous':
      return (
        <div className="flex flex-col gap-3">
          <p className="text-[15px] text-ink-soft">Log in with a buyer account to make an offer on this listing.</p>
          <Button asChild size="lg">
            <Link href={loginHref}>
              <LogIn /> Log in to make an offer
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/register?role=buyer&next=${encodeURIComponent(pathname)}`}>Create a buyer account</Link>
          </Button>
        </div>
      );
    case 'owner':
      return (
        <div className="flex flex-col gap-3">
          <Notice tone="info">This is your listing. Offers from buyers appear in your dashboard.</Notice>
          <Button asChild variant="secondary">
            <Link href={`/dashboard/listings/${listing.id}`}>Manage listing</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard/offers">View offers</Link>
          </Button>
        </div>
      );
    case 'farmer':
      return <Notice tone="info">Offers are made from buyer accounts. You are signed in as a farmer.</Notice>;
    case 'suspended':
      return <Notice tone="danger">Your account is suspended, so you can’t make offers. Contact AgriLink support.</Notice>;
    case 'buyer':
      if (viewer.openOffer) {
        const o = viewer.openOffer;
        return (
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-paper p-4">
            <div className="flex items-center justify-between gap-2">
              <strong>Your offer</strong>
              <Badge tone={o.status === 'countered' ? 'wait' : 'info'}>{o.status === 'countered' ? 'Farmer countered — your turn' : OFFER_STATUS_LABEL[o.status]}</Badge>
            </div>
            <p className="tabular text-sm text-ink-soft">
              {formatQuantity(o.quantity, listing.unit)} at {formatINR(o.price)} / {unit.singular} · open until {formatDate(o.expiresAt)}
            </p>
            <Button asChild>
              <Link href="/dashboard/offers">Open offer thread</Link>
            </Button>
          </div>
        );
      }
      return <OfferForm listing={listing} onSent={reload} />;
  }
}

function OfferForm({ listing, onSent }: { listing: ListingForOffer; onSent: () => void }) {
  const { state, pending, formProps, fieldErrors: fe, formError } = useFormAction(createOfferAction, {
    onResult: (r) => {
      if (!r.ok) return;
      toast.success(r.message ?? 'Offer sent.');
      onSent();
    },
  });
  const unit = UNIT_LABEL[listing.unit];
  const maxQty = Math.min(listing.quantityAvailable, listing.maxOrderQty ?? Infinity);
  const [qty, setQty] = React.useState(String(Math.min(Math.max(listing.minOrderQty, 1), maxQty)));
  const [price, setPrice] = React.useState(paiseToRupeeInput(listing.pricePerUnitPaise));


  if (state?.ok) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-ok-fg/30 bg-ok-bg p-4 text-ok-fg" role="status">
        <CheckCircle2 className="size-6" aria-hidden="true" />
        <strong>{state.message}</strong>
        <Button asChild variant="secondary">
          <Link href="/dashboard/offers">Track your offer</Link>
        </Button>
      </div>
    );
  }

  const qtyNum = Number(qty);
  const pricePaise = parseRupeesToPaise(price);
  const total = Number.isFinite(qtyNum) && qtyNum > 0 && pricePaise ? totalPaise(qtyNum, pricePaise) : null;
  const diff = pricePaise ? percentDifference(pricePaise, listing.pricePerUnitPaise) : null;
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <input type="hidden" name="listingId" value={listing.id} />
      <FormError message={formError} />
      <Field
        id="offer-qty"
        label={`Quantity (${unit.plural})`}
        hint={`Between ${formatQuantity(listing.minOrderQty, listing.unit)} and ${formatQuantity(maxQty, listing.unit)}`}
        error={fe?.quantity}
      >
        {(p) => <Input {...p} name="quantity" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} required />}
      </Field>
      <Field id="offer-price" label={`Your price (₹ per ${unit.singular})`} error={fe?.price}>
        {(p) => <Input {...p} name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />}
      </Field>
      {diff !== null && Number.isFinite(diff) && diff !== 0 ? (
        <p className="tabular -mt-2 text-[13px] text-muted">
          {Math.abs(diff).toFixed(1)}% {diff < 0 ? 'below' : 'above'} the asking price of {formatINR(listing.pricePerUnitPaise)}
        </p>
      ) : null}
      <Field id="offer-fulfilment" label="Pickup or delivery" error={fe?.fulfilmentMethod}>
        {(p) => (
          <Select {...p} name="fulfilmentMethod" defaultValue="buyer_pickup">
            {FULFILMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {FULFILMENT_LABEL[m]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field id="offer-message" label="Message to the farmer" optional error={fe?.message}>
        {(p) => <Textarea {...p} name="message" rows={3} maxLength={500} placeholder="Grading, packing, preferred dates…" />}
      </Field>
      <div className="tabular flex items-center justify-between rounded-md bg-paper px-4 py-3 text-sm">
        <span className="text-muted">Offer total</span>
        <strong className="text-lg">{total !== null ? formatINR(total) : '—'}</strong>
      </div>
      <SubmitButton size="lg" pending={pending} pendingLabel="Sending offer…">
        Send offer
      </SubmitButton>
      <p className="flex gap-2 text-[13px] text-muted">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        No payment is taken on AgriLink yet. If the farmer accepts, an order is created and you agree payment directly.
        {listing.isDemo ? ' This is a demo listing — offers stay in the demo environment.' : ''}
      </p>
    </form>
  );
}
