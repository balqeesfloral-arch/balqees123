-- Balqees Floral v10.22 — Individual Notification Center
-- Live migration already applied to Supabase project balqees-floral.

create or replace function private.customer_archive_old_notification_reads_core()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_archived integer := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  update public.notification_reads r
  set archived_at = now()
  from public.notifications n
  where r.user_id = v_uid
    and r.notification_id = n.id
    and r.archived_at is null
    and r.dismissed_at is null
    and r.read_at is not null
    and coalesce(n.published_at,n.created_at) < now() - (
      case
        when lower(coalesce(n.category,'')) = any(array['order','support','security','payment','account','system'])
          or lower(coalesce(n.type,'')) in ('warning','system')
          or lower(coalesce(n.priority,'')) in ('high','urgent')
        then interval '120 days'
        else interval '45 days'
      end
    );
  get diagnostics v_archived = row_count;

  return jsonb_build_object('archived',v_archived);
end;
$$;

revoke execute on function private.customer_archive_old_notification_reads_core() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.customer_archive_old_notification_reads_core() to authenticated;

create or replace function public.customer_archive_old_notification_reads()
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.customer_archive_old_notification_reads_core(); $$;

revoke execute on function public.customer_archive_old_notification_reads() from public,anon;
grant execute on function public.customer_archive_old_notification_reads() to authenticated;
