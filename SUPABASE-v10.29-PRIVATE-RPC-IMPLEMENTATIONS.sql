-- Balqees Floral v10.29
-- Keep privileged implementations outside the exposed public schema.

create or replace function private.record_cod_delivery_attempt_impl(
  p_order_id uuid,
  p_outcome text,
  p_note text default null,
  p_amount_collected numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 o public.orders%rowtype;
 a public.order_delivery_attempts%rowtype;
begin
 if not private.is_balqees_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 select * into o from public.orders where id=p_order_id;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;

 insert into public.order_delivery_attempts(order_id,outcome,note,amount_collected,created_by)
 values(o.id,p_outcome,nullif(btrim(coalesce(p_note,'')),''),p_amount_collected,auth.uid())
 returning * into a;

 if p_outcome='paid_and_delivered' then
   update public.orders set payment_status='paid',status='delivered' where id=o.id;
 elsif p_outcome='payment_refused' then
   update public.orders set payment_status='failed',status='delivery_failed_payment' where id=o.id;
 end if;

 insert into public.order_events(order_id,event_type,title_ar,title_en,body_ar,body_en,actor_type,actor_id,metadata)
 values(
   o.id,'delivery_attempt',
   case p_outcome when 'paid_and_delivered' then 'تم التحصيل والتسليم' when 'payment_refused' then 'رفض السداد عند التسليم' when 'no_answer' then 'تعذر التواصل' when 'address_issue' then 'مشكلة في العنوان' else 'محاولة تسليم' end,
   case p_outcome when 'paid_and_delivered' then 'Payment collected and delivered' when 'payment_refused' then 'Payment refused on delivery' when 'no_answer' then 'Unable to contact' when 'address_issue' then 'Address issue' else 'Delivery attempt' end,
   nullif(btrim(coalesce(p_note,'')),''),null,'admin',auth.uid(),
   jsonb_build_object('outcome',p_outcome,'amount_collected',p_amount_collected,'attempt_id',a.id)
 );

 return jsonb_build_object('id',a.id,'order_id',o.id,'outcome',a.outcome,'created_at',a.created_at);
end
$$;

revoke execute on function private.record_cod_delivery_attempt_impl(uuid,text,text,numeric) from public, anon;
grant execute on function private.record_cod_delivery_attempt_impl(uuid,text,text,numeric) to authenticated;

create or replace function public.record_cod_delivery_attempt(
  p_order_id uuid,
  p_outcome text,
  p_note text default null,
  p_amount_collected numeric default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.record_cod_delivery_attempt_impl(p_order_id,p_outcome,p_note,p_amount_collected); $$;

revoke execute on function public.record_cod_delivery_attempt(uuid,text,text,numeric) from public, anon;
grant execute on function public.record_cod_delivery_attempt(uuid,text,text,numeric) to authenticated;

create or replace function private.update_my_order_delivery_impl(
  p_order_id uuid,
  p_address_id uuid default null,
  p_recipient_id uuid default null,
  p_gift_message text default null,
  p_sender_name_visible boolean default null,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 o public.orders%rowtype;
 a public.customer_addresses%rowtype;
 r public.customer_recipients%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into o from public.orders where id=p_order_id and user_id=auth.uid();
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if o.status not in ('pending','under_review') then raise exception 'ORDER_EDIT_LOCKED'; end if;

 if p_recipient_id is not null
    and o.payer_type='recipient'
    and o.customer_recipient_id is distinct from p_recipient_id then
   raise exception 'PAYER_RECIPIENT_LOCKED';
 end if;

 if p_address_id is not null then
   select * into a from public.customer_addresses where id=p_address_id and user_id=auth.uid() and is_active;
   if not found then raise exception 'ADDRESS_INVALID'; end if;
   update public.orders
   set customer_address_id=a.id,
       service_address=to_jsonb(a)-'user_id'-'created_at'-'updated_at',
       address_snapshot=to_jsonb(a)-'user_id'-'created_at'-'updated_at'
   where id=o.id;
 end if;

 if p_recipient_id is not null then
   select * into r from public.customer_recipients where id=p_recipient_id and user_id=auth.uid();
   if not found then raise exception 'RECIPIENT_INVALID'; end if;
   update public.orders
   set customer_recipient_id=r.id,
       recipient_snapshot=jsonb_build_object('id',r.id,'label',r.label,'full_name',r.full_name,'phone',r.phone,'is_self',r.is_self)
   where id=o.id;
 end if;

 update public.orders
 set gift_message=coalesce(p_gift_message,gift_message),
     sender_name_visible=coalesce(p_sender_name_visible,sender_name_visible),
     customer_note=coalesce(p_customer_note,customer_note)
 where id=o.id
 returning * into o;

 insert into public.order_events(order_id,event_type,title_ar,title_en,body_ar,body_en,actor_type,actor_id,metadata)
 values(o.id,'customer_delivery_update','تم تحديث بيانات الاستلام','Delivery details updated',
 'عدّل العميل بيانات مسموحة قبل بدء التجهيز.','The customer updated allowed details before preparation started.',
 'customer',auth.uid(),jsonb_build_object('address_id',p_address_id,'recipient_id',p_recipient_id));

 return jsonb_build_object('updated',true,'order_id',o.id,'status',o.status);
end
$$;

revoke execute on function private.update_my_order_delivery_impl(uuid,uuid,uuid,text,boolean,text) from public, anon;
grant execute on function private.update_my_order_delivery_impl(uuid,uuid,uuid,text,boolean,text) to authenticated;

create or replace function public.update_my_order_delivery(
  p_order_id uuid,
  p_address_id uuid default null,
  p_recipient_id uuid default null,
  p_gift_message text default null,
  p_sender_name_visible boolean default null,
  p_customer_note text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.update_my_order_delivery_impl(p_order_id,p_address_id,p_recipient_id,p_gift_message,p_sender_name_visible,p_customer_note); $$;

revoke execute on function public.update_my_order_delivery(uuid,uuid,uuid,text,boolean,text) from public, anon;
grant execute on function public.update_my_order_delivery(uuid,uuid,uuid,text,boolean,text) to authenticated;
