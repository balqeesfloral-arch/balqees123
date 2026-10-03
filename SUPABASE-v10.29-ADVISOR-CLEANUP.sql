-- Balqees Floral v10.29
-- Advisor cleanup for individual order paths.

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
