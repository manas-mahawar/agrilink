-- AgriLink foundation: enums, shared helpers, configuration and trusted admin list.
-- Conventions
--   * Every table lives in `public` with Row Level Security enabled.
--   * Table privileges are revoked from the API roles first, then granted narrowly.
--     (Supabase grants ALL on new public tables to anon/authenticated by default.)
--   * SECURITY DEFINER functions always `set search_path = ''` and fully qualify names.
--   * Money is stored as integer paise (bigint). Quantities are numeric(12,2) with an explicit unit.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
create type public.account_type as enum ('farmer', 'buyer');
create type public.buyer_type as enum ('retailer', 'restaurant', 'hotel', 'wholesaler', 'processor', 'other');
create type public.quantity_unit as enum ('kg', 'quintal', 'tonne');
create type public.listing_status as enum ('draft', 'active', 'paused', 'sold_out', 'archived');
create type public.availability_type as enum ('pre_harvest', 'ready_now');
create type public.quality_grade as enum ('grade_a', 'grade_b', 'ungraded');
create type public.fulfilment_method as enum ('buyer_pickup', 'farmer_delivery', 'logistics_partner');
create type public.offer_status as enum ('pending', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired');
create type public.order_status as enum ('awaiting_confirmation', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled');
create type public.payment_status as enum ('not_started', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.report_reason as enum ('misleading', 'prohibited', 'spam', 'fraud', 'abusive', 'other');
create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');
create type public.actor_role as enum ('buyer', 'farmer', 'admin', 'system');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Safe uuid parsing for storage paths and user input (returns null instead of raising).
create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- True when the current request runs as an API role (anon / authenticated) rather than
-- inside a trusted SECURITY DEFINER function or the service role.
create or replace function public.is_api_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('anon', 'authenticated');
$$;

-- ---------------------------------------------------------------------------
-- Application configuration (singleton row). Only the database owner / service role
-- may change it; the API roles cannot read or write the table directly.
-- ---------------------------------------------------------------------------
create table public.app_config (
  id smallint primary key default 1 check (id = 1),
  demo_data_visible boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.app_config (id) values (1);
alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;

create or replace function public.demo_data_visible()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select demo_data_visible from public.app_config where id = 1), false);
$$;

-- ---------------------------------------------------------------------------
-- Administrators. Assigned only by the project owner (SQL editor / service role).
-- Never derived from user-editable metadata or profile fields.
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- Lock down helper execution: functions are executable by PUBLIC by default.
revoke execute on function public.demo_data_visible() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.demo_data_visible() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- Small pure helpers used inside policies and invoker triggers.
revoke execute on function public.try_uuid(text) from public, anon, authenticated;
revoke execute on function public.is_api_role() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.try_uuid(text) to anon, authenticated, service_role;
grant execute on function public.is_api_role() to anon, authenticated, service_role;
