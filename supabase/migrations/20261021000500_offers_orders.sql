-- Offers, negotiation history, orders and the state machines that move them.
--
-- OFFER LIFECYCLE (who acts next is derived from the status)
--   pending    -> waiting for the FARMER   (created by a buyer, or the buyer countered back)
--   countered  -> waiting for the BUYER    (the farmer proposed new terms)
--   accepted | rejected | withdrawn | expired  are final.
--
--   action     actor                 from               to
--   create     buyer                 -                  pending
--   counter    party whose turn it is pending/countered  countered (farmer) / pending (buyer)
--   accept     party whose turn it is pending/countered  accepted  (+ order created atomically)
--   reject     party whose turn it is pending/countered  rejected
--   withdraw   buyer                 pending/countered  withdrawn
--   expire     system (scheduled)    pending/countered  expired   (expires_at passed, or listing closed)
--
--   Every change increments `version`; accept/counter/reject/withdraw must send the version the
--   user saw, so a stale screen can never accept terms that changed in the meantime.
--
-- ORDER LIFECYCLE
--   action           actor                  from                                   to
--   (offer accepted)  system                -                                      awaiting_confirmation
--   confirm          farmer                 awaiting_confirmation                  confirmed  (sets fulfilment date)
--   start_preparing  farmer                 confirmed                              preparing
--   mark_ready       farmer                 preparing                              ready      (ready for pickup / dispatch)
--   complete         buyer                  ready                                  completed  (reserved -> sold)
--   cancel           buyer or farmer        awaiting_confirmation/confirmed/preparing  cancelled (reservation released)
--   cancel           admin                  any state except completed / cancelled cancelled
--
-- QUANTITY RESERVATION
--   Accepting an offer locks the listing row, re-checks quantity_available and moves the quantity
--   into quantity_reserved in the same transaction, so concurrent acceptances cannot oversell.
--   Cancelling releases the reservation; completing moves it to quantity_sold.
--   When nothing is left the listing becomes sold_out and remaining open offers expire.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  status public.offer_status not null default 'pending',
  unit public.quantity_unit not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  price_per_unit_paise bigint not null check (price_per_unit_paise > 0 and price_per_unit_paise <= 10000000000),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  fulfilment_method public.fulfilment_method not null default 'buyer_pickup',
  message text check (message is null or char_length(message) <= 500),
  version integer not null default 1,
  counter_count smallint not null default 0,
  last_actor public.actor_role not null default 'buyer',
  expires_at timestamptz not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_parties_differ check (buyer_id <> farmer_id)
);
create unique index offers_one_open_per_buyer_listing on public.offers (listing_id, buyer_id)
  where status in ('pending', 'countered');
create index offers_buyer_idx on public.offers (buyer_id, status, updated_at desc);
create index offers_farmer_idx on public.offers (farmer_id, status, updated_at desc);
create index offers_listing_idx on public.offers (listing_id, status);
create index offers_expiry_idx on public.offers (expires_at) where status in ('pending', 'countered');
create trigger offers_set_updated_at before update on public.offers
  for each row execute function public.set_updated_at();

create table public.offer_events (
  id bigint generated always as identity primary key,
  offer_id uuid not null references public.offers (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_role public.actor_role not null,
  event text not null check (event in ('created', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired')),
  quantity numeric(12, 2),
  price_per_unit_paise bigint,
  message text,
  reason text,
  created_at timestamptz not null default now()
);
create index offer_events_offer_idx on public.offer_events (offer_id, id);

create sequence public.order_reference_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default (
    'AGL-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMM') || '-' || lpad(nextval('public.order_reference_seq')::text, 5, '0')
  ),
  offer_id uuid not null unique references public.offers (id) on delete restrict,
  listing_id uuid not null references public.listings (id) on delete restrict,
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  farmer_id uuid not null references public.profiles (id) on delete restrict,
  status public.order_status not null default 'awaiting_confirmation',
  unit public.quantity_unit not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  price_per_unit_paise bigint not null check (price_per_unit_paise > 0),
  total_paise bigint not null check (total_paise > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  fulfilment_method public.fulfilment_method not null,
  fulfilment_date date,
  farmer_note text check (farmer_note is null or char_length(farmer_note) <= 500),
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  cancelled_by public.actor_role,
  -- Changed only by server-verified payment processing (service role). Never by clients.
  payment_status public.payment_status not null default 'not_started',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);
create index orders_buyer_idx on public.orders (buyer_id, status, created_at desc);
create index orders_farmer_idx on public.orders (farmer_id, status, created_at desc);
create index orders_listing_idx on public.orders (listing_id);
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid references auth.users (id) on delete set null,
  actor_role public.actor_role not null,
  note text,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, id);

create table public.order_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index order_reviews_farmer_idx on public.order_reviews (farmer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: participants and administrators can read; nobody writes directly.
-- ---------------------------------------------------------------------------
alter table public.offers enable row level security;
alter table public.offer_events enable row level security;
alter table public.orders enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_reviews enable row level security;

revoke all on table public.offers, public.offer_events, public.orders, public.order_status_history, public.order_reviews
  from anon, authenticated;
grant select on table public.offers, public.offer_events, public.orders, public.order_status_history, public.order_reviews
  to authenticated;
revoke all on sequence public.order_reference_seq from anon, authenticated;

create policy "offers: participants and admins read" on public.offers for select to authenticated
  using (buyer_id = (select auth.uid()) or farmer_id = (select auth.uid()) or public.is_admin());
create policy "offer_events: visible with the offer" on public.offer_events for select to authenticated
  using (exists (select 1 from public.offers o where o.id = offer_id));
create policy "orders: participants and admins read" on public.orders for select to authenticated
  using (buyer_id = (select auth.uid()) or farmer_id = (select auth.uid()) or public.is_admin());
create policy "order_status_history: visible with the order" on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy "order_reviews: participants and admins read" on public.order_reviews for select to authenticated
  using (reviewer_id = (select auth.uid()) or farmer_id = (select auth.uid()) or public.is_admin());

-- Now that offers exist, give the relationship helpers their real definitions.
create or replace function public.shares_deal_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.offers o
    where (o.buyer_id = auth.uid() and o.farmer_id = p_other)
       or (o.farmer_id = auth.uid() and o.buyer_id = p_other)
  );
$$;

create or replace function public.has_deal_on_listing(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.offers o
    where o.listing_id = p_listing_id and (o.buyer_id = auth.uid() or o.farmer_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function public._offer_turn(p_status public.offer_status)
returns public.actor_role
language sql
immutable
set search_path = ''
as $$
  select case p_status when 'pending' then 'farmer'::public.actor_role
                       when 'countered' then 'buyer'::public.actor_role
                       else null end;
$$;

-- Validate requested terms against the current state of a listing.
create or replace function public._check_offer_terms(
  p_listing public.listings,
  p_quantity numeric,
  p_price_per_unit_paise bigint
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_quantity is null or p_quantity <= 0 or p_quantity <> round(p_quantity, 2) then
    perform public._raise('INVALID_QUANTITY', 'Enter a quantity greater than zero (up to two decimal places).');
  end if;
  if p_quantity < p_listing.min_order_qty then
    perform public._raise('QUANTITY_BELOW_MINIMUM',
      'The minimum order for this listing is ' || public._format_qty(p_listing.min_order_qty, p_listing.unit) || '.');
  end if;
  if p_listing.max_order_qty is not null and p_quantity > p_listing.max_order_qty then
    perform public._raise('QUANTITY_ABOVE_MAXIMUM',
      'The maximum order for this listing is ' || public._format_qty(p_listing.max_order_qty, p_listing.unit) || '.');
  end if;
  if p_quantity > p_listing.quantity_available then
    perform public._raise('INSUFFICIENT_QUANTITY',
      'Only ' || public._format_qty(p_listing.quantity_available, p_listing.unit) || ' left on this listing.');
  end if;
  if p_price_per_unit_paise is null or p_price_per_unit_paise <= 0 or p_price_per_unit_paise > 10000000000 then
    perform public._raise('INVALID_PRICE', 'Enter a price greater than zero.');
  end if;
end;
$$;

-- Lock an offer row and confirm the caller is one of its two parties.
create or replace function public._lock_offer(p_offer_id uuid)
returns public.offers
language plpgsql
set search_path = ''
as $$
declare
  o public.offers;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if not found or auth.uid() is null or (o.buyer_id <> auth.uid() and o.farmer_id <> auth.uid()) then
    perform public._raise('OFFER_NOT_FOUND', 'This offer could not be found.');
  end if;
  return o;
end;
$$;

create or replace function public._offer_actor(p_offer public.offers)
returns public.actor_role
language sql
stable
set search_path = ''
as $$
  select case when p_offer.farmer_id = auth.uid() then 'farmer'::public.actor_role else 'buyer'::public.actor_role end;
$$;

create or replace function public._require_open_turn(p_offer public.offers, p_actor public.actor_role, p_expected_version integer)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_offer.status not in ('pending', 'countered') then
    perform public._raise('OFFER_CLOSED', 'This offer is already ' || p_offer.status || '.');
  end if;
  if p_offer.expires_at <= now() then
    perform public._raise('OFFER_EXPIRED', 'This offer has expired. Make a new offer to continue.');
  end if;
  if p_expected_version is distinct from p_offer.version then
    perform public._raise('OFFER_STALE', 'This offer changed while you were viewing it. Review the latest terms and try again.');
  end if;
  if public._offer_turn(p_offer.status) <> p_actor then
    perform public._raise('NOT_YOUR_TURN', 'You are waiting for the other party to respond.');
  end if;
end;
$$;

-- Expire every open offer on a listing (used when it sells out, is archived or hidden).
create or replace function public._expire_open_offers_for_listing(p_listing_id uuid, p_reason text, p_except uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    update public.offers o
       set status = 'expired', version = o.version + 1, last_actor = 'system'
     where o.listing_id = p_listing_id
       and o.status in ('pending', 'countered')
       and (p_except is null or o.id <> p_except)
    returning o.id, o.buyer_id, o.farmer_id
  loop
    insert into public.offer_events (offer_id, actor_id, actor_role, event, reason)
    values (r.id, null, 'system', 'expired', p_reason);
    perform public._notify(r.buyer_id, 'offer_expired', 'Your offer was closed',
      'The listing is no longer open for offers (' || p_reason || ').', '/dashboard/offers/' || r.id);
  end loop;
end;
$$;

-- When a farmer archives a listing or moderators hide it, close its open offers.
create or replace function public.listings_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'archived' and old.status <> 'archived' then
    perform public._expire_open_offers_for_listing(new.id, 'listing archived');
  elsif new.hidden_by_admin and not old.hidden_by_admin then
    perform public._expire_open_offers_for_listing(new.id, 'listing removed by moderators');
  end if;
  return null;
end;
$$;
create trigger listings_after_update after update on public.listings
  for each row execute function public.listings_after_update();

-- ---------------------------------------------------------------------------
-- Offer API
-- ---------------------------------------------------------------------------
create or replace function public.create_offer(
  p_listing_id uuid,
  p_quantity numeric,
  p_price_per_unit_paise bigint,
  p_fulfilment_method public.fulfilment_method default 'buyer_pickup',
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_buyer public.profiles;
  v_listing public.listings;
  v_offer_id uuid;
  v_message text := nullif(left(btrim(coalesce(p_message, '')), 500), '');
begin
  if v_uid is null then
    perform public._raise('AUTH_REQUIRED', 'Please log in to make an offer.');
  end if;
  select * into v_buyer from public.profiles where id = v_uid;
  if not found or v_buyer.account_type <> 'buyer' then
    perform public._raise('BUYERS_ONLY', 'Only buyer accounts can make offers.');
  end if;
  if v_buyer.suspended_at is not null then
    perform public._raise('ACCOUNT_SUSPENDED', 'Your account is suspended. Contact AgriLink support.');
  end if;

  select * into v_listing from public.listings where id = p_listing_id for share;
  if not found
     or v_listing.status <> 'active'
     or v_listing.hidden_by_admin
     or not public.is_public_seller(v_listing.farmer_id)
     or (v_listing.is_demo and not public.demo_data_visible()) then
    perform public._raise('LISTING_UNAVAILABLE', 'This listing is not open for offers right now.');
  end if;

  perform public._check_offer_terms(v_listing, p_quantity, p_price_per_unit_paise);

  if (select count(*) from public.offers o where o.buyer_id = v_uid and o.created_at > now() - interval '1 hour') >= 20 then
    perform public._raise('RATE_LIMITED', 'You have made many offers in the last hour. Please wait a little and try again.');
  end if;

  -- An earlier offer that silently ran out of time should not block a fresh one.
  update public.offers o set status = 'expired', version = o.version + 1, last_actor = 'system'
   where o.listing_id = p_listing_id and o.buyer_id = v_uid
     and o.status in ('pending', 'countered') and o.expires_at <= now();

  if exists (select 1 from public.offers o where o.listing_id = p_listing_id and o.buyer_id = v_uid and o.status in ('pending', 'countered')) then
    perform public._raise('OFFER_ALREADY_OPEN', 'You already have an open offer on this listing. Continue that negotiation instead.');
  end if;

  insert into public.offers (listing_id, buyer_id, farmer_id, status, unit, quantity, price_per_unit_paise,
                             fulfilment_method, message, expires_at, is_demo, last_actor)
  values (p_listing_id, v_uid, v_listing.farmer_id, 'pending', v_listing.unit, p_quantity, p_price_per_unit_paise,
          coalesce(p_fulfilment_method, 'buyer_pickup'), v_message, now() + interval '7 days',
          v_listing.is_demo or v_buyer.is_demo, 'buyer')
  returning id into v_offer_id;

  insert into public.offer_events (offer_id, actor_id, actor_role, event, quantity, price_per_unit_paise, message)
  values (v_offer_id, v_uid, 'buyer', 'created', p_quantity, p_price_per_unit_paise, v_message);

  perform public._notify(v_listing.farmer_id, 'offer_received',
    'New offer on ' || v_listing.produce_name,
    coalesce(v_buyer.organisation_name, v_buyer.display_name) || ' offered ' || public._format_inr(p_price_per_unit_paise)
      || ' per ' || v_listing.unit || ' for ' || public._format_qty(p_quantity, v_listing.unit) || '.',
    '/dashboard/offers/' || v_offer_id,
    jsonb_build_object('offer_id', v_offer_id, 'listing_id', p_listing_id));
  return v_offer_id;
end;
$$;

create or replace function public.counter_offer(
  p_offer_id uuid,
  p_expected_version integer,
  p_quantity numeric,
  p_price_per_unit_paise bigint,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_actor public.actor_role;
  v_listing public.listings;
  v_message text := nullif(left(btrim(coalesce(p_message, '')), 500), '');
  v_other uuid;
  v_name text;
begin
  v_offer := public._lock_offer(p_offer_id);
  v_actor := public._offer_actor(v_offer);
  perform public._require_open_turn(v_offer, v_actor, p_expected_version);
  if v_offer.counter_count >= 10 then
    perform public._raise('TOO_MANY_COUNTERS', 'This negotiation has reached 10 rounds. Accept, decline or start again later.');
  end if;

  select * into v_listing from public.listings where id = v_offer.listing_id for share;
  if v_listing.status <> 'active' or v_listing.hidden_by_admin then
    perform public._raise('LISTING_UNAVAILABLE', 'This listing is not open for offers right now.');
  end if;
  perform public._check_offer_terms(v_listing, p_quantity, p_price_per_unit_paise);
  if p_quantity = v_offer.quantity and p_price_per_unit_paise = v_offer.price_per_unit_paise then
    perform public._raise('NO_CHANGE', 'Change the price or the quantity to send a counteroffer.');
  end if;

  update public.offers
     set quantity = p_quantity,
         price_per_unit_paise = p_price_per_unit_paise,
         message = coalesce(v_message, message),
         status = case v_actor when 'farmer' then 'countered'::public.offer_status else 'pending'::public.offer_status end,
         version = version + 1,
         counter_count = counter_count + 1,
         last_actor = v_actor,
         expires_at = now() + interval '7 days'
   where id = p_offer_id;

  insert into public.offer_events (offer_id, actor_id, actor_role, event, quantity, price_per_unit_paise, message)
  values (p_offer_id, auth.uid(), v_actor, 'countered', p_quantity, p_price_per_unit_paise, v_message);

  v_other := case v_actor when 'farmer' then v_offer.buyer_id else v_offer.farmer_id end;
  select coalesce(p.organisation_name, p.display_name) into v_name from public.profiles p where p.id = auth.uid();
  perform public._notify(v_other, 'offer_countered',
    'Counteroffer on ' || v_listing.produce_name,
    v_name || ' proposed ' || public._format_inr(p_price_per_unit_paise) || ' per ' || v_listing.unit
      || ' for ' || public._format_qty(p_quantity, v_listing.unit) || '.',
    '/dashboard/offers/' || p_offer_id,
    jsonb_build_object('offer_id', p_offer_id));
end;
$$;

create or replace function public.accept_offer(p_offer_id uuid, p_expected_version integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_actor public.actor_role;
  v_listing public.listings;
  v_order_id uuid;
  v_reference text;
  v_remaining numeric;
  v_other uuid;
begin
  v_offer := public._lock_offer(p_offer_id);
  v_actor := public._offer_actor(v_offer);
  perform public._require_open_turn(v_offer, v_actor, p_expected_version);
  if not public.is_active_account() then
    perform public._raise('ACCOUNT_SUSPENDED', 'Your account is suspended. Contact AgriLink support.');
  end if;

  -- Lock the listing so concurrent acceptances are serialised.
  select * into v_listing from public.listings where id = v_offer.listing_id for update;
  if v_listing.status <> 'active' or v_listing.hidden_by_admin then
    perform public._raise('LISTING_UNAVAILABLE', 'This listing is not open for new orders right now.');
  end if;
  if v_offer.quantity > v_listing.quantity_available then
    perform public._raise('INSUFFICIENT_QUANTITY',
      'Only ' || public._format_qty(v_listing.quantity_available, v_listing.unit) || ' left on this listing. Send a counter-offer with a smaller quantity.');
  end if;

  v_remaining := v_listing.quantity_available - v_offer.quantity;
  update public.listings
     set quantity_reserved = quantity_reserved + v_offer.quantity,
         status = case when v_remaining <= 0 then 'sold_out'::public.listing_status else status end
   where id = v_listing.id;

  update public.offers set status = 'accepted', version = version + 1, last_actor = v_actor where id = p_offer_id;
  insert into public.offer_events (offer_id, actor_id, actor_role, event, quantity, price_per_unit_paise)
  values (p_offer_id, auth.uid(), v_actor, 'accepted', v_offer.quantity, v_offer.price_per_unit_paise);

  insert into public.orders (offer_id, listing_id, buyer_id, farmer_id, unit, quantity, price_per_unit_paise,
                             total_paise, fulfilment_method, is_demo)
  values (p_offer_id, v_offer.listing_id, v_offer.buyer_id, v_offer.farmer_id, v_offer.unit, v_offer.quantity,
          v_offer.price_per_unit_paise, round(v_offer.quantity * v_offer.price_per_unit_paise)::bigint,
          v_offer.fulfilment_method, v_offer.is_demo)
  returning id, reference into v_order_id, v_reference;

  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (v_order_id, null, 'awaiting_confirmation', auth.uid(), v_actor, 'Offer accepted');

  v_other := case v_actor when 'farmer' then v_offer.buyer_id else v_offer.farmer_id end;
  perform public._notify(v_other, 'offer_accepted',
    'Offer accepted — order ' || v_reference,
    public._format_qty(v_offer.quantity, v_offer.unit) || ' of ' || v_listing.produce_name || ' at '
      || public._format_inr(v_offer.price_per_unit_paise) || ' per ' || v_offer.unit || '.',
    '/dashboard/orders/' || v_order_id,
    jsonb_build_object('order_id', v_order_id, 'offer_id', p_offer_id));
  perform public._notify(v_offer.farmer_id, 'order_created',
    'Confirm order ' || v_reference,
    'Set the pickup or delivery date so the buyer can plan.',
    '/dashboard/orders/' || v_order_id,
    jsonb_build_object('order_id', v_order_id));

  if v_remaining <= 0 then
    perform public._expire_open_offers_for_listing(v_listing.id, 'listing sold out', p_offer_id);
  end if;
  return v_order_id;
end;
$$;

create or replace function public.reject_offer(p_offer_id uuid, p_expected_version integer, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_actor public.actor_role;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 300), '');
  v_produce text;
begin
  v_offer := public._lock_offer(p_offer_id);
  v_actor := public._offer_actor(v_offer);
  perform public._require_open_turn(v_offer, v_actor, p_expected_version);
  update public.offers set status = 'rejected', version = version + 1, last_actor = v_actor where id = p_offer_id;
  insert into public.offer_events (offer_id, actor_id, actor_role, event, reason)
  values (p_offer_id, auth.uid(), v_actor, 'rejected', v_reason);
  select produce_name into v_produce from public.listings where id = v_offer.listing_id;
  perform public._notify(case v_actor when 'farmer' then v_offer.buyer_id else v_offer.farmer_id end,
    'offer_rejected', 'Offer declined on ' || v_produce,
    coalesce('Reason: ' || v_reason, 'The other party declined these terms.'),
    '/dashboard/offers/' || p_offer_id, jsonb_build_object('offer_id', p_offer_id));
end;
$$;

create or replace function public.withdraw_offer(p_offer_id uuid, p_expected_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_actor public.actor_role;
  v_produce text;
begin
  v_offer := public._lock_offer(p_offer_id);
  v_actor := public._offer_actor(v_offer);
  if v_actor <> 'buyer' then
    perform public._raise('BUYERS_ONLY', 'Only the buyer can withdraw an offer. Decline it instead.');
  end if;
  if v_offer.status not in ('pending', 'countered') then
    perform public._raise('OFFER_CLOSED', 'This offer is already ' || v_offer.status || '.');
  end if;
  if p_expected_version is distinct from v_offer.version then
    perform public._raise('OFFER_STALE', 'This offer changed while you were viewing it. Review the latest terms and try again.');
  end if;
  update public.offers set status = 'withdrawn', version = version + 1, last_actor = 'buyer' where id = p_offer_id;
  insert into public.offer_events (offer_id, actor_id, actor_role, event) values (p_offer_id, auth.uid(), 'buyer', 'withdrawn');
  select produce_name into v_produce from public.listings where id = v_offer.listing_id;
  perform public._notify(v_offer.farmer_id, 'offer_withdrawn', 'Offer withdrawn on ' || v_produce,
    'The buyer withdrew their offer.', '/dashboard/offers/' || p_offer_id, jsonb_build_object('offer_id', p_offer_id));
end;
$$;

-- Scheduled job: close offers whose expiry has passed. Run every 15 minutes with pg_cron
-- (see docs/SUPABASE_SETUP.md). Only the service role may call it.
create or replace function public.expire_stale_offers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    update public.offers o
       set status = 'expired', version = o.version + 1, last_actor = 'system'
     where o.status in ('pending', 'countered') and o.expires_at <= now()
    returning o.id, o.buyer_id, o.farmer_id
  loop
    n := n + 1;
    insert into public.offer_events (offer_id, actor_role, event, reason) values (r.id, 'system', 'expired', 'no response within 7 days');
    perform public._notify(r.buyer_id, 'offer_expired', 'An offer expired', 'No response within 7 days.', '/dashboard/offers/' || r.id);
    perform public._notify(r.farmer_id, 'offer_expired', 'An offer expired', 'No response within 7 days.', '/dashboard/offers/' || r.id);
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Order API
-- ---------------------------------------------------------------------------
create or replace function public.transition_order(
  p_order_id uuid,
  p_action text,
  p_note text default null,
  p_fulfilment_date date default null
)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_actor public.actor_role;
  v_to public.order_status;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_listing public.listings;
  v_title text;
  v_body text;
begin
  if v_uid is null then
    perform public._raise('AUTH_REQUIRED', 'Please log in.');
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    perform public._raise('ORDER_NOT_FOUND', 'This order could not be found.');
  end if;

  if v_order.farmer_id = v_uid then
    v_actor := 'farmer';
  elsif v_order.buyer_id = v_uid then
    v_actor := 'buyer';
  elsif public.is_admin() then
    v_actor := 'admin';
  else
    perform public._raise('ORDER_NOT_FOUND', 'This order could not be found.');
  end if;
  if v_actor <> 'admin' and not public.is_active_account() then
    perform public._raise('ACCOUNT_SUSPENDED', 'Your account is suspended. Contact AgriLink support.');
  end if;

  v_to := case
    when p_action = 'confirm' and v_actor = 'farmer' and v_order.status = 'awaiting_confirmation' then 'confirmed'
    when p_action = 'start_preparing' and v_actor = 'farmer' and v_order.status = 'confirmed' then 'preparing'
    when p_action = 'mark_ready' and v_actor = 'farmer' and v_order.status = 'preparing' then 'ready'
    when p_action = 'complete' and v_actor = 'buyer' and v_order.status = 'ready' then 'completed'
    when p_action = 'cancel' and v_actor in ('buyer', 'farmer') and v_order.status in ('awaiting_confirmation', 'confirmed', 'preparing') then 'cancelled'
    when p_action = 'cancel' and v_actor = 'admin' and v_order.status not in ('completed', 'cancelled') then 'cancelled'
    else null
  end::public.order_status;

  if v_to is null then
    perform public._raise('INVALID_TRANSITION', 'That action is not available for this order right now.');
  end if;

  if p_action = 'confirm' then
    if p_fulfilment_date is null or p_fulfilment_date < v_today or p_fulfilment_date > v_today + 180 then
      perform public._raise('INVALID_FULFILMENT_DATE', 'Choose a pickup or delivery date between today and the next 6 months.');
    end if;
  end if;
  if p_action = 'cancel' and (v_note is null or char_length(v_note) < 3) then
    perform public._raise('REASON_REQUIRED', 'Please give a short reason for cancelling.');
  end if;

  select * into v_listing from public.listings where id = v_order.listing_id for update;

  if v_to = 'completed' then
    update public.listings
       set quantity_reserved = greatest(quantity_reserved - v_order.quantity, 0),
           quantity_sold = quantity_sold + v_order.quantity
     where id = v_listing.id;
  elsif v_to = 'cancelled' then
    update public.listings
       set quantity_reserved = greatest(quantity_reserved - v_order.quantity, 0),
           status = case
             when status = 'sold_out' and not hidden_by_admin
                  and (quantity_total - greatest(quantity_reserved - v_order.quantity, 0) - quantity_sold) > 0
               then 'active'::public.listing_status
             else status end
     where id = v_listing.id;
  end if;

  update public.orders
     set status = v_to,
         fulfilment_date = case when p_action = 'confirm' then p_fulfilment_date else fulfilment_date end,
         farmer_note = case when v_actor = 'farmer' and v_note is not null and p_action <> 'cancel' then v_note else farmer_note end,
         confirmed_at = case when v_to = 'confirmed' then now() else confirmed_at end,
         ready_at = case when v_to = 'ready' then now() else ready_at end,
         completed_at = case when v_to = 'completed' then now() else completed_at end,
         cancelled_at = case when v_to = 'cancelled' then now() else cancelled_at end,
         cancel_reason = case when v_to = 'cancelled' then v_note else cancel_reason end,
         cancelled_by = case when v_to = 'cancelled' then v_actor else cancelled_by end
   where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order_id, v_order.status, v_to, v_uid, v_actor, v_note);

  v_title := 'Order ' || v_order.reference || ': ' || case v_to
    when 'confirmed' then 'confirmed'
    when 'preparing' then 'being prepared'
    when 'ready' then 'ready for pickup or dispatch'
    when 'completed' then 'completed'
    when 'cancelled' then 'cancelled'
    else v_to::text end;
  v_body := case v_to
    when 'confirmed' then 'Planned for ' || to_char(p_fulfilment_date, 'DD Mon YYYY') || '.'
    when 'cancelled' then 'Reason: ' || v_note
    when 'completed' then 'The buyer confirmed receipt.'
    else v_listing.produce_name || ' · ' || public._format_qty(v_order.quantity, v_order.unit)
  end;

  if v_actor <> 'buyer' then
    perform public._notify(v_order.buyer_id, 'order_status_changed', v_title, v_body, '/dashboard/orders/' || p_order_id,
      jsonb_build_object('order_id', p_order_id, 'status', v_to));
  end if;
  if v_actor <> 'farmer' then
    perform public._notify(v_order.farmer_id, 'order_status_changed', v_title, v_body, '/dashboard/orders/' || p_order_id,
      jsonb_build_object('order_id', p_order_id, 'status', v_to));
  end if;
  if v_actor = 'admin' then
    perform public._audit(v_uid, 'admin', 'order.cancel', 'order', p_order_id::text, jsonb_build_object('reason', v_note));
  end if;
  return v_to;
end;
$$;

create or replace function public.review_order(p_order_id uuid, p_rating smallint, p_comment text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.buyer_id is distinct from auth.uid() then
    perform public._raise('ORDER_NOT_FOUND', 'This order could not be found.');
  end if;
  if v_order.status <> 'completed' then
    perform public._raise('ORDER_NOT_COMPLETED', 'You can rate an order once it is completed.');
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    perform public._raise('INVALID_RATING', 'Choose a rating from 1 to 5.');
  end if;
  if exists (select 1 from public.order_reviews r where r.order_id = p_order_id) then
    perform public._raise('ALREADY_REVIEWED', 'You have already rated this order.');
  end if;
  insert into public.order_reviews (order_id, reviewer_id, farmer_id, rating, comment)
  values (p_order_id, v_order.buyer_id, v_order.farmer_id, p_rating, nullif(left(btrim(coalesce(p_comment, '')), 500), ''))
  returning id into v_id;
  perform public._notify(v_order.farmer_id, 'review_received', 'New rating on order ' || v_order.reference,
    p_rating || ' out of 5', '/dashboard/orders/' || p_order_id, jsonb_build_object('order_id', p_order_id));
  return v_id;
end;
$$;

-- Contact details for an order, shared only once the farmer has confirmed it.
create or replace function public.get_order_contacts(p_order_id uuid)
returns table (party public.actor_role, display_name text, organisation_name text, phone text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or auth.uid() is null or (v_order.buyer_id <> auth.uid() and v_order.farmer_id <> auth.uid()) then
    return;
  end if;
  if v_order.status not in ('confirmed', 'preparing', 'ready', 'completed') then
    return;
  end if;
  return query
    select case when p.id = v_order.farmer_id then 'farmer'::public.actor_role else 'buyer'::public.actor_role end,
           p.display_name, p.organisation_name, c.phone, u.email::text
      from public.profiles p
      left join public.profile_contacts c on c.user_id = p.id
      left join auth.users u on u.id = p.id
     where p.id in (v_order.buyer_id, v_order.farmer_id);
end;
$$;

-- Public trust summary for a farmer profile (aggregates only).
create or replace function public.get_farmer_stats(p_farmer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not public.is_public_seller(p_farmer_id) then null else jsonb_build_object(
    'completed_orders', (select count(*) from public.orders o where o.farmer_id = p_farmer_id and o.status = 'completed'),
    'rating_count', (select count(*) from public.order_reviews r where r.farmer_id = p_farmer_id),
    'rating_average', (select round(avg(r.rating)::numeric, 1) from public.order_reviews r where r.farmer_id = p_farmer_id),
    'recent_reviews', coalesce((
      select jsonb_agg(jsonb_build_object('rating', x.rating, 'comment', x.comment, 'created_at', x.created_at))
      from (select r.rating, r.comment, r.created_at from public.order_reviews r
            where r.farmer_id = p_farmer_id and r.comment is not null
            order by r.created_at desc limit 5) x), '[]'::jsonb)
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- Execute privileges: API functions for signed-in users only; internals for nobody.
-- ---------------------------------------------------------------------------
revoke execute on function public._offer_turn(public.offer_status) from public, anon, authenticated;
revoke execute on function public._check_offer_terms(public.listings, numeric, bigint) from public, anon, authenticated;
revoke execute on function public._lock_offer(uuid) from public, anon, authenticated;
revoke execute on function public._offer_actor(public.offers) from public, anon, authenticated;
revoke execute on function public._require_open_turn(public.offers, public.actor_role, integer) from public, anon, authenticated;
revoke execute on function public._expire_open_offers_for_listing(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.listings_after_update() from public, anon, authenticated;
revoke execute on function public.expire_stale_offers() from public, anon, authenticated;
grant execute on function public.expire_stale_offers() to service_role;

revoke execute on function public.create_offer(uuid, numeric, bigint, public.fulfilment_method, text) from public, anon, authenticated;
revoke execute on function public.counter_offer(uuid, integer, numeric, bigint, text) from public, anon, authenticated;
revoke execute on function public.accept_offer(uuid, integer) from public, anon, authenticated;
revoke execute on function public.reject_offer(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.withdraw_offer(uuid, integer) from public, anon, authenticated;
revoke execute on function public.transition_order(uuid, text, text, date) from public, anon, authenticated;
revoke execute on function public.review_order(uuid, smallint, text) from public, anon, authenticated;
revoke execute on function public.get_order_contacts(uuid) from public, anon, authenticated;
grant execute on function public.create_offer(uuid, numeric, bigint, public.fulfilment_method, text) to authenticated;
grant execute on function public.counter_offer(uuid, integer, numeric, bigint, text) to authenticated;
grant execute on function public.accept_offer(uuid, integer) to authenticated;
grant execute on function public.reject_offer(uuid, integer, text) to authenticated;
grant execute on function public.withdraw_offer(uuid, integer) to authenticated;
grant execute on function public.transition_order(uuid, text, text, date) to authenticated;
grant execute on function public.review_order(uuid, smallint, text) to authenticated;
grant execute on function public.get_order_contacts(uuid) to authenticated;

revoke execute on function public.get_farmer_stats(uuid) from public, anon, authenticated;
grant execute on function public.get_farmer_stats(uuid) to anon, authenticated;
