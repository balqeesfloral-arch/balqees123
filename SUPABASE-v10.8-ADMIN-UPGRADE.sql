-- Balqees Floral v10.8 incremental upgrade
-- Apply after the v10.7 admin foundation.

-- Users can read their own access state; admins can read all through the existing admin path.
drop policy if exists "admin_user_state_self_read" on public.admin_user_state;
create policy "admin_user_state_self_read"
on public.admin_user_state for select to authenticated
using (
  user_id = (select auth.uid())
  or coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','') = 'admin'
);

-- Avoid overlapping admin SELECT policy.
drop policy if exists "admin_user_state_admin_all" on public.admin_user_state;
create policy "admin_user_state_admin_insert" on public.admin_user_state for insert to authenticated
with check (coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','') = 'admin');
create policy "admin_user_state_admin_update" on public.admin_user_state for update to authenticated
using (coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','') = 'admin')
with check (coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','') = 'admin');
create policy "admin_user_state_admin_delete" on public.admin_user_state for delete to authenticated
using (coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','') = 'admin');

-- Keep support inbox ordering in sync with messages.
create or replace function public.touch_support_conversation_from_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.support_conversations
  set last_message_at = new.created_at,
      updated_at = new.created_at,
      status = case when new.sender_role = 'user' and status = 'closed' then 'open' else status end
  where id = new.conversation_id;
  return new;
end;
$$;
revoke execute on function public.touch_support_conversation_from_message() from public, anon, authenticated;
drop trigger if exists support_message_touch_conversation on public.support_messages;
create trigger support_message_touch_conversation
after insert on public.support_messages
for each row execute procedure public.touch_support_conversation_from_message();

-- Scheduled notifications become visible automatically when due.
drop policy if exists "notifications_read_audience" on public.notifications;
create policy "notifications_read_audience"
on public.notifications for select to authenticated
using (
  coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','') = 'admin'
  or (
    (status = 'published' or (status = 'scheduled' and scheduled_at is not null and scheduled_at <= now()))
    and (
      audience = 'all'
      or (audience = 'user' and user_id = (select auth.uid()))
      or (
        audience in ('company','individual')
        and audience = (select account_type from public.customer_profiles where id = (select auth.uid()))
      )
    )
  )
);

-- Discount usage ledger for the upcoming order engine.
create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);
alter table public.discount_redemptions enable row level security;
grant select, insert, update, delete on public.discount_redemptions to authenticated;
drop policy if exists "discount_redemptions_own_or_admin_read" on public.discount_redemptions;
create policy "discount_redemptions_own_or_admin_read" on public.discount_redemptions for select to authenticated
using (user_id = (select auth.uid()) or coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','') = 'admin');
drop policy if exists "discount_redemptions_admin_insert" on public.discount_redemptions;
create policy "discount_redemptions_admin_insert" on public.discount_redemptions for insert to authenticated
with check (coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','') = 'admin');
drop policy if exists "discount_redemptions_admin_update" on public.discount_redemptions;
create policy "discount_redemptions_admin_update" on public.discount_redemptions for update to authenticated
using (coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','') = 'admin')
with check (coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','') = 'admin');
drop policy if exists "discount_redemptions_admin_delete" on public.discount_redemptions;
create policy "discount_redemptions_admin_delete" on public.discount_redemptions for delete to authenticated
using (coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','') = 'admin');
create index if not exists discount_redemptions_discount_id_idx on public.discount_redemptions(discount_id);
create index if not exists discount_redemptions_user_id_idx on public.discount_redemptions(user_id);
create index if not exists discount_redemptions_order_id_idx on public.discount_redemptions(order_id);

-- Public catalog media bucket; only admins can mutate objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-media','catalog-media',true,8388608,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "catalog_media_admin_insert" on storage.objects;
create policy "catalog_media_admin_insert" on storage.objects for insert to authenticated
with check (bucket_id='catalog-media' and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','')='admin');
drop policy if exists "catalog_media_admin_update" on storage.objects;
create policy "catalog_media_admin_update" on storage.objects for update to authenticated
using (bucket_id='catalog-media' and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','')='admin')
with check (bucket_id='catalog-media' and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','')='admin');
drop policy if exists "catalog_media_admin_delete" on storage.objects;
create policy "catalog_media_admin_delete" on storage.objects for delete to authenticated
using (bucket_id='catalog-media' and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','')='admin');
