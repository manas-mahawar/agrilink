-- Payment-ready model. NO payment provider is active in this milestone.
--
-- Design (see docs/PAYMENTS_PLAN.md):
--   * A payment row is created on the server for an authorised, confirmed order (provider order id).
--   * The browser only starts checkout; its callback is never proof of payment.
--   * Provider webhooks are verified (HMAC signature) on the server, stored once in payment_events
--     (unique provider event id => idempotent), then applied by apply_payment_event().
--   * orders.payment_status changes only inside apply_payment_event(), which only the service role may run.
--   * Accepting an offer is an agreement on terms; it is not a payment.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null check (provider in ('razorpay')),
  provider_order_id text unique,
  provider_payment_id text unique,
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  status text not null default 'created'
    check (status in ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded')),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  captured_at timestamptz
);
create index payments_order_idx on public.payments (order_id);
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('razorpay')),
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  signature_verified boolean not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_result text,
  unique (provider, provider_event_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  provider_refund_id text unique,
  amount_paise bigint not null check (amount_paise > 0),
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger refunds_set_updated_at before update on public.refunds
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.refunds enable row level security;
revoke all on table public.payments, public.payment_events, public.refunds from anon, authenticated;

-- Order participants can see payment status for their own orders; nothing else is exposed.
grant select on table public.payments to authenticated;
create policy "payments: order participants and admins read" on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
-- payment_events and refunds: no API access at all (service role only).

-- Apply a webhook event that the server has ALREADY verified. Idempotent per provider event id.
create or replace function public.apply_payment_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_signature_verified boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id bigint;
  v_payment public.payments;
  v_provider_payment_id text := p_payload #>> '{payload,payment,entity,id}';
  v_provider_order_id text := p_payload #>> '{payload,payment,entity,order_id}';
  v_amount bigint := nullif(p_payload #>> '{payload,payment,entity,amount}', '')::bigint;
  v_result text;
begin
  insert into public.payment_events (provider, provider_event_id, event_type, payload, signature_verified)
  values (p_provider, p_provider_event_id, p_event_type, p_payload, coalesce(p_signature_verified, false))
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;
  if v_event_id is null then
    return 'duplicate';
  end if;
  if not coalesce(p_signature_verified, false) then
    update public.payment_events set processed_at = now(), processing_result = 'rejected: signature not verified' where id = v_event_id;
    return 'rejected';
  end if;

  select * into v_payment from public.payments where provider = p_provider and provider_order_id = v_provider_order_id for update;
  if not found then
    v_result := 'ignored: unknown provider order';
  elsif p_event_type = 'payment.captured' then
    if v_amount is distinct from v_payment.amount_paise then
      v_result := 'flagged: amount mismatch';
    else
      update public.payments set status = 'captured', provider_payment_id = v_provider_payment_id, captured_at = now()
       where id = v_payment.id;
      update public.orders set payment_status = 'paid' where id = v_payment.order_id;
      v_result := 'applied: captured';
    end if;
  elsif p_event_type = 'payment.failed' then
    update public.payments set status = 'failed', provider_payment_id = v_provider_payment_id,
           failure_reason = left(p_payload #>> '{payload,payment,entity,error_description}', 300)
     where id = v_payment.id and status <> 'captured';
    update public.orders set payment_status = 'failed' where id = v_payment.order_id and payment_status <> 'paid';
    v_result := 'applied: failed';
  else
    v_result := 'ignored: unhandled event type';
  end if;

  update public.payment_events set processed_at = now(), processing_result = v_result where id = v_event_id;
  return v_result;
end;
$$;

revoke execute on function public.apply_payment_event(text, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, text, jsonb, boolean) to service_role;
