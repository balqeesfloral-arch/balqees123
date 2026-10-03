-- Balqees Floral customer profiles — apply in Supabase SQL Editor.
-- Auth remains in Supabase Auth. This table stores profile/business/address data for future orders, quotations and invoices.

create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('company','individual')),
  role text not null default 'customer' check (role in ('customer','admin')),
  username text not null unique,
  full_name text not null,
  phone text not null,
  establishment_display_name text,
  organization jsonb,
  personal jsonb,
  national_address jsonb not null default '{}'::jsonb,
  profile_version integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;

create or replace function public.is_balqees_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

grant execute on function public.is_balqees_admin() to authenticated;

drop policy if exists "customer_profiles_select_own" on public.customer_profiles;
drop policy if exists "customer_profiles_select_own_or_admin" on public.customer_profiles;
create policy "customer_profiles_select_own_or_admin"
on public.customer_profiles for select
to authenticated
using (auth.uid() = id or public.is_balqees_admin());

drop policy if exists "customer_profiles_update_own" on public.customer_profiles;
drop policy if exists "customer_profiles_update_own_or_admin" on public.customer_profiles;
create policy "customer_profiles_update_own_or_admin"
on public.customer_profiles for update
to authenticated
using (auth.uid() = id or public.is_balqees_admin())
with check (auth.uid() = id or public.is_balqees_admin());

create or replace function public.handle_new_balqees_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.customer_profiles (
    id, account_type, role, username, full_name, phone,
    establishment_display_name, organization, personal,
    national_address, profile_version
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'account_type','individual'),
    case when coalesce(new.raw_app_meta_data->>'role','') = 'admin' then 'admin' else 'customer' end,
    lower(new.raw_user_meta_data->>'username'),
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    nullif(new.raw_user_meta_data->>'establishment_display_name',''),
    new.raw_user_meta_data->'organization',
    new.raw_user_meta_data->'personal',
    coalesce(new.raw_user_meta_data->'national_address','{}'::jsonb),
    coalesce((new.raw_user_meta_data->>'profile_version')::integer,2)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_balqees on auth.users;
create trigger on_auth_user_created_balqees
after insert on auth.users
for each row execute procedure public.handle_new_balqees_user();
