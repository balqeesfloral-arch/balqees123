-- Balqees Floral v10.15 — Individual smart cart support
-- Applied to live Supabase project: balqees-floral

alter table public.customer_cart_items
  add column if not exists unit_price_snapshot numeric,
  add column if not exists price_snapshot_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customer_cart_items_price_snapshot_check'
  ) then
    alter table public.customer_cart_items
      add constraint customer_cart_items_price_snapshot_check
      check (unit_price_snapshot is null or unit_price_snapshot >= 0);
  end if;
end $$;

create index if not exists customer_cart_items_user_updated_idx
  on public.customer_cart_items (user_id, updated_at desc);

create or replace function private.customer_coupon_requirement_core(
  p_user uuid,
  p_code text,
  p_subtotal numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.discounts%rowtype;
  v_subtotal numeric := greatest(coalesce(p_subtotal,0),0);
begin
  if p_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_code is null or btrim(p_code) = '' then return null; end if;

  select * into d
  from public.discounts
  where upper(coalesce(code,'')) = upper(btrim(p_code))
    and is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  limit 1;

  if not found then return null; end if;

  return jsonb_build_object(
    'minimum_order', d.min_order,
    'needed', greatest(d.min_order - v_subtotal, 0)
  );
end;
$$;

revoke execute on function private.customer_coupon_requirement_core(uuid,text,numeric) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.customer_coupon_requirement_core(uuid,text,numeric) to authenticated;

create or replace function public.customer_coupon_requirement(
  p_code text,
  p_subtotal numeric
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.customer_coupon_requirement_core(auth.uid(), p_code, p_subtotal);
$$;

revoke execute on function public.customer_coupon_requirement(text,numeric) from public, anon;
grant execute on function public.customer_coupon_requirement(text,numeric) to authenticated;
