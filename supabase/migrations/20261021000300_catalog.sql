-- Catalogue: reference data, listings, listing images and favourites.

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table public.categories (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  sort_order smallint not null default 100
);

-- Launch localities around Patiala. Listings point at a locality rather than an exact
-- address, so a farm's location is only ever shown at village / town level.
create table public.localities (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  district text not null,
  state text not null default 'Punjab',
  km_from_patiala smallint not null check (km_from_patiala between 0 and 500),
  sort_order smallint not null default 100
);

alter table public.categories enable row level security;
alter table public.localities enable row level security;
revoke all on table public.categories from anon, authenticated;
revoke all on table public.localities from anon, authenticated;
grant select on table public.categories to anon, authenticated;
grant select on table public.localities to anon, authenticated;
create policy "categories: readable by everyone" on public.categories for select to anon, authenticated using (true);
create policy "localities: readable by everyone" on public.localities for select to anon, authenticated using (true);

insert into public.categories (id, name, sort_order) values
  ('tomatoes', 'Tomatoes', 10),
  ('potatoes', 'Potatoes', 20),
  ('onions', 'Onions', 30),
  ('other-vegetables', 'Other vegetables', 40),
  ('fruits', 'Fruits', 50),
  ('grains-pulses', 'Grains & pulses', 60);

-- Approximate road distances to Patiala city (rounded; for filtering and sorting only).
insert into public.localities (id, name, district, km_from_patiala, sort_order) values
  ('patiala', 'Patiala', 'Patiala', 0, 10),
  ('sanaur', 'Sanaur', 'Patiala', 7, 20),
  ('bahadurgarh', 'Bahadurgarh', 'Patiala', 8, 30),
  ('dudhan-sadhan', 'Dudhan Sadhan', 'Patiala', 22, 40),
  ('rajpura', 'Rajpura', 'Patiala', 27, 50),
  ('nabha', 'Nabha', 'Patiala', 27, 60),
  ('samana', 'Samana', 'Patiala', 28, 70),
  ('ghanaur', 'Ghanaur', 'Patiala', 30, 80),
  ('bhadson', 'Bhadson', 'Patiala', 35, 90),
  ('patran', 'Patran', 'Patiala', 50, 100),
  ('shutrana', 'Shutrana', 'Patiala', 60, 110);

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  category_id text not null references public.categories (id),
  locality_id text not null references public.localities (id),
  produce_name text not null check (char_length(btrim(produce_name)) between 2 and 60),
  variety text check (variety is null or char_length(variety) <= 60),
  description text check (description is null or char_length(description) <= 2000),
  unit public.quantity_unit not null default 'quintal',
  quantity_total numeric(12, 2) not null check (quantity_total > 0 and quantity_total <= 1000000),
  quantity_reserved numeric(12, 2) not null default 0 check (quantity_reserved >= 0),
  quantity_sold numeric(12, 2) not null default 0 check (quantity_sold >= 0),
  quantity_available numeric(12, 2) generated always as (quantity_total - quantity_reserved - quantity_sold) stored,
  min_order_qty numeric(12, 2) not null check (min_order_qty > 0),
  max_order_qty numeric(12, 2) check (max_order_qty is null or max_order_qty > 0),
  price_per_unit_paise bigint not null check (price_per_unit_paise > 0 and price_per_unit_paise <= 10000000000),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  availability_type public.availability_type not null default 'pre_harvest',
  expected_harvest_date date,
  available_until date,
  quality_grade public.quality_grade not null default 'ungraded',
  quality_notes text check (quality_notes is null or char_length(quality_notes) <= 500),
  status public.listing_status not null default 'draft',
  hidden_by_admin boolean not null default false,
  hidden_reason text,
  is_demo boolean not null default false,
  search_text text generated always as (
    lower(produce_name || ' ' || coalesce(variety, '') || ' ' || coalesce(description, ''))
  ) stored,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_quantities_consistent check (quantity_reserved + quantity_sold <= quantity_total),
  constraint listing_order_range check (max_order_qty is null or max_order_qty >= min_order_qty),
  constraint listing_min_within_total check (min_order_qty <= quantity_total),
  constraint listing_pre_harvest_needs_date check (availability_type <> 'pre_harvest' or expected_harvest_date is not null),
  constraint listing_window check (available_until is null or expected_harvest_date is null or available_until >= expected_harvest_date)
);

create index listings_status_idx on public.listings (status, hidden_by_admin);
create index listings_farmer_idx on public.listings (farmer_id, status);
create index listings_category_idx on public.listings (category_id);
create index listings_locality_idx on public.listings (locality_id);
create index listings_harvest_idx on public.listings (expected_harvest_date);
create index listings_price_idx on public.listings (price_per_unit_paise);
create index listings_search_trgm_idx on public.listings using gin (search_text extensions.gin_trgm_ops);
create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- Lifecycle and invariants for changes made directly through the API.
-- Trusted SECURITY DEFINER functions (offers/orders/admin) bypass the user rules below
-- because they run as the function owner, not as an API role.
create or replace function public.listings_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if tg_op = 'INSERT' then
    if public.is_api_role() then
      if new.status not in ('draft', 'active') then
        raise exception 'A new listing must start as draft or active' using errcode = 'check_violation';
      end if;
      if new.quantity_reserved <> 0 or new.quantity_sold <> 0 or new.hidden_by_admin or new.is_demo then
        raise exception 'Protected listing fields cannot be set' using errcode = 'insufficient_privilege';
      end if;
      if (select count(*) from public.listings l where l.farmer_id = new.farmer_id and l.created_at > now() - interval '1 day') >= 30 then
        raise exception 'Daily listing limit reached. Try again tomorrow.' using errcode = 'P0001';
      end if;
    end if;
    if new.status = 'active' then
      new.published_at := coalesce(new.published_at, now());
    end if;
    return new;
  end if;

  -- UPDATE
  if public.is_api_role() then
    if new.farmer_id <> old.farmer_id then
      raise exception 'Listing owner cannot change' using errcode = 'insufficient_privilege';
    end if;
    if old.status = 'archived' then
      raise exception 'Archived listings cannot be edited' using errcode = 'check_violation';
    end if;
    if old.hidden_by_admin and new.status = 'active' and old.status <> 'active' then
      raise exception 'This listing is hidden by moderators and cannot be republished' using errcode = 'insufficient_privilege';
    end if;
    if new.status <> old.status then
      allowed := case old.status
        when 'draft' then new.status in ('active', 'archived')
        when 'active' then new.status in ('paused', 'archived')
        when 'paused' then new.status in ('active', 'archived')
        when 'sold_out' then new.status in ('archived') or (new.status = 'active' and new.quantity_available > 0)
        else false
      end;
      if not allowed then
        raise exception 'A listing cannot move from % to %', old.status, new.status using errcode = 'check_violation';
      end if;
    end if;
    if new.unit <> old.unit and exists (select 1 from public.offers o where o.listing_id = old.id) then
      raise exception 'The unit cannot change after offers have been made' using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'active' and old.status <> 'active' then
    new.published_at := coalesce(old.published_at, now());
  end if;
  return new;
end;
$$;

create trigger listings_guard before insert or update on public.listings
  for each row execute function public.listings_guard();

-- ---------------------------------------------------------------------------
-- Listing images (files live in the `listing-images` storage bucket)
-- ---------------------------------------------------------------------------
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 300),
  position smallint not null default 0 check (position between 0 and 20),
  width integer check (width is null or width between 1 and 10000),
  height integer check (height is null or height between 1 and 10000),
  alt_text text check (alt_text is null or char_length(alt_text) <= 200),
  created_at timestamptz not null default now()
);
create index listing_images_listing_idx on public.listing_images (listing_id, position);

create or replace function public.listing_images_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_farmer uuid;
begin
  select l.farmer_id into v_farmer from public.listings l where l.id = new.listing_id;
  if v_farmer is null then
    raise exception 'Listing not found' using errcode = 'foreign_key_violation';
  end if;
  -- The object path must sit in the owner's folder: <farmer_id>/<listing_id>/<file>
  if split_part(new.storage_path, '/', 1) <> v_farmer::text
     or split_part(new.storage_path, '/', 2) <> new.listing_id::text then
    raise exception 'Image path does not belong to this listing' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.listing_images i where i.listing_id = new.listing_id) >= 6 then
    raise exception 'A listing can have at most 6 photos' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger listing_images_guard before insert or update on public.listing_images
  for each row execute function public.listing_images_guard();

-- ---------------------------------------------------------------------------
-- Favourites (saved listings)
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index favorites_listing_idx on public.favorites (listing_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.favorites enable row level security;

revoke all on table public.listings from anon, authenticated;
revoke all on table public.listing_images from anon, authenticated;
revoke all on table public.favorites from anon, authenticated;

grant select on table public.listings to anon, authenticated;
grant insert (farmer_id, category_id, locality_id, produce_name, variety, description, unit, quantity_total,
              min_order_qty, max_order_qty, price_per_unit_paise, availability_type, expected_harvest_date,
              available_until, quality_grade, quality_notes, status)
  on table public.listings to authenticated;
grant update (category_id, locality_id, produce_name, variety, description, unit, quantity_total,
              min_order_qty, max_order_qty, price_per_unit_paise, availability_type, expected_harvest_date,
              available_until, quality_grade, quality_notes, status)
  on table public.listings to authenticated;
grant delete on table public.listings to authenticated;

grant select on table public.listing_images to anon, authenticated;
grant insert (listing_id, storage_path, position, width, height, alt_text) on table public.listing_images to authenticated;
grant update (position, alt_text) on table public.listing_images to authenticated;
grant delete on table public.listing_images to authenticated;

grant select, insert, delete on table public.favorites to authenticated;

-- Buyers who negotiated or traded on a listing keep access to it even after it is paused or archived.
create or replace function public.has_deal_on_listing(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select false; $$;

create policy "listings: live for all; owners, participants, admins see more"
  on public.listings for select
  to anon, authenticated
  using (
    (
      status in ('active', 'sold_out')
      and not hidden_by_admin
      and (not is_demo or public.demo_data_visible())
      and public.is_public_seller(farmer_id)
    )
    or farmer_id = (select auth.uid())
    or public.is_admin()
    or public.has_deal_on_listing(id)
  );

create policy "listings: active farmers create their own"
  on public.listings for insert
  to authenticated
  with check (farmer_id = (select auth.uid()) and public.is_active_farmer());

create policy "listings: owners update their own"
  on public.listings for update
  to authenticated
  using (farmer_id = (select auth.uid()) and public.is_active_farmer())
  with check (farmer_id = (select auth.uid()));

create policy "listings: owners delete drafts"
  on public.listings for delete
  to authenticated
  using (farmer_id = (select auth.uid()) and status = 'draft');

-- Image rows follow the visibility of their listing (the subquery runs under listing RLS).
create policy "listing_images: visible with their listing"
  on public.listing_images for select
  to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));

create policy "listing_images: owners add"
  on public.listing_images for insert
  to authenticated
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.farmer_id = (select auth.uid()) and l.status <> 'archived'));

create policy "listing_images: owners reorder"
  on public.listing_images for update
  to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.farmer_id = (select auth.uid())))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.farmer_id = (select auth.uid())));

create policy "listing_images: owners remove"
  on public.listing_images for delete
  to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.farmer_id = (select auth.uid())));

create policy "favorites: owners read"
  on public.favorites for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "favorites: buyers save visible listings"
  on public.favorites for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.current_account_type() = 'buyer'
    and exists (select 1 from public.listings l where l.id = listing_id)
  );

create policy "favorites: owners remove"
  on public.favorites for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke execute on function public.has_deal_on_listing(uuid) from public, anon, authenticated;
grant execute on function public.has_deal_on_listing(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Read model for the marketplace. security_invoker keeps the caller's RLS in force,
-- so this view never shows more than the underlying tables would.
-- ---------------------------------------------------------------------------
create view public.marketplace_listings
with (security_invoker = true)
as
select
  l.id,
  l.farmer_id,
  l.category_id,
  c.name as category_name,
  l.locality_id,
  loc.name as locality_name,
  loc.district,
  loc.km_from_patiala,
  l.produce_name,
  l.variety,
  l.unit,
  l.quantity_total,
  l.quantity_available,
  l.min_order_qty,
  l.max_order_qty,
  l.price_per_unit_paise,
  round(l.price_per_unit_paise::numeric / case l.unit when 'kg' then 1 when 'quintal' then 100 else 1000 end)::bigint as price_per_kg_paise,
  (l.quantity_available * case l.unit when 'kg' then 1 when 'quintal' then 100 else 1000 end)::numeric(14, 2) as quantity_available_kg,
  l.currency,
  l.availability_type,
  l.expected_harvest_date,
  l.available_until,
  l.quality_grade,
  l.status,
  l.hidden_by_admin,
  l.is_demo,
  l.search_text,
  l.published_at,
  l.created_at,
  p.display_name as farmer_name,
  p.verified_at as farmer_verified_at,
  (
    select i.storage_path
    from public.listing_images i
    where i.listing_id = l.id
    order by i.position, i.created_at
    limit 1
  ) as cover_path
from public.listings l
join public.categories c on c.id = l.category_id
join public.localities loc on loc.id = l.locality_id
join public.profiles p on p.id = l.farmer_id;

revoke all on table public.marketplace_listings from anon, authenticated;
grant select on table public.marketplace_listings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Marketplace search. SECURITY INVOKER, so RLS on the underlying tables applies to the caller.
-- User text is matched with ILIKE (wildcards escaped) and trigram similarity for "best match".
-- ---------------------------------------------------------------------------
create or replace function public.search_listings(
  p_query text default null,
  p_category text default null,
  p_locality text default null,
  p_max_km integer default null,
  p_min_price_per_kg bigint default null,
  p_max_price_per_kg bigint default null,
  p_min_qty_kg numeric default null,
  p_harvest_within_days integer default null,
  p_verified_only boolean default false,
  p_availability public.availability_type default null,
  p_sort text default 'relevance',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid, farmer_id uuid, category_id text, category_name text, locality_id text, locality_name text, district text,
  km_from_patiala smallint, produce_name text, variety text, unit public.quantity_unit, quantity_total numeric,
  quantity_available numeric, min_order_qty numeric, max_order_qty numeric, price_per_unit_paise bigint,
  price_per_kg_paise bigint, availability_type public.availability_type, expected_harvest_date date,
  quality_grade public.quality_grade, status public.listing_status, is_demo boolean, published_at timestamptz,
  farmer_name text, farmer_verified_at timestamptz, cover_path text, total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with params as (
    select
      nullif(lower(btrim(left(coalesce(p_query, ''), 80))), '') as q,
      replace(replace(replace(lower(btrim(left(coalesce(p_query, ''), 80))), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') as q_like
  ), hits as (
    select m.*,
           case when (select q from params) is null then 0
                else extensions.similarity(m.search_text || ' ' || lower(m.locality_name), (select q from params)) end as score
      from public.marketplace_listings m
     where m.status = 'active'
       and not m.hidden_by_admin
       and m.quantity_available > 0
       and (p_category is null or m.category_id = p_category)
       and (p_locality is null or m.locality_id = p_locality)
       and (p_max_km is null or m.km_from_patiala <= p_max_km)
       and (p_min_price_per_kg is null or m.price_per_kg_paise >= p_min_price_per_kg)
       and (p_max_price_per_kg is null or m.price_per_kg_paise <= p_max_price_per_kg)
       and (p_min_qty_kg is null or m.quantity_available_kg >= p_min_qty_kg)
       and (p_harvest_within_days is null or coalesce(m.expected_harvest_date, current_date) <= current_date + p_harvest_within_days)
       and (not coalesce(p_verified_only, false) or m.farmer_verified_at is not null)
       and (p_availability is null or m.availability_type = p_availability)
       and (
         (select q from params) is null
         or m.search_text ilike '%' || (select q_like from params) || '%'
         or lower(m.locality_name) ilike '%' || (select q_like from params) || '%'
         or lower(m.farmer_name) ilike '%' || (select q_like from params) || '%'
         or lower(m.category_name) ilike '%' || (select q_like from params) || '%'
         or extensions.word_similarity((select q from params), m.search_text) > 0.45
       )
  )
  select h.id, h.farmer_id, h.category_id, h.category_name, h.locality_id, h.locality_name, h.district,
         h.km_from_patiala, h.produce_name, h.variety, h.unit, h.quantity_total, h.quantity_available,
         h.min_order_qty, h.max_order_qty, h.price_per_unit_paise, h.price_per_kg_paise, h.availability_type,
         h.expected_harvest_date, h.quality_grade, h.status, h.is_demo, h.published_at, h.farmer_name,
         h.farmer_verified_at, h.cover_path, count(*) over () as total_count
    from hits h
   order by
     case when p_sort = 'price_low' then h.price_per_kg_paise end asc nulls last,
     case when p_sort = 'price_high' then h.price_per_kg_paise end desc nulls last,
     case when p_sort = 'harvest' then coalesce(h.expected_harvest_date, current_date) end asc nulls last,
     case when p_sort = 'nearest' then h.km_from_patiala end asc nulls last,
     case when p_sort = 'relevance' then h.score end desc nulls last,
     h.published_at desc nulls last,
     h.id
   limit least(greatest(coalesce(p_limit, 12), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke execute on function public.search_listings(text, text, text, integer, bigint, bigint, numeric, integer, boolean, public.availability_type, text, integer, integer) from public, anon, authenticated;
grant execute on function public.search_listings(text, text, text, integer, bigint, bigint, numeric, integer, boolean, public.availability_type, text, integer, integer) to anon, authenticated;
