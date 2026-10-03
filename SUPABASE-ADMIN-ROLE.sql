-- Balqees Floral — administrator role support.
-- Apply AFTER SUPABASE-CUSTOMER-PROFILES.sql if the customer_profiles table already exists.

alter table public.customer_profiles
  add column if not exists role text not null default 'customer';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customer_profiles_role_check'
      and conrelid = 'public.customer_profiles'::regclass
  ) then
    alter table public.customer_profiles
      add constraint customer_profiles_role_check
      check (role in ('customer','admin'));
  end if;
end $$;

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
create policy "customer_profiles_select_own_or_admin"
on public.customer_profiles for select
to authenticated
using (auth.uid() = id or public.is_balqees_admin());

drop policy if exists "customer_profiles_update_own" on public.customer_profiles;
create policy "customer_profiles_update_own_or_admin"
on public.customer_profiles for update
to authenticated
using (auth.uid() = id or public.is_balqees_admin())
with check (auth.uid() = id or public.is_balqees_admin());
