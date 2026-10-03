-- Balqees Floral v10.29
-- Individual checkout must only be callable by authenticated individual accounts.

create or replace function public.customer_checkout_health(
  p_items jsonb,
  p_coupon_code text default null,
  p_address_id uuid default null,
  p_recipient_id uuid default null,
  p_payer_type text default 'self',
  p_is_gift boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.customer_profiles cp
    where cp.id=v_uid and cp.account_type='individual'
  ) then
    raise exception 'INDIVIDUAL_ACCOUNT_REQUIRED';
  end if;
  return private.customer_checkout_health_core(
    v_uid,p_items,p_coupon_code,p_address_id,p_recipient_id,p_payer_type,p_is_gift
  );
end;
$$;

revoke execute on function public.customer_checkout_health(jsonb,text,uuid,uuid,text,boolean) from public, anon;
grant execute on function public.customer_checkout_health(jsonb,text,uuid,uuid,text,boolean) to authenticated;

create or replace function public.customer_checkout_create_order(
  p_items jsonb,
  p_coupon_code text default null,
  p_customer_note text default null,
  p_address_id uuid default null,
  p_recipient_id uuid default null,
  p_is_gift boolean default false,
  p_gift_message text default null,
  p_sender_name_visible boolean default true,
  p_payer_type text default 'self',
  p_recipient_knows_payment boolean default false,
  p_accept_cod_terms boolean default false,
  p_idempotency_key uuid default null,
  p_occasion_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.customer_profiles cp
    where cp.id=v_uid and cp.account_type='individual'
  ) then
    raise exception 'INDIVIDUAL_ACCOUNT_REQUIRED';
  end if;
  return private.customer_checkout_create_order_core(
    v_uid,p_items,p_coupon_code,p_customer_note,p_address_id,p_recipient_id,
    p_is_gift,p_gift_message,p_sender_name_visible,p_payer_type,
    p_recipient_knows_payment,p_accept_cod_terms,p_idempotency_key,p_occasion_id
  );
end;
$$;

revoke execute on function public.customer_checkout_create_order(jsonb,text,text,uuid,uuid,boolean,text,boolean,text,boolean,boolean,uuid,uuid) from public, anon;
grant execute on function public.customer_checkout_create_order(jsonb,text,text,uuid,uuid,boolean,text,boolean,text,boolean,boolean,uuid,uuid) to authenticated;
