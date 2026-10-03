-- Balqees Floral v10.39 — B2B Balqees Smart Care / Page 10
-- Safe care architecture: context-aware human handoff, AI audit surface, KB controls and organization-scoped RLS.

alter table public.support_conversations
  add column if not exists care_mode text not null default 'human' check (care_mode in ('ai','human','hybrid')),
  add column if not exists ai_summary text,
  add column if not exists assigned_admin_id uuid references auth.users(id) on delete set null,
  add column if not exists human_handoff_at timestamptz,
  add column if not exists care_source text not null default 'portal';

create table if not exists public.care_tool_audit (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.support_conversations(id) on delete set null,
  tool_name text not null,
  entity_type text,
  entity_id text,
  success boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.care_tool_audit enable row level security;
drop policy if exists "care audit own org read" on public.care_tool_audit;
create policy "care audit own org read" on public.care_tool_audit for select to authenticated using (
  private.is_balqees_admin() or (organization_id is not null and public.is_org_member(organization_id))
);

create table if not exists public.care_settings (
  id boolean primary key default true check(id=true),
  ai_enabled boolean not null default true,
  human_handoff_enabled boolean not null default true,
  catalog_search_enabled boolean not null default true,
  finance_lookup_enabled boolean not null default true,
  contract_lookup_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.care_settings(id) values(true) on conflict(id) do nothing;
alter table public.care_settings enable row level security;
drop policy if exists "care settings authenticated read" on public.care_settings;
create policy "care settings authenticated read" on public.care_settings for select to authenticated using(true);
drop policy if exists "care settings admin write" on public.care_settings;
create policy "care settings admin write" on public.care_settings for all to authenticated using(private.is_balqees_admin()) with check(private.is_balqees_admin());

-- Human handoff RPC: the client never chooses priority or another organization's context.
create or replace function public.open_organization_care_case(
  p_organization_id uuid,
  p_subject text,
  p_message text,
  p_context jsonb default '{}'::jsonb,
  p_ai_summary text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_uid uuid:=auth.uid();
begin
  if v_uid is null or not public.is_org_member(p_organization_id) then raise exception 'not_authorized'; end if;
  if char_length(coalesce(trim(p_subject),''))<2 or char_length(coalesce(trim(p_message),''))<2 then raise exception 'invalid_content'; end if;
  insert into public.support_conversations(user_id,organization_id,subject,status,priority,category,requires_human,context_snapshot,care_mode,ai_summary,human_handoff_at,care_source)
  values(v_uid,p_organization_id,left(trim(p_subject),180),'open','normal','b2b_care',true,coalesce(p_context,'{}'::jsonb),'hybrid',left(p_ai_summary,2000),now(),'portal') returning id into v_id;
  insert into public.support_messages(conversation_id,sender_id,sender_role,body) values(v_id,v_uid,'user',left(trim(p_message),6000));
  return v_id;
end $$;
revoke execute on function public.open_organization_care_case(uuid,text,text,jsonb,text) from public,anon;
grant execute on function public.open_organization_care_case(uuid,text,text,jsonb,text) to authenticated;

-- Important: an external LLM must never receive service-role credentials or generic SQL access.
-- Model calls should be added later behind a server-side orchestrator that exposes only named, authorized tools.
