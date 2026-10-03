-- Balqees Floral v10.21 — Individual Settings
-- Existing customer_preferences columns power the page. This migration makes
-- occasion reminder generation respect the customer's live settings.

create or replace function private.customer_sync_occasion_reminders_core()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Riyadh')::date;
  v_occ record;
  v_days int;
  v_created int := 0;
  v_title text;
  v_body text;
  v_pref record;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select occasion_reminders, quiet_mode
  into v_pref
  from public.customer_preferences
  where user_id = v_user;

  if found and (coalesce(v_pref.occasion_reminders, true) = false or coalesce(v_pref.quiet_mode, false) = true) then
    return jsonb_build_object('created', 0, 'suppressed', true);
  end if;

  for v_occ in
    select o.id, o.occasion_type, o.graduation_level, o.occasion_date,
           o.recipient_id, o.custom_recipient_name, o.reminder_days,
           coalesce(r.label, r.full_name, o.custom_recipient_name) as recipient_name
    from public.customer_occasions o
    left join public.customer_recipients r on r.id = o.recipient_id
    where o.user_id = v_user
      and o.is_active
      and o.occasion_date is not null
      and o.occasion_date >= v_today
      and 'in_app' = any(o.reminder_channels)
  loop
    foreach v_days in array coalesce(v_occ.reminder_days, '{}'::int[])
    loop
      if v_occ.occasion_date - v_today = v_days then
        if not exists (
          select 1 from public.notifications n
          where n.user_id = v_user
            and n.category = 'occasion'
            and n.metadata->>'occasion_id' = v_occ.id::text
            and n.metadata->>'reminder_days' = v_days::text
        ) then
          v_title := case v_occ.occasion_type
            when 'wedding' then 'مناسبة زواج قريبة'
            when 'malka' then 'مناسبة مَلْكة قريبة'
            when 'engagement' then 'مناسبة خطبة قريبة'
            when 'return_from_travel' then 'موعد قدوم من سفر قريب'
            when 'new_baby' then 'مناسبة مولود جديدة قريبة'
            when 'graduation' then 'مناسبة تخرج قريبة'
            when 'party' then 'حفلة قريبة'
            else 'مناسبة محفوظة قريبة'
          end;

          v_body := case
            when v_days = 0 then 'المناسبة اليوم. راجع تجهيزك قبل الطلب.'
            when v_occ.recipient_name is not null then 'باقي ' || v_days || ' يومًا على المناسبة لـ ' || v_occ.recipient_name || '.'
            else 'باقي ' || v_days || ' يومًا على المناسبة المحفوظة.'
          end;

          insert into public.notifications(
            title_ar,title_en,body_ar,body_en,type,audience,user_id,status,published_at,
            category,priority,action_url,action_label_ar,action_label_en,metadata
          ) values (
            v_title,'Upcoming occasion',v_body,'You have an upcoming saved occasion.',
            'info','user',v_user,'published',now(),'occasion','normal',
            '/account/occasions','استعد الآن','Prepare now',
            jsonb_build_object('occasion_id',v_occ.id,'reminder_days',v_days)
          );
          v_created := v_created + 1;
        end if;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('created', v_created, 'suppressed', false);
end;
$$;
