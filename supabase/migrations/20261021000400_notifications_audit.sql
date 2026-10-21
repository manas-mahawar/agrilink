-- In-app notifications and the audit log. Rows are written only by trusted functions.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type ~ '^[a-z_]{3,40}$'),
  title text not null check (char_length(title) <= 160),
  body text check (body is null or char_length(body) <= 600),
  -- Relative in-app paths only (no external URLs, no javascript: links).
  link_path text check (link_path is null or link_path ~ '^/[A-Za-z0-9/_?=&.%-]*$'),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_role public.actor_role not null,
  action text not null check (char_length(action) <= 80),
  target_type text not null check (char_length(target_type) <= 40),
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events (created_at desc);
create index audit_events_target_idx on public.audit_events (target_type, target_id);

alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;

grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant delete on table public.notifications to authenticated;
grant select on table public.audit_events to authenticated;

create policy "notifications: owners read"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: owners mark read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "notifications: owners dismiss"
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "audit_events: administrators read"
  on public.audit_events for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Internal helpers (not callable through the API)
-- ---------------------------------------------------------------------------

-- Raise a business-rule error. MESSAGE carries a stable machine code, HINT the
-- human-readable text shown to the user. errcode P0001 maps to HTTP 400 in PostgREST.
create or replace function public._raise(p_code text, p_hint text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, hint = p_hint;
end;
$$;

create or replace function public._notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link_path text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then return; end if;
  insert into public.notifications (user_id, type, title, body, link_path, payload)
  values (p_user_id, p_type, left(p_title, 160), left(p_body, 600), p_link_path, coalesce(p_payload, '{}'::jsonb));
end;
$$;

create or replace function public._audit(
  p_actor_id uuid,
  p_actor_role public.actor_role,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (actor_id, actor_role, action, target_type, target_id, details)
  values (p_actor_id, p_actor_role, p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Human formatting used inside notification text.
create or replace function public._format_inr(p_paise bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select '₹' || case
    when p_paise % 100 = 0 then to_char(p_paise / 100, 'FM999,999,999,990')
    else to_char(p_paise / 100.0, 'FM999,999,999,990.00')
  end;
$$;

create or replace function public._format_qty(p_qty numeric, p_unit public.quantity_unit)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(trailing '.' from trim(trailing '0' from to_char(p_qty, 'FM999999990.00')))
         || ' ' || case p_unit when 'kg' then 'kg' when 'quintal' then (case when p_qty = 1 then 'quintal' else 'quintals' end)
                                    else (case when p_qty = 1 then 'tonne' else 'tonnes' end) end;
$$;

revoke execute on function public._raise(text, text) from public, anon, authenticated;
revoke execute on function public._notify(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public._audit(uuid, public.actor_role, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public._format_inr(bigint) from public, anon, authenticated;
revoke execute on function public._format_qty(numeric, public.quantity_unit) from public, anon, authenticated;
