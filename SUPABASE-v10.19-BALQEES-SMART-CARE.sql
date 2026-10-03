-- Balqees Floral v10.19 — Individual Smart Care
-- Adds safe customer conversation lifecycle, server-computed priority,
-- read state, admin-reply notifications and tighter support RLS.

alter table public.support_conversations
  add column if not exists resolved_at timestamptz,
  add column if not exists customer_last_read_at timestamptz;

create index if not exists support_conversations_user_status_last_idx
  on public.support_conversations (user_id, status, last_message_at desc);

-- A signed-in customer may create a legacy/direct conversation only with safe defaults.
-- Smart Care itself uses customer_open_support_case(), where priority is server-computed.
drop policy if exists support_conversations_create_own on public.support_conversations;
create policy support_conversations_create_own
on public.support_conversations
for insert
to authenticated
with check (
  private.is_balqees_admin()
  or (
    user_id = (select auth.uid())
    and status = 'open'
    and requires_human = true
    and resolution_source is null
    and resolved_at is null
    and coalesce((
      select ((s.value ->> 'signedInTickets'))::boolean
      from public.system_settings s
      where s.key = 'support'
    ), true)
    and (
      (
        support_conversations.organization_id is null
        and priority = 'normal'
      )
      or (
        support_conversations.organization_id is not null
        and private.is_org_member(support_conversations.organization_id)
        and priority = 'normal'
      )
    )
    and (
      support_conversations.order_id is null
      or exists (
        select 1
        from public.orders o
        where o.id = support_conversations.order_id
          and (
            o.user_id = (select auth.uid())
            or (
              support_conversations.organization_id is not null
              and o.organization_id = support_conversations.organization_id
              and private.is_org_member(support_conversations.organization_id)
            )
          )
      )
    )
  )
);

-- Customers can only insert messages as themselves; admins can only insert as admin.
drop policy if exists support_messages_insert_own_or_admin on public.support_messages;
create policy support_messages_insert_own_or_admin
on public.support_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and (
    (
      sender_role = 'admin'
      and private.is_balqees_admin()
    )
    or (
      sender_role = 'user'
      and exists (
        select 1
        from public.support_conversations c
        where c.id = support_messages.conversation_id
          and (
            c.user_id = (select auth.uid())
            or (
              c.organization_id is not null
              and private.is_org_member(c.organization_id)
            )
          )
          and coalesce((
            select ((s.value ->> 'signedInTickets'))::boolean
            from public.system_settings s
            where s.key = 'support'
          ), true)
      )
    )
  )
);

create or replace function private.customer_open_support_case_core(
  p_order_id uuid default null,
  p_category text default 'general',
  p_subject text default null,
  p_automation_attempts jsonb default '[]'::jsonb,
  p_context_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_conversation public.support_conversations%rowtype;
  v_category text := coalesce(nullif(btrim(p_category), ''), 'general');
  v_subject text := coalesce(nullif(btrim(p_subject), ''), 'Balqees Care');
  v_priority text := 'normal';
  v_today date := (now() at time zone 'Asia/Riyadh')::date;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(v_category) > 80 then raise exception 'CATEGORY_TOO_LONG'; end if;
  if char_length(v_subject) > 180 then raise exception 'SUBJECT_TOO_LONG'; end if;

  if p_order_id is not null then
    select * into v_order
    from public.orders
    where id = p_order_id and user_id = v_uid;
    if not found then raise exception 'ORDER_NOT_FOUND'; end if;

    if v_category in ('delivery_not_received','urgent_change','address_problem','change_address','change_recipient_phone')
       and (v_order.requested_delivery_date is not null and v_order.requested_delivery_date <= v_today
            or v_order.status = 'out_for_delivery') then
      v_priority := 'urgent';
    elsif v_category in ('delivery_not_received','urgent_change','product_issue','cancel_request','product_change') then
      v_priority := 'high';
    end if;

    select * into v_conversation
    from public.support_conversations
    where user_id = v_uid
      and order_id = p_order_id
      and coalesce(category,'general') = v_category
    order by updated_at desc
    limit 1;
  else
    select * into v_conversation
    from public.support_conversations
    where user_id = v_uid
      and order_id is null
      and coalesce(category,'general') = v_category
      and status <> 'closed'
    order by updated_at desc
    limit 1;
  end if;

  if found then
    update public.support_conversations
    set status = 'open',
        priority = v_priority,
        requires_human = true,
        resolution_source = null,
        resolved_at = null,
        subject = v_subject,
        automation_attempts = case
          when jsonb_typeof(coalesce(p_automation_attempts,'[]'::jsonb)) = 'array'
            then coalesce(automation_attempts,'[]'::jsonb) || coalesce(p_automation_attempts,'[]'::jsonb)
          else coalesce(automation_attempts,'[]'::jsonb)
        end,
        context_snapshot = coalesce(context_snapshot,'{}'::jsonb) || coalesce(p_context_snapshot,'{}'::jsonb),
        updated_at = now()
    where id = v_conversation.id
    returning * into v_conversation;
  else
    insert into public.support_conversations(
      user_id, subject, status, priority, order_id, category,
      automation_attempts, requires_human, context_snapshot
    ) values (
      v_uid, v_subject, 'open', v_priority, p_order_id, v_category,
      case when jsonb_typeof(coalesce(p_automation_attempts,'[]'::jsonb))='array' then coalesce(p_automation_attempts,'[]'::jsonb) else '[]'::jsonb end,
      true, coalesce(p_context_snapshot,'{}'::jsonb)
    ) returning * into v_conversation;
  end if;

  return jsonb_build_object(
    'id', v_conversation.id,
    'status', v_conversation.status,
    'priority', v_conversation.priority,
    'order_id', v_conversation.order_id,
    'category', v_conversation.category,
    'subject', v_conversation.subject
  );
end;
$$;
revoke execute on function private.customer_open_support_case_core(uuid,text,text,jsonb,jsonb) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.customer_open_support_case_core(uuid,text,text,jsonb,jsonb) to authenticated;

create or replace function public.customer_open_support_case(
  p_order_id uuid default null,
  p_category text default 'general',
  p_subject text default null,
  p_automation_attempts jsonb default '[]'::jsonb,
  p_context_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.customer_open_support_case_core(
    p_order_id,p_category,p_subject,p_automation_attempts,p_context_snapshot
  );
$$;
revoke execute on function public.customer_open_support_case(uuid,text,text,jsonb,jsonb) from public, anon;
grant execute on function public.customer_open_support_case(uuid,text,text,jsonb,jsonb) to authenticated;

create or replace function private.customer_close_support_core(p_conversation_id uuid)
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
  set status='closed', requires_human=false, resolution_source='customer', resolved_at=now(), updated_at=now()
  where id=p_conversation_id and user_id=v_uid;
  if not found then raise exception 'CONVERSATION_NOT_FOUND'; end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke execute on function private.customer_close_support_core(uuid) from public, anon;
grant execute on function private.customer_close_support_core(uuid) to authenticated;

create or replace function public.customer_close_support(p_conversation_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.customer_close_support_core(p_conversation_id); $$;
revoke execute on function public.customer_close_support(uuid) from public, anon;
grant execute on function public.customer_close_support(uuid) to authenticated;

create or replace function private.customer_mark_support_read_core(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.support_conversations
    where id=p_conversation_id and user_id=v_uid
  ) then raise exception 'CONVERSATION_NOT_FOUND'; end if;

  update public.support_messages
  set read_at=coalesce(read_at,now())
  where conversation_id=p_conversation_id and sender_role='admin' and read_at is null;
  get diagnostics v_count = row_count;

  update public.support_conversations
  set customer_last_read_at=now()
  where id=p_conversation_id and user_id=v_uid;

  return jsonb_build_object('ok',true,'marked',v_count);
end;
$$;
revoke execute on function private.customer_mark_support_read_core(uuid) from public, anon;
grant execute on function private.customer_mark_support_read_core(uuid) to authenticated;

create or replace function public.customer_mark_support_read(p_conversation_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.customer_mark_support_read_core(p_conversation_id); $$;
revoke execute on function public.customer_mark_support_read(uuid) from public, anon;
grant execute on function public.customer_mark_support_read(uuid) to authenticated;

create or replace function private.touch_support_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.support_conversations%rowtype;
begin
  select * into v_conv from public.support_conversations where id=new.conversation_id;

  update public.support_conversations
  set last_message_at=new.created_at,
      updated_at=new.created_at,
      status=case when new.sender_role='admin' then 'pending' when new.sender_role='user' then 'open' else status end,
      requires_human=case when new.sender_role='admin' then false when new.sender_role='user' then true else requires_human end,
      resolution_source=case when new.sender_role in ('admin','user') then null else resolution_source end,
      resolved_at=case when new.sender_role in ('admin','user') then null else resolved_at end
  where id=new.conversation_id;

  if new.sender_role='admin' and v_conv.user_id is not null then
    insert into public.notifications(
      title_ar,title_en,body_ar,body_en,type,audience,user_id,status,published_at,
      category,priority,action_url,action_label_ar,action_label_en,metadata
    ) values (
      'لديك رد جديد من فريق بلقيس','You have a new reply from Balqees Care',
      coalesce(nullif(v_conv.subject,''),'تم تحديث محادثتك مع فريق بلقيس.'),
      coalesce(nullif(v_conv.subject,''),'Your conversation with Balqees Care has been updated.'),
      'info','user',v_conv.user_id,'published',now(),'support',
      case when v_conv.priority in ('urgent','high') then 'high' else 'normal' end,
      '/account/support?conversation='||new.conversation_id::text,
      'عرض الرد','View reply',
      jsonb_build_object('conversation_id',new.conversation_id,'message_id',new.id,'order_id',v_conv.order_id)
    );
  end if;
  return new;
end;
$$;
revoke execute on function private.touch_support_conversation_from_message() from public, anon, authenticated;

drop trigger if exists support_message_touch_conversation on public.support_messages;
create trigger support_message_touch_conversation
after insert on public.support_messages
for each row execute function private.touch_support_conversation_from_message();

do $$
begin
  if to_regprocedure('public.touch_support_conversation_from_message()') is not null then
    execute 'revoke execute on function public.touch_support_conversation_from_message() from public, anon, authenticated';
  end if;
end $$;

create or replace function private.normalize_support_conversation_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    new.resolved_at := coalesce(new.resolved_at, now());
    if new.resolution_source is null then
      new.resolution_source := case when private.is_balqees_admin() then 'admin' else 'system' end;
    end if;
  elsif new.status in ('open','pending') and old.status = 'closed' then
    new.resolved_at := null;
    new.resolution_source := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.normalize_support_conversation_status() from public, anon, authenticated;

drop trigger if exists normalize_support_conversation_status on public.support_conversations;
create trigger normalize_support_conversation_status
before update of status on public.support_conversations
for each row execute function private.normalize_support_conversation_status();
