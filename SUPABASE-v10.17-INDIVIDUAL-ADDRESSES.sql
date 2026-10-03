-- Balqees Floral v10.17 — individual addresses & recipients
-- Applied to the connected Supabase project on 2026-09-30.

alter table public.customer_recipients
  add column if not exists is_active boolean not null default true;

create index if not exists customer_recipients_user_active_idx
  on public.customer_recipients (user_id, is_active, is_favorite desc, updated_at desc);
create index if not exists customer_recipients_user_phone_idx
  on public.customer_recipients (user_id, phone);

create table if not exists public.customer_recipient_addresses (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references public.customer_recipients(id) on delete cascade,
  address_id uuid not null references public.customer_addresses(id) on delete cascade,
  is_default boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (recipient_id, address_id)
);

alter table public.customer_recipient_addresses enable row level security;
create index if not exists customer_recipient_addresses_user_idx on public.customer_recipient_addresses (user_id, updated_at desc);
create index if not exists customer_recipient_addresses_address_idx on public.customer_recipient_addresses (address_id);
create unique index if not exists customer_recipient_addresses_one_default_uq on public.customer_recipient_addresses (recipient_id) where is_default;

drop policy if exists customer_recipient_addresses_select_own on public.customer_recipient_addresses;
create policy customer_recipient_addresses_select_own on public.customer_recipient_addresses for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists customer_recipient_addresses_insert_own on public.customer_recipient_addresses;
create policy customer_recipient_addresses_insert_own on public.customer_recipient_addresses for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.customer_recipients r where r.id=recipient_id and r.user_id=(select auth.uid()) and r.is_active)
  and exists (select 1 from public.customer_addresses a where a.id=address_id and a.user_id=(select auth.uid()) and a.is_active)
);

drop policy if exists customer_recipient_addresses_update_own on public.customer_recipient_addresses;
create policy customer_recipient_addresses_update_own on public.customer_recipient_addresses for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.customer_recipients r where r.id=recipient_id and r.user_id=(select auth.uid()) and r.is_active)
  and exists (select 1 from public.customer_addresses a where a.id=address_id and a.user_id=(select auth.uid()) and a.is_active)
);

drop policy if exists customer_recipient_addresses_delete_own on public.customer_recipient_addresses;
create policy customer_recipient_addresses_delete_own on public.customer_recipient_addresses for delete to authenticated
using ((select auth.uid()) = user_id);

insert into public.customer_recipient_addresses(user_id,recipient_id,address_id,is_default)
select r.user_id,r.id,r.default_address_id,true
from public.customer_recipients r
join public.customer_addresses a on a.id=r.default_address_id
where r.default_address_id is not null and a.user_id=r.user_id
on conflict(recipient_id,address_id) do update set is_default=true,updated_at=now();

create or replace function private.customer_set_default_address_core(p_address_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.customer_addresses where id=p_address_id and user_id=v_user and is_active) then raise exception 'ADDRESS_INVALID'; end if;
  update public.customer_addresses set is_default=(id=p_address_id),updated_at=now() where user_id=v_user and is_active;
  insert into public.customer_preferences(user_id,default_address_id) values(v_user,p_address_id)
  on conflict(user_id) do update set default_address_id=excluded.default_address_id,updated_at=now();
  return jsonb_build_object('updated',true,'address_id',p_address_id);
end;$$;
revoke execute on function private.customer_set_default_address_core(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.customer_set_default_address_core(uuid) to authenticated;

create or replace function public.customer_set_default_address(p_address_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$select private.customer_set_default_address_core(p_address_id);$$;
revoke execute on function public.customer_set_default_address(uuid) from public,anon;
grant execute on function public.customer_set_default_address(uuid) to authenticated;

create or replace function private.customer_set_default_recipient_core(p_recipient_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.customer_recipients where id=p_recipient_id and user_id=v_user and is_active) then raise exception 'RECIPIENT_INVALID'; end if;
  update public.customer_recipients set is_favorite=(id=p_recipient_id),updated_at=now() where user_id=v_user and is_active;
  insert into public.customer_preferences(user_id,default_recipient_id) values(v_user,p_recipient_id)
  on conflict(user_id) do update set default_recipient_id=excluded.default_recipient_id,updated_at=now();
  return jsonb_build_object('updated',true,'recipient_id',p_recipient_id);
end;$$;
revoke execute on function private.customer_set_default_recipient_core(uuid) from public,anon;
grant execute on function private.customer_set_default_recipient_core(uuid) to authenticated;

create or replace function public.customer_set_default_recipient(p_recipient_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$select private.customer_set_default_recipient_core(p_recipient_id);$$;
revoke execute on function public.customer_set_default_recipient(uuid) from public,anon;
grant execute on function public.customer_set_default_recipient(uuid) to authenticated;

create or replace function private.customer_set_recipient_default_address_core(p_recipient_id uuid,p_address_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.customer_recipients where id=p_recipient_id and user_id=v_user and is_active) then raise exception 'RECIPIENT_INVALID'; end if;
  if not exists(select 1 from public.customer_addresses where id=p_address_id and user_id=v_user and is_active) then raise exception 'ADDRESS_INVALID'; end if;
  update public.customer_recipient_addresses set is_default=false,updated_at=now() where recipient_id=p_recipient_id and user_id=v_user;
  insert into public.customer_recipient_addresses(user_id,recipient_id,address_id,is_default,updated_at)
  values(v_user,p_recipient_id,p_address_id,true,now())
  on conflict(recipient_id,address_id) do update set is_default=true,updated_at=now();
  update public.customer_recipients set default_address_id=p_address_id,updated_at=now() where id=p_recipient_id and user_id=v_user;
  return jsonb_build_object('updated',true,'recipient_id',p_recipient_id,'address_id',p_address_id);
end;$$;
revoke execute on function private.customer_set_recipient_default_address_core(uuid,uuid) from public,anon;
grant execute on function private.customer_set_recipient_default_address_core(uuid,uuid) to authenticated;

create or replace function public.customer_set_recipient_default_address(p_recipient_id uuid,p_address_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$select private.customer_set_recipient_default_address_core(p_recipient_id,p_address_id);$$;
revoke execute on function public.customer_set_recipient_default_address(uuid,uuid) from public,anon;
grant execute on function public.customer_set_recipient_default_address(uuid,uuid) to authenticated;

-- Safe soft-archive helpers. Historical orders keep their recipient/address snapshots intact.
create or replace function private.customer_archive_address_core(p_address_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_next uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.customer_addresses where id=p_address_id and user_id=v_user and is_active) then raise exception 'ADDRESS_INVALID'; end if;

  delete from public.customer_recipient_addresses where user_id=v_user and address_id=p_address_id;
  update public.customer_recipients set default_address_id=null, updated_at=now() where user_id=v_user and default_address_id=p_address_id;
  update public.customer_addresses set is_active=false,is_default=false,updated_at=now() where id=p_address_id and user_id=v_user;

  select id into v_next from public.customer_addresses where user_id=v_user and is_active order by updated_at desc limit 1;
  update public.customer_addresses set is_default=(id=v_next),updated_at=now() where user_id=v_user and is_active;

  insert into public.customer_preferences(user_id,default_address_id)
  values(v_user,v_next)
  on conflict(user_id) do update set default_address_id=excluded.default_address_id,updated_at=now();

  return jsonb_build_object('archived',true,'address_id',p_address_id,'next_default_address_id',v_next);
end;
$$;
revoke execute on function private.customer_archive_address_core(uuid) from public,anon;
grant execute on function private.customer_archive_address_core(uuid) to authenticated;

create or replace function public.customer_archive_address(p_address_id uuid)
returns jsonb
language sql
security invoker
set search_path=''
as $$select private.customer_archive_address_core(p_address_id);$$;
revoke execute on function public.customer_archive_address(uuid) from public,anon;
grant execute on function public.customer_archive_address(uuid) to authenticated;

create or replace function private.customer_archive_recipient_core(p_recipient_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_next uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.customer_recipients where id=p_recipient_id and user_id=v_user and is_active) then raise exception 'RECIPIENT_INVALID'; end if;

  delete from public.customer_recipient_addresses where user_id=v_user and recipient_id=p_recipient_id;
  update public.customer_recipients set is_active=false,is_favorite=false,updated_at=now() where id=p_recipient_id and user_id=v_user;

  select id into v_next from public.customer_recipients where user_id=v_user and is_active order by is_favorite desc,updated_at desc limit 1;
  update public.customer_recipients set is_favorite=(id=v_next),updated_at=now() where user_id=v_user and is_active;

  insert into public.customer_preferences(user_id,default_recipient_id)
  values(v_user,v_next)
  on conflict(user_id) do update set default_recipient_id=excluded.default_recipient_id,updated_at=now();

  return jsonb_build_object('archived',true,'recipient_id',p_recipient_id,'next_default_recipient_id',v_next);
end;
$$;
revoke execute on function private.customer_archive_recipient_core(uuid) from public,anon;
grant execute on function private.customer_archive_recipient_core(uuid) to authenticated;

create or replace function public.customer_archive_recipient(p_recipient_id uuid)
returns jsonb
language sql
security invoker
set search_path=''
as $$select private.customer_archive_recipient_core(p_recipient_id);$$;
revoke execute on function public.customer_archive_recipient(uuid) from public,anon;
grant execute on function public.customer_archive_recipient(uuid) to authenticated;
