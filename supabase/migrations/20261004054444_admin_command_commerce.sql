-- Existing Balqees schema: atomic catalog saves and live cross-page updates.
-- SECURITY INVOKER keeps existing product/cost RLS in force.
create or replace function public.admin_save_product(
  p_product jsonb, p_cost jsonb, p_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  product public.products;
  cost public.product_costs;
  saved public.products;
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if exists (select 1 from public.admin_user_state where user_id = auth.uid() and status in ('blocked', 'suspended')) then
    raise exception 'Administrator account is inactive' using errcode = '42501';
  end if;
  if jsonb_typeof(p_product) is distinct from 'object' or jsonb_typeof(p_cost) is distinct from 'object' then
    raise exception 'Invalid product payload' using errcode = '22023';
  end if;
  product := jsonb_populate_record(null::public.products, p_product);
  cost := jsonb_populate_record(null::public.product_costs, p_cost);
  if nullif(btrim(product.name_ar), '') is null or nullif(btrim(product.name_en), '') is null
    or nullif(btrim(product.sku), '') is null or nullif(btrim(product.slug), '') is null then
    raise exception 'Product identity is required' using errcode = '22023';
  end if;
  if product.price_on_request is null or product.is_active is null or product.is_featured is null
    or product.exclude_auto_pricing is null or product.stock_quantity is null
    or product.min_order_quantity is null or product.visibility is null then
    raise exception 'Product policy fields are required' using errcode = '22023';
  end if;
  if not product.price_on_request and (product.base_price is null or product.base_price <= 0) then
    raise exception 'Selling price must be positive' using errcode = '22023';
  end if;
  if product.sale_price is not null and (product.sale_price < 0 or product.sale_price > product.base_price) then
    raise exception 'Invalid sale price' using errcode = '22023';
  end if;
  if product.stock_quantity < 0 or product.min_order_quantity <= 0
    or (product.max_order_quantity is not null and product.max_order_quantity < product.min_order_quantity) then
    raise exception 'Invalid stock or order limits' using errcode = '22023';
  end if;
  if product.sale_starts_at is not null and product.sale_ends_at is not null and product.sale_ends_at <= product.sale_starts_at then
    raise exception 'Invalid sale dates' using errcode = '22023';
  end if;
  if cost.cost_price is null or cost.low_stock_threshold is null or cost.cost_price < 0 or cost.low_stock_threshold < 0
    or (cost.target_margin_percent is not null and (cost.target_margin_percent < 0 or cost.target_margin_percent >= 100)) then
    raise exception 'Invalid cost or margin' using errcode = '22023';
  end if;
  if product.price_on_request then
    product.base_price := null;
    product.sale_price := null;
    product.sale_starts_at := null;
    product.sale_ends_at := null;
  end if;
  if p_id is null then
    insert into public.products (
      category_id, sku, slug, name_ar, name_en, short_description_ar, short_description_en, description_ar, description_en, base_price, sale_price, sale_starts_at, sale_ends_at, price_on_request, exclude_auto_pricing, stock_mode, stock_quantity, min_order_quantity, max_order_quantity, unit_ar, unit_en, lead_time_ar, lead_time_en, image_url, gallery, tags, is_active, is_featured, visibility
    ) values (
      product.category_id, product.sku, product.slug, product.name_ar, product.name_en, product.short_description_ar, product.short_description_en, product.description_ar, product.description_en, product.base_price, product.sale_price, product.sale_starts_at, product.sale_ends_at, product.price_on_request, product.exclude_auto_pricing, product.stock_mode, product.stock_quantity, product.min_order_quantity, product.max_order_quantity, product.unit_ar, product.unit_en, product.lead_time_ar, product.lead_time_en, product.image_url, product.gallery, product.tags, product.is_active, product.is_featured, product.visibility
    ) returning * into saved;
  else
    update public.products set
      category_id = product.category_id,
      sku = product.sku,
      slug = product.slug,
      name_ar = product.name_ar,
      name_en = product.name_en,
      short_description_ar = product.short_description_ar,
      short_description_en = product.short_description_en,
      description_ar = product.description_ar,
      description_en = product.description_en,
      base_price = product.base_price,
      sale_price = product.sale_price,
      sale_starts_at = product.sale_starts_at,
      sale_ends_at = product.sale_ends_at,
      price_on_request = product.price_on_request,
      exclude_auto_pricing = product.exclude_auto_pricing,
      stock_mode = product.stock_mode,
      stock_quantity = product.stock_quantity,
      min_order_quantity = product.min_order_quantity,
      max_order_quantity = product.max_order_quantity,
      unit_ar = product.unit_ar,
      unit_en = product.unit_en,
      lead_time_ar = product.lead_time_ar,
      lead_time_en = product.lead_time_en,
      image_url = product.image_url,
      gallery = product.gallery,
      tags = product.tags,
      is_active = product.is_active,
      is_featured = product.is_featured,
      visibility = product.visibility,
      updated_at = now()
    where id = p_id returning * into saved;
    if saved.id is null then
      raise exception 'Product not found or access denied' using errcode = '42501';
    end if;
  end if;
  insert into public.product_costs (product_id, cost_price, target_margin_percent, low_stock_threshold, supplier_name, internal_note, updated_at)
  values (saved.id, cost.cost_price, cost.target_margin_percent, cost.low_stock_threshold, cost.supplier_name, cost.internal_note, now())
  on conflict (product_id) do update set
    cost_price = excluded.cost_price, target_margin_percent = excluded.target_margin_percent,
    low_stock_threshold = excluded.low_stock_threshold, supplier_name = excluded.supplier_name,
    internal_note = excluded.internal_note, updated_at = now();
  return to_jsonb(saved);
end;
$function$;
revoke all on function public.admin_save_product(jsonb, jsonb, uuid) from public, anon;
grant execute on function public.admin_save_product(jsonb, jsonb, uuid) to authenticated;

-- Realtime delivers only rows permitted by each subscriber's existing RLS.
do $publication$
declare
  item text;
begin
  foreach item in array array['products', 'product_categories', 'product_costs', 'price_rules', 'system_settings', 'support_conversations', 'notifications', 'customer_profiles'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = item) then
      execute format('alter publication supabase_realtime add table public.%I', item);
    end if;
  end loop;
end;
$publication$;
