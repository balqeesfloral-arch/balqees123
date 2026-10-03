-- Balqees Floral v10.16 — Individual Favorites
-- Applied to the live Supabase project on 2026-09-30.

alter table public.customer_favorites
  add column if not exists unit_price_snapshot numeric,
  add column if not exists price_snapshot_at timestamptz,
  add column if not exists product_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customer_favorites_price_snapshot_check'
  ) then
    alter table public.customer_favorites
      add constraint customer_favorites_price_snapshot_check
      check (unit_price_snapshot is null or unit_price_snapshot >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'customer_favorites_collection_length_check'
  ) then
    alter table public.customer_favorites
      add constraint customer_favorites_collection_length_check
      check (collection_name is null or char_length(collection_name) <= 80);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'customer_favorites_note_length_check'
  ) then
    alter table public.customer_favorites
      add constraint customer_favorites_note_length_check
      check (note is null or char_length(note) <= 240);
  end if;
end $$;

create index if not exists customer_favorites_user_collection_created_idx
  on public.customer_favorites (user_id, collection_name, created_at desc);
