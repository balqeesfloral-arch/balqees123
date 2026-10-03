-- Balqees Floral v10.29 — individual portal performance pass
-- Preserves behavior while optimizing owner RLS checks and common FK joins.

-- Owner tables used throughout the individual portal.
do $$
begin
  -- placeholder block kept only to group idempotent DDL below
end $$;

-- customer_addresses
drop policy if exists customer_addresses_delete_own on public.customer_addresses;
drop policy if exists customer_addresses_insert_own on public.customer_addresses;
drop policy if exists customer_addresses_select_own on public.customer_addresses;
drop policy if exists customer_addresses_update_own on public.customer_addresses;
create policy customer_addresses_select_own on public.customer_addresses for select to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_addresses_insert_own on public.customer_addresses for insert to authenticated with check (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_addresses_update_own on public.customer_addresses for update to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin()) with check (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_addresses_delete_own on public.customer_addresses for delete to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin());
revoke all on public.customer_addresses from anon;
grant select,insert,update,delete on public.customer_addresses to authenticated;

-- customer_cart_items
drop policy if exists customer_cart_delete_own on public.customer_cart_items;
drop policy if exists customer_cart_insert_own on public.customer_cart_items;
drop policy if exists customer_cart_select_own on public.customer_cart_items;
drop policy if exists customer_cart_update_own on public.customer_cart_items;
create policy customer_cart_select_own on public.customer_cart_items for select to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_cart_insert_own on public.customer_cart_items for insert to authenticated with check (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_cart_update_own on public.customer_cart_items for update to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin()) with check (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_cart_delete_own on public.customer_cart_items for delete to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin());
revoke all on public.customer_cart_items from anon;
grant select,insert,update,delete on public.customer_cart_items to authenticated;

-- customer_favorites
drop policy if exists customer_favorites_delete_own on public.customer_favorites;
drop policy if exists customer_favorites_insert_own on public.customer_favorites;
drop policy if exists customer_favorites_select_own on public.customer_favorites;
drop policy if exists customer_favorites_update_own on public.customer_favorites;
create policy customer_favorites_select_own on public.customer_favorites for select to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_favorites_insert_own on public.customer_favorites for insert to authenticated with check (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_favorites_update_own on public.customer_favorites for update to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin()) with check (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_favorites_delete_own on public.customer_favorites for delete to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin());
revoke all on public.customer_favorites from anon;
grant select,insert,update,delete on public.customer_favorites to authenticated;

-- customer_recipients
drop policy if exists customer_recipients_delete_own on public.customer_recipients;
drop policy if exists customer_recipients_insert_own on public.customer_recipients;
drop policy if exists customer_recipients_select_own on public.customer_recipients;
drop policy if exists customer_recipients_update_own on public.customer_recipients;
create policy customer_recipients_select_own on public.customer_recipients for select to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_recipients_insert_own on public.customer_recipients for insert to authenticated with check (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_recipients_update_own on public.customer_recipients for update to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin()) with check (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_recipients_delete_own on public.customer_recipients for delete to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin());
revoke all on public.customer_recipients from anon;
grant select,insert,update,delete on public.customer_recipients to authenticated;

-- customer_interest_events
drop policy if exists customer_interest_delete_own on public.customer_interest_events;
drop policy if exists customer_interest_insert_own on public.customer_interest_events;
drop policy if exists customer_interest_select_own on public.customer_interest_events;
create policy customer_interest_select_own on public.customer_interest_events for select to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_interest_insert_own on public.customer_interest_events for insert to authenticated with check (user_id=(select auth.uid()) or private.is_balqees_admin());
create policy customer_interest_delete_own on public.customer_interest_events for delete to authenticated using (user_id=(select auth.uid()) or private.is_balqees_admin());
revoke all on public.customer_interest_events from anon;
grant select,insert,delete on public.customer_interest_events to authenticated;

-- Cover foreign keys used by the individual journey and document center.
create index if not exists customer_cart_items_product_idx on public.customer_cart_items(product_id);
create index if not exists customer_checkout_drafts_address_idx on public.customer_checkout_drafts(address_id);
create index if not exists customer_checkout_drafts_recipient_idx on public.customer_checkout_drafts(recipient_id);
create index if not exists customer_checkout_drafts_occasion_idx on public.customer_checkout_drafts(occasion_id);
create index if not exists customer_favorites_product_idx on public.customer_favorites(product_id);
create index if not exists customer_interest_events_product_idx on public.customer_interest_events(product_id);
create index if not exists customer_interest_events_category_idx on public.customer_interest_events(category_id);
create index if not exists customer_preferences_default_address_idx on public.customer_preferences(default_address_id);
create index if not exists customer_preferences_default_recipient_idx on public.customer_preferences(default_recipient_id);
create index if not exists customer_recipients_default_address_idx on public.customer_recipients(default_address_id);
create index if not exists customer_documents_order_idx on public.customer_documents(order_id);
create index if not exists customer_document_delivery_events_created_by_idx on public.customer_document_delivery_events(created_by);
create index if not exists orders_customer_address_idx on public.orders(customer_address_id);
create index if not exists orders_customer_recipient_idx on public.orders(customer_recipient_id);
create index if not exists support_conversations_order_idx on public.support_conversations(order_id);

-- Final advisor cleanup on order tracking reads; keep existing public role scope for anonymous COD compatibility.
drop policy if exists order_events_select_owner on public.order_events;
create policy order_events_select_owner
on public.order_events for select
using (
  private.is_balqees_admin()
  or exists (
    select 1 from public.orders o
    where o.id = order_events.order_id
      and o.user_id = (select auth.uid())
  )
);

drop policy if exists order_delivery_attempts_customer_read on public.order_delivery_attempts;
create policy order_delivery_attempts_customer_read
on public.order_delivery_attempts for select
using (
  private.is_balqees_admin()
  or exists (
    select 1 from public.orders o
    where o.id = order_delivery_attempts.order_id
      and o.user_id = (select auth.uid())
  )
);

create index if not exists customer_documents_created_by_idx on public.customer_documents(created_by);
create index if not exists customer_privacy_requests_resolved_by_idx on public.customer_privacy_requests(resolved_by);
create index if not exists order_delivery_attempts_created_by_idx on public.order_delivery_attempts(created_by);
create index if not exists order_events_actor_id_idx on public.order_events(actor_id);
create index if not exists orders_cod_reviewed_by_idx on public.orders(cod_reviewed_by);
