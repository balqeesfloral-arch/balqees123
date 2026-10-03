-- Balqees Floral v10.14
-- Safe self-service edits for individual customer orders.
-- Applied to the connected balqees-floral Supabase project on 2026-09-30.

create schema if not exists private;

alter table public.orders add column if not exists customer_label text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_customer_label_length_check') then
    alter table public.orders add constraint orders_customer_label_length_check check (customer_label is null or char_length(customer_label) <= 80);
  end if;
end $$;

create or replace function private.customer_update_order_safe_core(
  p_order_id uuid,
  p_action text,
  p_address_id uuid default null,
  p_recipient_id uuid default null,
  p_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_address public.customer_addresses%rowtype;
  v_recipient public.customer_recipients%rowtype;
  v_title_ar text;
  v_title_en text;
  v_body_ar text;
  v_body_en text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_order
  from public.orders
  where id = p_order_id and user_id = v_uid
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status not in ('pending','under_review','quoted','approved') then raise exception 'ORDER_LOCKED'; end if;

  case p_action
    when 'address' then
      if p_address_id is null then raise exception 'ADDRESS_REQUIRED'; end if;
      select * into v_address from public.customer_addresses
      where id = p_address_id and user_id = v_uid and is_active = true;
      if not found then raise exception 'ADDRESS_NOT_FOUND'; end if;
      update public.orders
      set customer_address_id = v_address.id,
          address_snapshot = jsonb_build_object(
            'id', v_address.id, 'label', v_address.label, 'city', v_address.city,
            'district', v_address.district, 'street', v_address.street,
            'building_number', v_address.building_number, 'unit_number', v_address.unit_number,
            'postal_code', v_address.postal_code, 'short_address', v_address.short_address,
            'formatted_address', v_address.formatted_address, 'latitude', v_address.latitude,
            'longitude', v_address.longitude, 'maps_url', v_address.maps_url,
            'access_notes', v_address.access_notes
          ),
          service_address = jsonb_build_object(
            'label', v_address.label, 'city', v_address.city, 'district', v_address.district,
            'street', v_address.street, 'building_number', v_address.building_number,
            'unit_number', v_address.unit_number, 'postal_code', v_address.postal_code,
            'short_address', v_address.short_address, 'formatted_address', v_address.formatted_address,
            'latitude', v_address.latitude, 'longitude', v_address.longitude,
            'maps_url', v_address.maps_url, 'access_notes', v_address.access_notes
          ),
          updated_at = now()
      where id = p_order_id;
      v_title_ar := 'تم تحديث عنوان التسليم'; v_title_en := 'Delivery address updated';
      v_body_ar := 'حدّث العميل عنوان التسليم قبل بدء التنفيذ.'; v_body_en := 'The customer updated the delivery address before fulfillment started.';

    when 'recipient' then
      if p_recipient_id is null then raise exception 'RECIPIENT_REQUIRED'; end if;
      select * into v_recipient from public.customer_recipients
      where id = p_recipient_id and user_id = v_uid;
      if not found then raise exception 'RECIPIENT_NOT_FOUND'; end if;
      update public.orders
      set customer_recipient_id = v_recipient.id,
          recipient_snapshot = jsonb_build_object(
            'id', v_recipient.id, 'label', v_recipient.label,
            'full_name', v_recipient.full_name, 'phone', v_recipient.phone,
            'default_address_id', v_recipient.default_address_id, 'is_self', v_recipient.is_self
          ),
          updated_at = now()
      where id = p_order_id;
      v_title_ar := 'تم تحديث المستلم'; v_title_en := 'Recipient updated';
      v_body_ar := 'حدّث العميل بيانات المستلم المحفوظة للطلب.'; v_body_en := 'The customer updated the saved recipient for this order.';

    when 'recipient_phone' then
      if nullif(trim(p_text), '') is null or char_length(trim(p_text)) > 30 then raise exception 'INVALID_PHONE'; end if;
      update public.orders
      set recipient_snapshot = jsonb_set(coalesce(recipient_snapshot, '{}'::jsonb), '{phone}', to_jsonb(trim(p_text)), true),
          updated_at = now()
      where id = p_order_id;
      v_title_ar := 'تم تحديث رقم تواصل المستلم'; v_title_en := 'Recipient contact updated';
      v_body_ar := 'حدّث العميل رقم التواصل الخاص بالمستلم لهذا الطلب.'; v_body_en := 'The customer updated the recipient contact number for this order.';

    when 'gift_message' then
      update public.orders set gift_message = nullif(trim(p_text), ''), updated_at = now() where id = p_order_id;
      v_title_ar := 'تم تحديث رسالة الإهداء'; v_title_en := 'Gift message updated';
      v_body_ar := 'حدّث العميل رسالة الإهداء قبل بدء التنفيذ.'; v_body_en := 'The customer updated the gift message before fulfillment started.';

    when 'customer_note' then
      update public.orders set customer_note = nullif(trim(p_text), ''), updated_at = now() where id = p_order_id;
      v_title_ar := 'تم تحديث ملاحظة العميل'; v_title_en := 'Customer note updated';
      v_body_ar := 'حدّث العميل ملاحظته على الطلب قبل بدء التنفيذ.'; v_body_en := 'The customer updated the order note before fulfillment started.';

    when 'label' then
      if p_text is not null and char_length(trim(p_text)) > 80 then raise exception 'LABEL_TOO_LONG'; end if;
      update public.orders set customer_label = nullif(trim(p_text), ''), updated_at = now() where id = p_order_id;
      v_title_ar := 'تم تحديث اسم الطلب'; v_title_en := 'Order label updated';
      v_body_ar := 'سمّى العميل الطلب ليسهل التعرف عليه داخل حسابه.'; v_body_en := 'The customer labeled the order for easier recognition in their account.';

    when 'confirm_details' then
      if exists (select 1 from public.order_events where order_id = p_order_id and event_type = 'customer_details_confirmed') then
        return jsonb_build_object('ok', true, 'already_confirmed', true);
      end if;
      v_title_ar := 'أكد العميل صحة تفاصيل الطلب'; v_title_en := 'Customer confirmed order details';
      v_body_ar := 'راجع العميل المستلم والعنوان وبيانات الطلب وأكد صحتها قبل التجهيز.';
      v_body_en := 'The customer reviewed the recipient, address and order details and confirmed them before preparation.';

    else raise exception 'INVALID_ACTION';
  end case;

  insert into public.order_events(order_id,event_type,title_ar,title_en,body_ar,body_en,actor_type,actor_id,metadata)
  values (p_order_id, case p_action when 'confirm_details' then 'customer_details_confirmed' else 'customer_updated_' || p_action end,
          v_title_ar,v_title_en,v_body_ar,v_body_en,'customer',v_uid,jsonb_build_object('source','individual_account'));

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function private.customer_update_order_safe_core(uuid,text,uuid,uuid,text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.customer_update_order_safe_core(uuid,text,uuid,uuid,text) to authenticated;

create or replace function public.customer_update_order_safe(
  p_order_id uuid,
  p_action text,
  p_address_id uuid default null,
  p_recipient_id uuid default null,
  p_text text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.customer_update_order_safe_core(p_order_id,p_action,p_address_id,p_recipient_id,p_text);
$$;

revoke execute on function public.customer_update_order_safe(uuid,text,uuid,uuid,text) from public, anon;
grant execute on function public.customer_update_order_safe(uuid,text,uuid,uuid,text) to authenticated;

-- Reopen an existing support conversation owned by the signed-in customer.
create or replace function private.customer_reopen_support_core(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.support_conversations
     set status = 'open', requires_human = true, updated_at = now()
   where id = p_conversation_id and user_id = v_uid;
  if not found then raise exception 'CONVERSATION_NOT_FOUND'; end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function private.customer_reopen_support_core(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.customer_reopen_support_core(uuid) to authenticated;

create or replace function public.customer_reopen_support(p_conversation_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.customer_reopen_support_core(p_conversation_id); $$;
revoke execute on function public.customer_reopen_support(uuid) from public, anon;
grant execute on function public.customer_reopen_support(uuid) to authenticated;

create index if not exists support_conversations_user_order_category_updated_idx
on public.support_conversations (user_id, order_id, category, updated_at desc)
where order_id is not null;

-- Personal order label can be changed at any lifecycle stage because it does not affect fulfillment.
create or replace function private.customer_set_order_label_core(p_order_id uuid, p_label text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_label is not null and char_length(trim(p_label)) > 80 then raise exception 'LABEL_TOO_LONG'; end if;
  update public.orders set customer_label = nullif(trim(p_label), ''), updated_at = now()
  where id = p_order_id and user_id = v_uid;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  insert into public.order_events(order_id,event_type,title_ar,title_en,body_ar,body_en,actor_type,actor_id,metadata)
  values (p_order_id,'customer_updated_label','تم تحديث اسم الطلب','Order label updated','سمّى العميل الطلب ليسهل التعرف عليه داخل حسابه.','The customer labeled the order for easier recognition in their account.','customer',v_uid,jsonb_build_object('source','individual_account'));
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function private.customer_set_order_label_core(uuid,text) from public, anon;
grant execute on function private.customer_set_order_label_core(uuid,text) to authenticated;

create or replace function public.customer_set_order_label(p_order_id uuid, p_label text default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.customer_set_order_label_core(p_order_id,p_label); $$;
revoke execute on function public.customer_set_order_label(uuid,text) from public, anon;
grant execute on function public.customer_set_order_label(uuid,text) to authenticated;
