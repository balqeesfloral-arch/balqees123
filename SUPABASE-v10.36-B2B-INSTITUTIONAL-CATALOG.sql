-- Balqees Floral v10.36 — B2B Institutional Catalog (final-state reference)
-- The live Supabase project already contains the v10.36 migrations listed below.
-- This file documents the final architecture and provides verification queries.

-- LIVE MIGRATIONS
-- b2b_institutional_catalog_v10_36
-- b2b_catalog_taxonomy_seed_v10_36
-- b2b_institutional_catalog_admin_read_v10_36
-- b2b_catalog_rpc_column_guard_v10_36

-- Core B2B catalog tables introduced by v10.36:
-- public.catalog_product_profiles
-- public.catalog_spaces
-- public.catalog_styles
-- public.catalog_product_spaces
-- public.catalog_product_styles
-- public.catalog_collections
-- public.catalog_collection_products
-- public.catalog_collection_organizations
-- public.organization_catalog_products
-- public.contract_product_prices
-- public.catalog_campaigns
-- public.catalog_campaign_products
-- public.catalog_campaign_collections
-- public.catalog_campaign_organizations
-- public.catalog_inspiration
-- public.catalog_inspiration_products
-- public.catalog_inspiration_organizations
-- public.catalog_media_assets

-- Pricing/visibility is intentionally returned through a narrow RPC rather than by
-- exposing raw base/org/contract pricing rows to organization members.
-- Public wrapper:
--   public.get_organization_catalog_products(p_organization_id uuid, p_site_id uuid default null)
-- Private implementation:
--   private.get_organization_catalog_products_impl(p_user uuid,p_org uuid,p_site uuid default null)
--
-- Effective pricing precedence:
--   active contract price for the selected covered site
--   -> organization price override
--   -> permitted base/sale price for visible/from pricing modes
--   -> no numeric price for quotation/contract-only modes without a contract price
--
-- Numeric price is returned only when the active organization member has
-- view_finance or accept_quotes permission.

-- Default editable taxonomy seeded by v10.36:
-- Spaces: lobby, reception, entrance, restaurant, suites, meeting, offices, garden
-- Styles: luxury-calm, natural, modern, classic, minimal, hospitality, seasonal

-- VERIFY LIVE STATE
select version,name
from supabase_migrations.schema_migrations
where name like '%v10_36'
order by version;

select table_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'catalog_product_profiles','catalog_spaces','catalog_styles','catalog_product_spaces','catalog_product_styles',
    'catalog_collections','catalog_collection_products','catalog_collection_organizations','organization_catalog_products',
    'contract_product_prices','catalog_campaigns','catalog_campaign_products','catalog_campaign_collections',
    'catalog_campaign_organizations','catalog_inspiration','catalog_inspiration_products','catalog_inspiration_organizations',
    'catalog_media_assets'
  )
order by table_name;

select slug,name_ar,name_en,is_active,sort_order from public.catalog_spaces order by sort_order;
select slug,name_ar,name_en,is_active,sort_order from public.catalog_styles order by sort_order;

select n.nspname as schema_name,p.proname
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname='get_organization_catalog_products')
   or (n.nspname='private' and p.proname='get_organization_catalog_products_impl')
order by schema_name,proname;
