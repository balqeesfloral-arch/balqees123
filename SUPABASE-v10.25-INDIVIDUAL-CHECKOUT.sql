-- Balqees Floral v10.25 — Individual checkout hardening

create table if not exists public.customer_checkout_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  step smallint not null default 1 check (step between 1 and 3),
  recipient_id uuid references public.customer_recipients(id) on delete set null,
  address_id uuid references public.customer_addresses(id) on delete set null,
  payer_type text check (payer_type is null or payer_type in ('self','recipient')),
  is_gift boolean not null default false,
  gift_message text,
  sender_name_visible boolean not null default true,
  customer_note text,
  coupon_code text,
  occasion_id uuid references public.customer_occasions(id) on delete set null,
  idempotency_key uuid,
  updated_at timestamptz not null default now()
);
alter table public.customer_checkout_drafts add column if not exists idempotency_key uuid;
alter table public.customer_checkout_drafts enable row level security;
grant select,insert,update,delete on public.customer_checkout_drafts to authenticated;

drop policy if exists customer_checkout_drafts_select_own on public.customer_checkout_drafts;
create policy customer_checkout_drafts_select_own on public.customer_checkout_drafts
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists customer_checkout_drafts_insert_own on public.customer_checkout_drafts;
create policy customer_checkout_drafts_insert_own on public.customer_checkout_drafts
for insert to authenticated with check (
  (select auth.uid()) = user_id
  and (recipient_id is null or exists (select 1 from public.customer_recipients r where r.id=recipient_id and r.user_id=(select auth.uid()) and r.is_active))
  and (address_id is null or exists (select 1 from public.customer_addresses a where a.id=address_id and a.user_id=(select auth.uid()) and a.is_active))
  and (occasion_id is null or exists (select 1 from public.customer_occasions o where o.id=occasion_id and o.user_id=(select auth.uid()) and o.is_active))
);

drop policy if exists customer_checkout_drafts_update_own on public.customer_checkout_drafts;
create policy customer_checkout_drafts_update_own on public.customer_checkout_drafts
for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (recipient_id is null or exists (select 1 from public.customer_recipients r where r.id=recipient_id and r.user_id=(select auth.uid()) and r.is_active))
  and (address_id is null or exists (select 1 from public.customer_addresses a where a.id=address_id and a.user_id=(select auth.uid()) and a.is_active))
  and (occasion_id is null or exists (select 1 from public.customer_occasions o where o.id=occasion_id and o.user_id=(select auth.uid()) and o.is_active))
);

drop policy if exists customer_checkout_drafts_delete_own on public.customer_checkout_drafts;
create policy customer_checkout_drafts_delete_own on public.customer_checkout_drafts
for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function private.customer_checkout_health_core(
  p_user uuid,p_items jsonb,p_coupon_code text,p_address_id uuid,p_recipient_id uuid,p_payer_type text,p_is_gift boolean default false
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_quote jsonb; v_profile public.customer_profiles%rowtype; v_address public.customer_addresses%rowtype; v_recipient public.customer_recipients%rowtype;
  v_store jsonb := '{}'::jsonb; v_auth_email text; v_email_confirmed timestamptz; v_failed_payments integer:=0; v_prior_orders integer:=0;
  v_review_above numeric:=0; v_block_after integer:=1; v_require_verified_email boolean:=true; v_risk text:='normal'; v_review boolean:=false;
  v_reasons jsonb:='[]'::jsonb; v_payer text:=coalesce(nullif(p_payer_type,''),'self'); v_address_complete boolean:=false; v_can_submit boolean:=true; v_block_reason text:=null;
begin
  if p_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_profile from public.customer_profiles where id=p_user and account_type='individual';
  if not found then raise exception 'INDIVIDUAL_ACCOUNT_REQUIRED'; end if;
  select * into v_address from public.customer_addresses where id=p_address_id and user_id=p_user and is_active;
  if not found then raise exception 'ADDRESS_REQUIRED'; end if;
  if p_recipient_id is not null then
    select * into v_recipient from public.customer_recipients where id=p_recipient_id and user_id=p_user and is_active;
    if not found then raise exception 'RECIPIENT_INVALID'; end if;
  else
    v_recipient.full_name:=v_profile.full_name; v_recipient.phone:=v_profile.phone; v_recipient.is_self:=true;
  end if;
  if v_payer not in ('self','recipient') then raise exception 'PAYER_INVALID'; end if;
  if v_payer='recipient' and p_recipient_id is null then raise exception 'RECIPIENT_REQUIRED_FOR_PAYER'; end if;

  v_address_complete := coalesce(btrim(v_address.formatted_address),'')<>'' or coalesce(btrim(v_address.short_address),'')<>'' or coalesce(btrim(v_address.street),'')<>'' or (v_address.latitude is not null and v_address.longitude is not null);
  if not v_address_complete then v_can_submit:=false; v_block_reason:='ADDRESS_INCOMPLETE'; end if;
  if v_payer='self' and coalesce(btrim(v_profile.phone),'')='' then v_can_submit:=false; v_block_reason:=coalesce(v_block_reason,'PAYER_PHONE_REQUIRED');
  elsif v_payer='recipient' and coalesce(btrim(v_recipient.phone),'')='' then v_can_submit:=false; v_block_reason:=coalesce(v_block_reason,'PAYER_PHONE_REQUIRED'); end if;

  select coalesce(value,'{}'::jsonb) into v_store from public.system_settings where key='store';
  v_review_above:=greatest(coalesce((v_store->>'codReviewAbove')::numeric,0),0);
  v_block_after:=greatest(coalesce((v_store->>'codBlockAfterFailedPayments')::integer,1),1);
  v_require_verified_email:=coalesce((v_store->>'codRequireVerifiedEmail')::boolean,true);
  select u.email,u.email_confirmed_at into v_auth_email,v_email_confirmed from auth.users u where u.id=p_user;
  if v_require_verified_email and v_email_confirmed is null then v_can_submit:=false; v_block_reason:=coalesce(v_block_reason,'EMAIL_VERIFICATION_REQUIRED'); end if;

  v_quote:=private.preview_customer_cart_impl(p_user,p_items,p_coupon_code);
  if coalesce((v_quote->>'has_quote_items')::boolean,false) then v_can_submit:=false; v_block_reason:=coalesce(v_block_reason,'QUOTE_ITEMS_REQUIRE_REVIEW'); end if;

  select count(*) into v_prior_orders from public.orders o where o.user_id=p_user and o.organization_id is null and o.status<>'cancelled';
  select count(*) into v_failed_payments from public.order_delivery_attempts a join public.orders o on o.id=a.order_id where o.user_id=p_user and o.organization_id is null and a.outcome='payment_refused';
  if v_prior_orders=0 then v_risk:='medium'; v_reasons:=v_reasons||jsonb_build_array('first_order'); end if;
  if v_review_above>0 and coalesce((v_quote->>'total')::numeric,0)>=v_review_above then v_risk:='high'; v_review:=true; v_reasons:=v_reasons||jsonb_build_array('high_value'); end if;
  if v_failed_payments>=v_block_after then
    v_risk:='blocked'; v_review:=true; v_reasons:=v_reasons||jsonb_build_array('prior_payment_refusal');
    v_can_submit:=false; v_block_reason:=coalesce(v_block_reason,'COD_ACCOUNT_REVIEW_REQUIRED');
  end if;
  if v_payer='recipient' then v_reasons:=v_reasons||jsonb_build_array('recipient_payment_confirmation'); end if;
  if p_recipient_id is not null and coalesce(v_recipient.is_self,false)=false and v_payer='self' then
    v_can_submit:=false; v_block_reason:=coalesce(v_block_reason,'GIFT_SENDER_PAYMENT_ARRANGEMENT_REQUIRED');
  end if;

  return v_quote||jsonb_build_object(
    'can_submit',v_can_submit,'block_reason',v_block_reason,'email',v_auth_email,'email_verified',v_email_confirmed is not null,
    'address_complete',v_address_complete,'payer_type',v_payer,
    'payer_name',case when v_payer='recipient' then v_recipient.full_name else v_profile.full_name end,
    'payer_phone',case when v_payer='recipient' then v_recipient.phone else v_profile.phone end,
    'cod_risk_level',v_risk,'cod_review_required',v_review,'cod_risk_reasons',v_reasons,
    'recipient_confirmation_required',v_payer='recipient','delivery_scheduling_available',false,
    'delivery_message_ar','سيتم تأكيد موعد التوصيل من فريق بلقيس بعد مراجعة الطلب.',
    'delivery_message_en','Balqees will confirm the delivery timing after reviewing the order.'
  );
end;
$$;
revoke execute on function private.customer_checkout_health_core(uuid,jsonb,text,uuid,uuid,text,boolean) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.customer_checkout_health_core(uuid,jsonb,text,uuid,uuid,text,boolean) to authenticated;

create or replace function public.customer_checkout_health(p_items jsonb,p_coupon_code text default null,p_address_id uuid default null,p_recipient_id uuid default null,p_payer_type text default 'self',p_is_gift boolean default false)
returns jsonb language sql security invoker set search_path=''
as $$ select private.customer_checkout_health_core(auth.uid(),p_items,p_coupon_code,p_address_id,p_recipient_id,p_payer_type,p_is_gift); $$;
revoke execute on function public.customer_checkout_health(jsonb,text,uuid,uuid,text,boolean) from public,anon;
grant execute on function public.customer_checkout_health(jsonb,text,uuid,uuid,text,boolean) to authenticated;

create or replace function private.customer_checkout_create_order_core(
  p_user uuid,p_items jsonb,p_coupon_code text,p_customer_note text,p_address_id uuid,p_recipient_id uuid,p_is_gift boolean,p_gift_message text,
  p_sender_name_visible boolean,p_payer_type text,p_recipient_knows_payment boolean,p_accept_cod_terms boolean,p_idempotency_key uuid,p_occasion_id uuid default null
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_health jsonb; v_store jsonb:='{}'::jsonb; v_terms text; v_result jsonb; v_order public.orders%rowtype; v_order_id uuid; v_status text; v_review boolean; v_risk text; v_reasons jsonb;
begin
  if p_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_REQUIRED'; end if;
  select * into v_order from public.orders where user_id=p_user and checkout_idempotency_key=p_idempotency_key limit 1;
  if found then
    delete from public.customer_cart_items where user_id=p_user;
    delete from public.customer_checkout_drafts where user_id=p_user;
    return jsonb_build_object('order_id',v_order.id,'order_number',v_order.order_number,'status',v_order.status,'subtotal',v_order.subtotal,
      'discount_total',v_order.discount_total,'vat_total',v_order.vat_total,'total',v_order.total,'payment_method',v_order.payment_method,
      'payment_status',v_order.payment_status,'cod_confirmation_status',v_order.cod_confirmation_status,
      'cod_confirmation_token',case when v_order.payer_type='recipient' then v_order.cod_confirmation_token else null end,
      'cod_review_required',v_order.cod_review_required,'cod_review_status',v_order.cod_review_status,'cod_risk_level',v_order.cod_risk_level,
      'cod_risk_reasons',v_order.cod_risk_reasons,'reused',true);
  end if;
  if not coalesce(p_accept_cod_terms,false) then raise exception 'TERMS_REQUIRED'; end if;
  if coalesce(p_payer_type,'self')='recipient' and not coalesce(p_recipient_knows_payment,false) then raise exception 'RECIPIENT_PAYMENT_AWARENESS_REQUIRED'; end if;

  v_health:=private.customer_checkout_health_core(p_user,p_items,p_coupon_code,p_address_id,p_recipient_id,p_payer_type,p_is_gift);
  if not coalesce((v_health->>'can_submit')::boolean,false) then raise exception '%',coalesce(v_health->>'block_reason','CHECKOUT_BLOCKED'); end if;
  select coalesce(value,'{}'::jsonb) into v_store from public.system_settings where key='store';
  v_terms:=coalesce(nullif(v_store->>'codTermsVersion',''),'cod-v1');
  v_review:=coalesce((v_health->>'cod_review_required')::boolean,false); v_risk:=coalesce(v_health->>'cod_risk_level','normal'); v_reasons:=coalesce(v_health->'cod_risk_reasons','[]'::jsonb);

  v_result:=private.create_individual_order_impl(p_user,p_items,p_coupon_code,p_customer_note,p_address_id,p_recipient_id,null,null,coalesce(p_is_gift,false),p_gift_message,coalesce(p_sender_name_visible,true),coalesce(p_payer_type,'self'),v_terms,p_idempotency_key);
  v_order_id:=(v_result->>'order_id')::uuid;
  update public.orders set cod_risk_level=v_risk,cod_review_required=v_review,cod_review_status=case when v_review then 'pending' else 'not_required' end,
    cod_risk_reasons=v_reasons,status=case when v_review and status='pending' then 'under_review' else status end,last_status_at=now()
  where id=v_order_id and user_id=p_user returning status into v_status;
  if p_occasion_id is not null then update public.customer_occasions set linked_order_id=v_order_id,readiness='preparing',updated_at=now() where id=p_occasion_id and user_id=p_user and is_active; end if;
  delete from public.customer_cart_items where user_id=p_user;
  delete from public.customer_checkout_drafts where user_id=p_user;
  return v_result||jsonb_build_object('status',v_status,'cod_risk_level',v_risk,'cod_review_required',v_review,'cod_review_status',case when v_review then 'pending' else 'not_required' end,'cod_risk_reasons',v_reasons);
end;
$$;
revoke execute on function private.customer_checkout_create_order_core(uuid,jsonb,text,text,uuid,uuid,boolean,text,boolean,text,boolean,boolean,uuid,uuid) from public,anon;
grant execute on function private.customer_checkout_create_order_core(uuid,jsonb,text,text,uuid,uuid,boolean,text,boolean,text,boolean,boolean,uuid,uuid) to authenticated;

create or replace function public.customer_checkout_create_order(
  p_items jsonb,p_coupon_code text default null,p_customer_note text default null,p_address_id uuid default null,p_recipient_id uuid default null,
  p_is_gift boolean default false,p_gift_message text default null,p_sender_name_visible boolean default true,p_payer_type text default 'self',
  p_recipient_knows_payment boolean default false,p_accept_cod_terms boolean default false,p_idempotency_key uuid default null,p_occasion_id uuid default null
) returns jsonb language sql security invoker set search_path=''
as $$ select private.customer_checkout_create_order_core(auth.uid(),p_items,p_coupon_code,p_customer_note,p_address_id,p_recipient_id,p_is_gift,p_gift_message,p_sender_name_visible,p_payer_type,p_recipient_knows_payment,p_accept_cod_terms,p_idempotency_key,p_occasion_id); $$;
revoke execute on function public.customer_checkout_create_order(jsonb,text,text,uuid,uuid,boolean,text,boolean,text,boolean,boolean,uuid,uuid) from public,anon;
grant execute on function public.customer_checkout_create_order(jsonb,text,text,uuid,uuid,boolean,text,boolean,text,boolean,boolean,uuid,uuid) to authenticated;

-- Keep legacy individual order RPC server-only so checkout safeguards cannot be bypassed by a browser client.
revoke execute on function public.create_individual_order(jsonb,text,text,uuid,uuid,date,text,boolean,text,boolean,text,text,uuid) from authenticated,anon,public;
grant execute on function public.create_individual_order(jsonb,text,text,uuid,uuid,date,text,boolean,text,boolean,text,text,uuid) to service_role;

-- Public recipient confirmation uses invoker wrappers; privileged implementation stays private.
create or replace function private.get_cod_confirmation_impl(p_token uuid)
returns jsonb language sql security definer set search_path=''
as $$
  select case when o.id is null then null else jsonb_build_object(
    'order_number',o.order_number,'total',o.total,'vat_total',o.vat_total,'payer_name',o.payer_name,
    'status',o.cod_confirmation_status,'terms_version',o.cod_terms_version,'created_at',o.created_at,'expires_at',o.cod_confirmation_expires_at
  ) end
  from (select * from public.orders where cod_confirmation_token=p_token and payer_type='recipient' limit 1) o;
$$;
revoke execute on function private.get_cod_confirmation_impl(uuid) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.get_cod_confirmation_impl(uuid) to anon,authenticated;

create or replace function public.get_cod_confirmation(p_token uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select private.get_cod_confirmation_impl(p_token); $$;
revoke execute on function public.get_cod_confirmation(uuid) from public;
grant execute on function public.get_cod_confirmation(uuid) to anon,authenticated;

create or replace function private.confirm_cod_responsibility_impl(p_token uuid,p_phone_last4 text,p_accept boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare o public.orders%rowtype; v_last4 text:=regexp_replace(coalesce(p_phone_last4,''),'\\D','','g');
begin
  if not coalesce(p_accept,false) then raise exception 'TERMS_REQUIRED'; end if;
  if length(v_last4)<>4 then raise exception 'PHONE_MISMATCH'; end if;
  select * into o from public.orders where cod_confirmation_token=p_token and payer_type='recipient' limit 1;
  if not found then raise exception 'INVALID_CONFIRMATION'; end if;
  if o.cod_confirmation_expires_at is not null and o.cod_confirmation_expires_at < now() then
    update public.orders set cod_confirmation_status='expired',last_status_at=now() where id=o.id and cod_confirmation_status='recipient_confirmation_required';
    raise exception 'CONFIRMATION_EXPIRED';
  end if;
  if right(coalesce(o.payer_phone,''),4)<>v_last4 then raise exception 'PHONE_MISMATCH'; end if;
  if o.cod_confirmation_status='recipient_confirmed' then return jsonb_build_object('confirmed',true,'already_confirmed',true,'order_number',o.order_number); end if;
  if o.cod_confirmation_status not in ('recipient_confirmation_required','recipient_confirmed') then raise exception 'CONFIRMATION_NOT_AVAILABLE'; end if;
  update public.orders set cod_confirmation_status='recipient_confirmed',cod_accepted_at=now(),last_status_at=now() where id=o.id;
  insert into public.order_events(order_id,event_type,title_ar,title_en,body_ar,body_en,actor_type,metadata)
  values(o.id,'cod_recipient_confirmed','تم تأكيد مسؤولية السداد','Payment responsibility confirmed','أكد المستلم مسؤوليته عن سداد قيمة الطلب عند الاستلام.','The recipient confirmed responsibility for payment on delivery.','customer',jsonb_build_object('method','secure_link','terms_version',o.cod_terms_version));
  return jsonb_build_object('confirmed',true,'already_confirmed',false,'order_number',o.order_number);
end;
$$;
revoke execute on function private.confirm_cod_responsibility_impl(uuid,text,boolean) from public;
grant execute on function private.confirm_cod_responsibility_impl(uuid,text,boolean) to anon,authenticated;

create or replace function public.confirm_cod_responsibility(p_token uuid,p_phone_last4 text,p_accept boolean)
returns jsonb language sql security invoker set search_path=''
as $$ select private.confirm_cod_responsibility_impl(p_token,p_phone_last4,p_accept); $$;
revoke execute on function public.confirm_cod_responsibility(uuid,text,boolean) from public;
grant execute on function public.confirm_cod_responsibility(uuid,text,boolean) to anon,authenticated;
