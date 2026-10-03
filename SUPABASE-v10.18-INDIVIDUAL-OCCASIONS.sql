-- Balqees Floral v10.18 — Individual occasions
-- This file mirrors the live Supabase changes applied for /account/occasions.

alter table public.customer_occasions
  add column if not exists recipient_role text,
  add column if not exists custom_recipient_name text,
  add column if not exists budget_band text,
  add column if not exists gift_preference text,
  add column if not exists allow_budget_overrun boolean not null default false,
  add column if not exists reminder_channels text[] not null default '{}'::text[],
  add column if not exists readiness text not null default 'not_started',
  add column if not exists party_type text,
  add column if not exists guest_count integer,
  add column if not exists venue text,
  add column if not exists linked_order_id uuid references public.orders(id) on delete set null,
  add column if not exists assistant_context jsonb not null default '{}'::jsonb,
  add column if not exists usual_gift_type text;

alter table public.customer_occasions
  alter column reminder_days set default '{}'::integer[],
  alter column reminder_days set not null,
  alter column reminder_channels set default '{}'::text[],
  alter column reminder_channels set not null;


do $$
begin
  if not exists (select 1 from pg_constraint where conname='customer_occasions_budget_band_check') then
    alter table public.customer_occasions add constraint customer_occasions_budget_band_check check (budget_band is null or budget_band = any(array['under_150','150_300','300_500','500_plus','unspecified']));
  end if;
  if not exists (select 1 from pg_constraint where conname='customer_occasions_gift_preference_check') then
    alter table public.customer_occasions add constraint customer_occasions_gift_preference_check check (gift_preference is null or gift_preference = any(array['bouquet','gift','bouquet_gift','surprise']));
  end if;
  if not exists (select 1 from pg_constraint where conname='customer_occasions_readiness_check') then
    alter table public.customer_occasions add constraint customer_occasions_readiness_check check (readiness = any(array['not_started','preparing','ready']));
  end if;
  if not exists (select 1 from pg_constraint where conname='customer_occasions_guest_count_check') then
    alter table public.customer_occasions add constraint customer_occasions_guest_count_check check (guest_count is null or guest_count > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='customer_occasions_usual_gift_type_check') then
    alter table public.customer_occasions add constraint customer_occasions_usual_gift_type_check check (usual_gift_type is null or usual_gift_type = any(array['visit','thanks','hospitality','other']));
  end if;
  if not exists (select 1 from pg_constraint where conname='customer_occasions_recipient_role_check') then
    alter table public.customer_occasions add constraint customer_occasions_recipient_role_check check (recipient_role is null or recipient_role = any(array['bride','groom','couple','family','other']));
  end if;
  if not exists (select 1 from pg_constraint where conname='customer_occasions_reminder_days_check') then
    alter table public.customer_occasions add constraint customer_occasions_reminder_days_check check (reminder_days <@ array[3,7,14]);
  end if;
  if not exists (select 1 from pg_constraint where conname='customer_occasions_reminder_channels_check') then
    alter table public.customer_occasions add constraint customer_occasions_reminder_channels_check check (reminder_channels <@ array['in_app']::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conname='customer_occasions_custom_recipient_name_length_check') then
    alter table public.customer_occasions add constraint customer_occasions_custom_recipient_name_length_check check (custom_recipient_name is null or char_length(custom_recipient_name) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname='customer_occasions_recipient_role_length_check') then
    alter table public.customer_occasions add constraint customer_occasions_recipient_role_length_check check (recipient_role is null or char_length(recipient_role) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname='customer_occasions_party_type_length_check') then
    alter table public.customer_occasions add constraint customer_occasions_party_type_length_check check (party_type is null or char_length(party_type) <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='customer_occasions_venue_length_check') then
    alter table public.customer_occasions add constraint customer_occasions_venue_length_check check (venue is null or char_length(venue) <= 240);
  end if;
  if not exists (select 1 from pg_constraint where conname='customer_occasions_note_length_check') then
    alter table public.customer_occasions add constraint customer_occasions_note_length_check check (note is null or char_length(note) <= 500);
  end if;
end $$;

create index if not exists customer_occasions_user_active_date_idx on public.customer_occasions (user_id, is_active, occasion_date);
create index if not exists customer_occasions_recipient_idx on public.customer_occasions (recipient_id) where recipient_id is not null;
create index if not exists customer_occasions_linked_order_idx on public.customer_occasions (linked_order_id) where linked_order_id is not null;

drop policy if exists customer_occasions_select_own on public.customer_occasions;
create policy customer_occasions_select_own on public.customer_occasions for select to authenticated using ((select auth.uid()) = user_id or private.is_balqees_admin());

drop policy if exists customer_occasions_insert_own on public.customer_occasions;
create policy customer_occasions_insert_own on public.customer_occasions for insert to authenticated with check (
  private.is_balqees_admin() or (
    (select auth.uid()) = user_id
    and (recipient_id is null or exists (select 1 from public.customer_recipients r where r.id=recipient_id and r.user_id=(select auth.uid()) and r.is_active))
    and (linked_order_id is null or exists (select 1 from public.orders o where o.id=linked_order_id and o.user_id=(select auth.uid())))
  )
);

drop policy if exists customer_occasions_update_own on public.customer_occasions;
create policy customer_occasions_update_own on public.customer_occasions for update to authenticated
using ((select auth.uid()) = user_id or private.is_balqees_admin())
with check (
  private.is_balqees_admin() or (
    (select auth.uid()) = user_id
    and (recipient_id is null or exists (select 1 from public.customer_recipients r where r.id=recipient_id and r.user_id=(select auth.uid()) and r.is_active))
    and (linked_order_id is null or exists (select 1 from public.orders o where o.id=linked_order_id and o.user_id=(select auth.uid())))
  )
);

drop policy if exists customer_occasions_delete_own on public.customer_occasions;
create policy customer_occasions_delete_own on public.customer_occasions for delete to authenticated using ((select auth.uid()) = user_id or private.is_balqees_admin());

create or replace function private.customer_sync_occasion_reminders_core()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := auth.uid(); v_today date := (now() at time zone 'Asia/Riyadh')::date;
  v_occ record; v_days int; v_created int := 0; v_title text; v_body text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  for v_occ in
    select o.id,o.occasion_type,o.occasion_date,o.reminder_days,coalesce(r.label,r.full_name,o.custom_recipient_name) recipient_name
    from public.customer_occasions o left join public.customer_recipients r on r.id=o.recipient_id
    where o.user_id=v_user and o.is_active and o.occasion_date is not null and o.occasion_date>=v_today and 'in_app'=any(o.reminder_channels)
  loop
    foreach v_days in array coalesce(v_occ.reminder_days,'{}'::int[]) loop
      if v_occ.occasion_date-v_today=v_days and not exists (
        select 1 from public.notifications n where n.user_id=v_user and n.category='occasion' and n.metadata->>'occasion_id'=v_occ.id::text and n.metadata->>'reminder_days'=v_days::text
      ) then
        v_title := case v_occ.occasion_type when 'wedding' then 'مناسبة زواج قريبة' when 'malka' then 'مناسبة مَلْكة قريبة' when 'engagement' then 'مناسبة خطبة قريبة' when 'return_from_travel' then 'موعد قدوم من سفر قريب' when 'new_baby' then 'مناسبة مولود جديدة قريبة' when 'graduation' then 'مناسبة تخرج قريبة' when 'party' then 'حفلة قريبة' else 'مناسبة محفوظة قريبة' end;
        v_body := case when v_days=0 then 'المناسبة اليوم. راجع تجهيزك قبل الطلب.' when v_occ.recipient_name is not null then 'باقي '||v_days||' يومًا على المناسبة لـ '||v_occ.recipient_name||'.' else 'باقي '||v_days||' يومًا على المناسبة المحفوظة.' end;
        insert into public.notifications(title_ar,title_en,body_ar,body_en,type,audience,user_id,status,published_at,category,priority,action_url,action_label_ar,action_label_en,metadata)
        values(v_title,'Upcoming occasion',v_body,'You have an upcoming saved occasion.','info','user',v_user,'published',now(),'occasion','normal','/account/occasions','استعد الآن','Prepare now',jsonb_build_object('occasion_id',v_occ.id,'reminder_days',v_days));
        v_created:=v_created+1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('created',v_created);
end $$;
revoke execute on function private.customer_sync_occasion_reminders_core() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.customer_sync_occasion_reminders_core() to authenticated;

create or replace function public.customer_sync_occasion_reminders()
returns jsonb language sql security invoker set search_path='' as $$ select private.customer_sync_occasion_reminders_core(); $$;
revoke execute on function public.customer_sync_occasion_reminders() from public,anon;
grant execute on function public.customer_sync_occasion_reminders() to authenticated;

create or replace function private.normalize_customer_occasion_readiness()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_status text;
begin
  if new.linked_order_id is not null then
    select status into v_status from public.orders where id=new.linked_order_id and user_id=new.user_id;
    if v_status in ('delivered','completed') then new.readiness:='ready';
    elsif v_status in ('pending','under_review','quoted','approved','in_progress','ready','out_for_delivery','delivery_failed_payment') then new.readiness:='preparing'; end if;
  end if;
  return new;
end $$;
revoke execute on function private.normalize_customer_occasion_readiness() from public,anon,authenticated;
drop trigger if exists customer_occasions_normalize_readiness on public.customer_occasions;
create trigger customer_occasions_normalize_readiness before insert or update of linked_order_id on public.customer_occasions for each row execute function private.normalize_customer_occasion_readiness();

create or replace function private.sync_customer_occasion_from_order()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.customer_occasions set readiness=case when new.status in ('delivered','completed') then 'ready' when new.status in ('pending','under_review','quoted','approved','in_progress','ready','out_for_delivery','delivery_failed_payment') then 'preparing' else readiness end, updated_at=now()
  where linked_order_id=new.id and user_id=new.user_id and is_active;
  return new;
end $$;
revoke execute on function private.sync_customer_occasion_from_order() from public,anon,authenticated;
drop trigger if exists orders_sync_customer_occasion_readiness on public.orders;
create trigger orders_sync_customer_occasion_readiness after update of status on public.orders for each row when (old.status is distinct from new.status) execute function private.sync_customer_occasion_from_order();
