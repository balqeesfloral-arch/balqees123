-- Balqees Floral v10.20 — Individual profile hardening and profile RPC

-- Keep client-side table updates limited to genuinely editable profile fields.
revoke insert, update on table public.customer_profiles from anon, authenticated;
grant select on table public.customer_profiles to authenticated;
grant update (full_name, phone, username, personal, national_address, updated_at)
  on table public.customer_profiles to authenticated;

-- Make newly created profile rows carry the Auth email from day one.
create or replace function public.handle_new_balqees_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
begin
  v_username := lower(nullif(btrim(coalesce(new.raw_user_meta_data->>'username','')), ''));
  if v_username is null then
    v_username := 'user_' || replace(left(new.id::text, 8), '-', '');
  end if;

  insert into public.customer_profiles (
    id, account_type, role, username, full_name, phone, email,
    establishment_display_name, organization, personal,
    national_address, profile_version
  ) values (
    new.id,
    case when new.raw_user_meta_data->>'account_type' in ('company','individual')
      then new.raw_user_meta_data->>'account_type' else 'individual' end,
    case when coalesce(new.raw_app_meta_data->>'role','') = 'admin' then 'admin' else 'customer' end,
    v_username,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    new.email,
    nullif(new.raw_user_meta_data->>'establishment_display_name',''),
    new.raw_user_meta_data->'organization',
    new.raw_user_meta_data->'personal',
    coalesce(new.raw_user_meta_data->'national_address','{}'::jsonb),
    case when (new.raw_user_meta_data->>'profile_version') ~ '^[0-9]+$'
      then (new.raw_user_meta_data->>'profile_version')::integer else 2 end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill the email mirror for existing accounts.
update public.customer_profiles p
set email = u.email,
    updated_at = case when p.email is distinct from u.email then now() else p.updated_at end
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

-- Keep customer_profiles.email synchronized only after Auth itself changes the email.
create or replace function private.sync_customer_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.customer_profiles
    set email = new.email, updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function private.sync_customer_profile_email_from_auth() from public, anon, authenticated;

drop trigger if exists sync_customer_profile_email_from_auth on auth.users;
create trigger sync_customer_profile_email_from_auth
after update of email on auth.users
for each row execute function private.sync_customer_profile_email_from_auth();

-- Narrow RPC for individual profile edits. It never touches role/account type/email/company data.
create or replace function private.customer_update_individual_profile_core(
  p_full_name text,
  p_username text,
  p_phone text,
  p_nationality_code text default null,
  p_birth_date date default null,
  p_gender text default null,
  p_residence_city text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.customer_profiles%rowtype;
  v_name text := btrim(coalesce(p_full_name,''));
  v_username text := lower(btrim(coalesce(p_username,'')));
  v_phone text := regexp_replace(btrim(coalesce(p_phone,'')), '[^0-9+]', '', 'g');
  v_country text := nullif(upper(btrim(coalesce(p_nationality_code,''))), '');
  v_city text := nullif(btrim(coalesce(p_residence_city,'')), '');
  v_personal jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_profile
  from public.customer_profiles
  where id = v_uid and account_type = 'individual'
  for update;
  if not found then raise exception 'INDIVIDUAL_PROFILE_NOT_FOUND'; end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'INVALID_FULL_NAME'; end if;
  if char_length(v_username) < 3 or char_length(v_username) > 30 or v_username ~ '[[:space:]]' or v_username ~ '[._-]{2,}' then
    raise exception 'INVALID_USERNAME';
  end if;
  if v_phone !~ '^\\+[1-9][0-9]{7,14}$' then raise exception 'INVALID_PHONE'; end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then raise exception 'INVALID_NATIONALITY'; end if;
  if p_birth_date is not null and (p_birth_date > current_date or p_birth_date < (current_date - interval '120 years')::date) then
    raise exception 'INVALID_BIRTH_DATE';
  end if;
  if p_gender is not null and p_gender not in ('male','female','prefer_not_to_say') then raise exception 'INVALID_GENDER'; end if;
  if v_city is not null and char_length(v_city) > 120 then raise exception 'CITY_TOO_LONG'; end if;

  if exists (
    select 1 from public.customer_profiles
    where lower(username) = v_username and id <> v_uid
  ) then raise exception 'USERNAME_TAKEN'; end if;

  v_personal := jsonb_strip_nulls(
    coalesce(v_profile.personal,'{}'::jsonb)
    || jsonb_build_object(
      'birth_date', p_birth_date,
      'gender', p_gender,
      'nationality_code', v_country,
      'residence_city', v_city
    )
  );

  update public.customer_profiles
  set full_name = v_name,
      username = v_username,
      phone = v_phone,
      personal = v_personal,
      updated_at = now()
  where id = v_uid
  returning * into v_profile;

  return jsonb_build_object(
    'id', v_profile.id,
    'full_name', v_profile.full_name,
    'username', v_profile.username,
    'phone', v_profile.phone,
    'email', v_profile.email,
    'personal', v_profile.personal,
    'updated_at', v_profile.updated_at
  );
end;
$$;
revoke execute on function private.customer_update_individual_profile_core(text,text,text,text,date,text,text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.customer_update_individual_profile_core(text,text,text,text,date,text,text) to authenticated;

create or replace function public.customer_update_individual_profile(
  p_full_name text,
  p_username text,
  p_phone text,
  p_nationality_code text default null,
  p_birth_date date default null,
  p_gender text default null,
  p_residence_city text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.customer_update_individual_profile_core(
    p_full_name,p_username,p_phone,p_nationality_code,p_birth_date,p_gender,p_residence_city
  );
$$;
revoke execute on function public.customer_update_individual_profile(text,text,text,text,date,text,text) from public, anon;
grant execute on function public.customer_update_individual_profile(text,text,text,text,date,text,text) to authenticated;
