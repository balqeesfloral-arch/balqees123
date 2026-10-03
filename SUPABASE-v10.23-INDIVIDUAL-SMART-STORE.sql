-- Balqees Floral v10.23 — Individual Smart Store foundations
alter table public.customer_preferences
  add column if not exists store_budget_limit numeric,
  add column if not exists store_budget_overrun boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='customer_preferences_store_budget_limit_check'
  ) then
    alter table public.customer_preferences
      add constraint customer_preferences_store_budget_limit_check
      check (store_budget_limit is null or (store_budget_limit >= 1 and store_budget_limit <= 100000));
  end if;
end $$;

create or replace function private.store_popular_product_ids_core(p_limit integer default 12)
returns table(product_id uuid)
language sql
security definer
set search_path = ''
as $$
  select oi.product_id
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.products p on p.id = oi.product_id
  where oi.product_id is not null
    and o.status in ('delivered','completed')
    and p.is_active = true
    and p.visibility = 'public'
  group by oi.product_id
  order by sum(oi.quantity) desc, max(o.created_at) desc
  limit greatest(1,least(coalesce(p_limit,12),30));
$$;

revoke execute on function private.store_popular_product_ids_core(integer) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.store_popular_product_ids_core(integer) to anon,authenticated;

create or replace function public.store_popular_product_ids(p_limit integer default 12)
returns table(product_id uuid)
language sql
security invoker
set search_path = ''
as $$ select * from private.store_popular_product_ids_core(p_limit); $$;

revoke execute on function public.store_popular_product_ids(integer) from public;
grant execute on function public.store_popular_product_ids(integer) to anon,authenticated;
