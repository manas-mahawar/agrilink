-- Reports (moderation queue) and administrator operations. Every admin action is audited.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete cascade,
  reason public.report_reason not null,
  details text check (details is null or char_length(details) <= 1000),
  status public.report_status not null default 'open',
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_single_target check ((listing_id is not null) <> (reported_user_id is not null))
);
create unique index reports_one_open_per_target on public.reports (reporter_id, coalesce(listing_id, reported_user_id))
  where status in ('open', 'reviewing');
create index reports_status_idx on public.reports (status, created_at desc);
create trigger reports_set_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

-- SECURITY INVOKER on purpose: is_api_role() must see the caller's role, not the owner's.
create or replace function public.reports_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_api_role() then return new; end if;
  if new.status <> 'open' or new.resolved_by is not null or new.resolution_note is not null then
    raise exception 'Protected report fields cannot be set' using errcode = 'insufficient_privilege';
  end if;
  if new.reported_user_id = new.reporter_id
     or (new.listing_id is not null and exists (select 1 from public.listings l where l.id = new.listing_id and l.farmer_id = new.reporter_id)) then
    raise exception 'You cannot report yourself or your own listing' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.reports r where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many reports in the last hour. Please try again later.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger reports_guard before insert on public.reports
  for each row execute function public.reports_guard();

alter table public.reports enable row level security;
revoke all on table public.reports from anon, authenticated;
grant select on table public.reports to authenticated;
grant insert (reporter_id, listing_id, reported_user_id, reason, details) on table public.reports to authenticated;

create policy "reports: reporters and admins read" on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());
create policy "reports: signed-in users report what they can see" on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and public.is_active_account()
    and (
      (listing_id is not null and exists (select 1 from public.listings l where l.id = listing_id))
      or (reported_user_id is not null and exists (select 1 from public.profiles p where p.id = reported_user_id))
    )
  );

-- ---------------------------------------------------------------------------
-- Administrator operations
-- ---------------------------------------------------------------------------
create or replace function public._require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    perform public._raise('ADMIN_ONLY', 'This action needs administrator access.');
  end if;
end;
$$;

create or replace function public.admin_set_listing_hidden(p_listing_id uuid, p_hidden boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
begin
  perform public._require_admin();
  if p_hidden and (v_reason is null or char_length(v_reason) < 3) then
    perform public._raise('REASON_REQUIRED', 'Give a reason so the farmer understands why.');
  end if;
  update public.listings set hidden_by_admin = p_hidden, hidden_reason = case when p_hidden then v_reason else null end
   where id = p_listing_id returning * into v_listing;
  if not found then
    perform public._raise('LISTING_NOT_FOUND', 'Listing not found.');
  end if;
  perform public._audit(auth.uid(), 'admin', case when p_hidden then 'listing.hide' else 'listing.unhide' end,
    'listing', p_listing_id::text, jsonb_build_object('reason', v_reason));
  perform public._notify(v_listing.farmer_id, case when p_hidden then 'listing_hidden' else 'listing_restored' end,
    case when p_hidden then 'Your listing was removed from the marketplace' else 'Your listing is visible again' end,
    case when p_hidden then 'Reason: ' || v_reason else v_listing.produce_name end,
    '/dashboard/listings', jsonb_build_object('listing_id', p_listing_id));
end;
$$;

create or replace function public.admin_set_user_suspended(p_user_id uuid, p_suspended boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
begin
  perform public._require_admin();
  if p_user_id = auth.uid() then
    perform public._raise('CANNOT_SUSPEND_SELF', 'You cannot suspend your own account.');
  end if;
  if p_suspended and (v_reason is null or char_length(v_reason) < 3) then
    perform public._raise('REASON_REQUIRED', 'Give a reason for the suspension.');
  end if;
  update public.profiles
     set suspended_at = case when p_suspended then coalesce(suspended_at, now()) else null end,
         suspension_reason = case when p_suspended then v_reason else null end
   where id = p_user_id;
  if not found then
    perform public._raise('USER_NOT_FOUND', 'User not found.');
  end if;
  perform public._audit(auth.uid(), 'admin', case when p_suspended then 'user.suspend' else 'user.unsuspend' end,
    'profile', p_user_id::text, jsonb_build_object('reason', v_reason));
end;
$$;

create or replace function public.admin_set_farmer_verified(p_user_id uuid, p_verified boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
  perform public._require_admin();
  if p_verified and (v_note is null or char_length(v_note) < 3) then
    perform public._raise('NOTE_REQUIRED', 'Record how this farmer was verified (for example, documents checked in person).');
  end if;
  update public.profiles set verified_at = case when p_verified then coalesce(verified_at, now()) else null end
   where id = p_user_id and account_type = 'farmer';
  if not found then
    perform public._raise('USER_NOT_FOUND', 'Farmer not found.');
  end if;
  perform public._audit(auth.uid(), 'admin', case when p_verified then 'farmer.verify' else 'farmer.unverify' end,
    'profile', p_user_id::text, jsonb_build_object('note', v_note));
end;
$$;

create or replace function public.admin_resolve_report(p_report_id uuid, p_status public.report_status, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 1000), '');
begin
  perform public._require_admin();
  if p_status = 'open' then
    perform public._raise('INVALID_STATUS', 'Choose reviewing, actioned or dismissed.');
  end if;
  update public.reports
     set status = p_status,
         resolution_note = coalesce(v_note, resolution_note),
         resolved_by = case when p_status in ('actioned', 'dismissed') then auth.uid() else resolved_by end,
         resolved_at = case when p_status in ('actioned', 'dismissed') then now() else resolved_at end
   where id = p_report_id
  returning * into v_report;
  if not found then
    perform public._raise('REPORT_NOT_FOUND', 'Report not found.');
  end if;
  perform public._audit(auth.uid(), 'admin', 'report.' || p_status, 'report', p_report_id::text, jsonb_build_object('note', v_note));
  if p_status in ('actioned', 'dismissed') then
    perform public._notify(v_report.reporter_id, 'report_resolved', 'Thanks for your report',
      case p_status when 'actioned' then 'We reviewed it and took action.' else 'We reviewed it and did not find a problem.' end,
      '/dashboard/notifications', jsonb_build_object('report_id', p_report_id));
  end if;
end;
$$;

-- Minimal user directory for administrators (no phone numbers).
create or replace function public.admin_list_users(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, email text, display_name text, account_type public.account_type, organisation_name text,
  district text, created_at timestamptz, verified_at timestamptz, suspended_at timestamptz, is_demo boolean,
  listing_count bigint, order_count bigint, is_admin boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public._require_admin();
  return query
    select p.id, u.email::text, p.display_name, p.account_type, p.organisation_name, p.district, p.created_at,
           p.verified_at, p.suspended_at, p.is_demo,
           (select count(*) from public.listings l where l.farmer_id = p.id),
           (select count(*) from public.orders o where o.farmer_id = p.id or o.buyer_id = p.id),
           exists (select 1 from public.admins a where a.user_id = p.id)
      from public.profiles p
      join auth.users u on u.id = p.id
     where v_search is null
        or p.display_name ilike '%' || v_search || '%'
        or u.email ilike '%' || v_search || '%'
        or coalesce(p.organisation_name, '') ilike '%' || v_search || '%'
     order by p.created_at desc
     limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'farmers', (select count(*) from public.profiles where account_type = 'farmer'),
    'buyers', (select count(*) from public.profiles where account_type = 'buyer'),
    'suspended', (select count(*) from public.profiles where suspended_at is not null),
    'active_listings', (select count(*) from public.listings where status = 'active' and not hidden_by_admin),
    'hidden_listings', (select count(*) from public.listings where hidden_by_admin),
    'open_offers', (select count(*) from public.offers where status in ('pending', 'countered') and expires_at > now()),
    'open_orders', (select count(*) from public.orders where status not in ('completed', 'cancelled')),
    'completed_orders', (select count(*) from public.orders where status = 'completed'),
    'open_reports', (select count(*) from public.reports where status in ('open', 'reviewing'))
  );
end;
$$;

revoke execute on function public.reports_guard() from public, anon, authenticated;
revoke execute on function public._require_admin() from public, anon, authenticated;
revoke execute on function public.admin_set_listing_hidden(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.admin_set_user_suspended(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.admin_set_farmer_verified(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.admin_resolve_report(uuid, public.report_status, text) from public, anon, authenticated;
revoke execute on function public.admin_list_users(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.admin_overview() from public, anon, authenticated;
grant execute on function public.admin_set_listing_hidden(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_user_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_farmer_verified(uuid, boolean, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, public.report_status, text) to authenticated;
grant execute on function public.admin_list_users(text, integer, integer) to authenticated;
grant execute on function public.admin_overview() to authenticated;
