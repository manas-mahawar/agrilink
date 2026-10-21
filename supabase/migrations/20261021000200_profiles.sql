-- Profiles: public-facing account data. Private contact details live in profile_contacts.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_type public.account_type not null,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
  organisation_name text check (organisation_name is null or char_length(organisation_name) <= 120),
  buyer_type public.buyer_type,
  district text check (district is null or char_length(district) <= 80),
  state text not null default 'Punjab' check (char_length(state) <= 80),
  village text check (village is null or char_length(village) <= 80),
  bio text check (bio is null or char_length(bio) <= 600),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 300),
  -- Trust and moderation fields: set only by administrators through audited functions.
  verified_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buyer_fields_only_for_buyers check (account_type = 'buyer' or (buyer_type is null and organisation_name is null))
);
create index profiles_account_type_idx on public.profiles (account_type);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Private contact details: visible to the owner, to administrators through functions,
-- and to an order counterparty only after an order is confirmed (see get_order_contacts).
create table public.profile_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text check (phone is null or phone ~ '^\+?[0-9][0-9 ]{8,16}[0-9]$'),
  updated_at timestamptz not null default now()
);
create trigger profile_contacts_set_updated_at before update on public.profile_contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers used by policies (SECURITY DEFINER so they can read across RLS safely).
-- ---------------------------------------------------------------------------
create or replace function public.current_account_type()
returns public.account_type
language sql
stable
security definer
set search_path = ''
as $$
  select p.account_type from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.suspended_at is null);
$$;

create or replace function public.is_active_farmer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type = 'farmer' and p.suspended_at is null
  );
$$;

-- A farmer whose listings may appear publicly.
create or replace function public.is_public_seller(p_farmer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_farmer_id
      and p.account_type = 'farmer'
      and p.suspended_at is null
      and (not p.is_demo or public.demo_data_visible())
  );
$$;

-- ---------------------------------------------------------------------------
-- New user hook: create a profile from sign-up metadata. Only 'farmer' or 'buyer'
-- can ever come from here; administrator rights are a separate table.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_type public.account_type;
  v_name text;
  v_phone text;
  v_buyer_type public.buyer_type;
  v_org text;
begin
  v_type := case meta->>'account_type' when 'farmer' then 'farmer'::public.account_type else 'buyer'::public.account_type end;

  v_name := btrim(coalesce(meta->>'display_name', ''));
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    v_name := left(split_part(coalesce(new.email, 'AgriLink user'), '@', 1), 80);
    if char_length(v_name) < 2 then v_name := 'AgriLink user'; end if;
  end if;

  if v_type = 'buyer' then
    v_org := nullif(left(btrim(coalesce(meta->>'organisation_name', '')), 120), '');
    v_buyer_type := case meta->>'buyer_type'
      when 'retailer' then 'retailer'::public.buyer_type
      when 'restaurant' then 'restaurant'::public.buyer_type
      when 'hotel' then 'hotel'::public.buyer_type
      when 'wholesaler' then 'wholesaler'::public.buyer_type
      when 'processor' then 'processor'::public.buyer_type
      when 'other' then 'other'::public.buyer_type
      else null end;
  end if;

  insert into public.profiles (id, account_type, display_name, organisation_name, buyer_type, district, state, village)
  values (
    new.id,
    v_type,
    v_name,
    v_org,
    v_buyer_type,
    nullif(left(btrim(coalesce(meta->>'district', '')), 80), ''),
    coalesce(nullif(left(btrim(coalesce(meta->>'state', '')), 80), ''), 'Punjab'),
    nullif(left(btrim(coalesce(meta->>'village', '')), 80), '')
  );

  v_phone := nullif(btrim(coalesce(meta->>'phone', '')), '');
  if v_phone is not null and v_phone !~ '^\+?[0-9][0-9 ]{8,16}[0-9]$' then
    v_phone := null;
  end if;
  insert into public.profile_contacts (user_id, phone) values (new.id, v_phone);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.profile_contacts from anon, authenticated;

grant select on table public.profiles to anon, authenticated;
grant update (display_name, organisation_name, buyer_type, district, state, village, bio, avatar_path)
  on table public.profiles to authenticated;

grant select, insert on table public.profile_contacts to authenticated;
grant update (phone) on table public.profile_contacts to authenticated;

-- Profiles that negotiated or traded with the current user (so a farmer can see the buyer).
-- Defined later once offers exist; a placeholder returning false keeps this migration standalone.
create or replace function public.shares_deal_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select false; $$;

create policy "profiles: public farmers, self, counterparties, admins"
  on public.profiles for select
  to anon, authenticated
  using (
    id = (select auth.uid())
    or public.is_admin()
    or (account_type = 'farmer' and suspended_at is null and (not is_demo or public.demo_data_visible()))
    or public.shares_deal_with(id)
  );

create policy "profiles: owners update their own row"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profile_contacts: owner reads"
  on public.profile_contacts for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "profile_contacts: owner inserts"
  on public.profile_contacts for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "profile_contacts: owner updates"
  on public.profile_contacts for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke execute on function public.current_account_type() from public, anon, authenticated;
revoke execute on function public.is_active_account() from public, anon, authenticated;
revoke execute on function public.is_active_farmer() from public, anon, authenticated;
revoke execute on function public.is_public_seller(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.shares_deal_with(uuid) from public, anon, authenticated;
grant execute on function public.current_account_type() to anon, authenticated, service_role;
grant execute on function public.is_active_account() to anon, authenticated, service_role;
grant execute on function public.is_active_farmer() to anon, authenticated, service_role;
grant execute on function public.is_public_seller(uuid) to anon, authenticated, service_role;
grant execute on function public.shares_deal_with(uuid) to anon, authenticated, service_role;
