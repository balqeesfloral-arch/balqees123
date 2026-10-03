-- Balqees Floral v10.44.3 — Runtime QA Alignment
-- Production findings from live localhost QA after v10.44.2.
-- Apply after v10.44.2. This migration is idempotent for the current schema.

-- Public SECURITY INVOKER wrappers require EXECUTE on their private implementations.
grant execute on function private.respond_to_quotation_impl(uuid,uuid,text,text) to authenticated;
grant execute on function private.request_contract_renewal_review_impl(uuid,uuid) to authenticated;
grant execute on function private.set_organization_document_state_impl(uuid,uuid,text,uuid,text,boolean) to authenticated;
grant execute on function private.create_quotation_revision_impl(uuid,uuid) to authenticated;
grant execute on function private.create_individual_order_impl(uuid,jsonb,text,text,uuid,uuid,date,text,boolean,text,boolean,text,text,uuid) to authenticated;

-- Site-scope helpers. These are the same security model used by the Page-9 master migration.
create or replace function private.b2b_has_explicit_site_scope(p_org uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1 from public.organization_member_site_access a
  where a.organization_id=p_org and a.user_id=p_user
);
$$;
revoke all on function private.b2b_has_explicit_site_scope(uuid,uuid) from public,anon;
grant execute on function private.b2b_has_explicit_site_scope(uuid,uuid) to authenticated;

create or replace function private.b2b_resource_site_allowed(p_org uuid,p_user uuid,p_site uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1 from public.organization_members m
  where m.organization_id=p_org and m.user_id=p_user and m.status='active'
    and (m.access_expires_at is null or m.access_expires_at>now())
    and (
      not private.b2b_has_explicit_site_scope(p_org,p_user)
      or (p_site is not null and exists(
        select 1 from public.organization_member_site_access a
        where a.organization_id=p_org and a.user_id=p_user and a.site_id=p_site
      ))
    )
);
$$;
revoke all on function private.b2b_resource_site_allowed(uuid,uuid,uuid) from public,anon;
grant execute on function private.b2b_resource_site_allowed(uuid,uuid,uuid) to authenticated;

create or replace function private.b2b_order_visible(p_order uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1 from public.orders o
  where o.id=p_order and (
    private.is_balqees_admin()
    or o.user_id=p_user
    or (
      o.organization_id is not null
      and coalesce((private.b2b_effective_permissions(o.organization_id,p_user)->>'view_orders')::boolean,false)
      and private.b2b_resource_site_allowed(o.organization_id,p_user,o.service_site_id)
    )
  )
);
$$;
revoke all on function private.b2b_order_visible(uuid,uuid) from public,anon;
grant execute on function private.b2b_order_visible(uuid,uuid) to authenticated;

create or replace function private.b2b_request_visible(p_request uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1 from public.organization_service_requests r
  where r.id=p_request and (
    private.is_balqees_admin()
    or (
      coalesce((private.b2b_effective_permissions(r.organization_id,p_user)->>'view_orders')::boolean,false)
      and private.b2b_resource_site_allowed(r.organization_id,p_user,r.site_id)
    )
  )
);
$$;
revoke all on function private.b2b_request_visible(uuid,uuid) from public,anon;
grant execute on function private.b2b_request_visible(uuid,uuid) to authenticated;

create or replace function private.b2b_quotation_visible(p_quote uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1
  from public.quotations q
  left join public.orders o on o.id=q.order_id
  left join public.organization_service_requests r on r.id=q.service_request_id
  where q.id=p_quote and q.status<>'draft' and (
    private.is_balqees_admin()
    or (
      coalesce((private.b2b_effective_permissions(q.organization_id,p_user)->>'view_quotations')::boolean,false)
      and private.b2b_resource_site_allowed(q.organization_id,p_user,coalesce(q.site_id,o.service_site_id,r.site_id))
    )
  )
);
$$;
revoke all on function private.b2b_quotation_visible(uuid,uuid) from public,anon;
grant execute on function private.b2b_quotation_visible(uuid,uuid) to authenticated;

create or replace function private.b2b_contract_visible(p_contract uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
  select 1 from public.contracts c
  where c.id=p_contract and c.status<>'draft' and c.published_at is not null and (
    private.is_balqees_admin()
    or (
      coalesce((private.b2b_effective_permissions(c.organization_id,p_user)->>'view_contracts')::boolean,false)
      and (
        not private.b2b_has_explicit_site_scope(c.organization_id,p_user)
        or exists(
          select 1 from public.contract_sites cs
          where cs.contract_id=c.id
            and private.b2b_resource_site_allowed(c.organization_id,p_user,cs.site_id)
        )
      )
    )
  )
);
$$;
revoke all on function private.b2b_contract_visible(uuid,uuid) from public,anon;
grant execute on function private.b2b_contract_visible(uuid,uuid) to authenticated;

-- Quote approval is enforced server-side, not just by UI gating.
create or replace function private.guard_b2b_quotation_approval_v1040()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid:=auth.uid();
  v_member public.organization_members%rowtype;
  v_effective jsonb;
begin
  if new.status is not distinct from old.status or new.status<>'accepted' then return new; end if;
  if v_uid is null or private.is_balqees_admin() then return new; end if;
  select * into v_member from public.organization_members
  where organization_id=new.organization_id and user_id=v_uid and status='active'
    and (access_expires_at is null or access_expires_at>now()) for share;
  if not found then raise exception 'APPROVER_MEMBERSHIP_REQUIRED'; end if;
  v_effective:=private.b2b_effective_permissions(new.organization_id,v_uid);
  if not coalesce((v_effective->>'approve_quotations')::boolean,(v_effective->>'accept_quotes')::boolean,false)
     or not private.b2b_resource_site_allowed(new.organization_id,v_uid,new.site_id) then
    raise exception 'QUOTATION_APPROVAL_PERMISSION_DENIED';
  end if;
  if private.b2b_role_mfa_required(new.organization_id,v_member.member_role,v_member.mfa_required)
     and not private.b2b_current_aal2() then raise exception 'MFA_AAL2_REQUIRED'; end if;
  if v_member.approval_limit is not null and coalesce(new.total,0)>v_member.approval_limit then
    raise exception 'APPROVAL_LIMIT_EXCEEDED';
  end if;
  return new;
end $$;
revoke all on function private.guard_b2b_quotation_approval_v1040() from public,anon,authenticated;
drop trigger if exists guard_b2b_quotation_approval_v1040 on public.quotations;
create trigger guard_b2b_quotation_approval_v1040
before update of status on public.quotations
for each row execute function private.guard_b2b_quotation_approval_v1040();

create or replace function private.respond_to_quotation_impl(p_user uuid,p_quote uuid,p_action text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare
  q public.quotations%rowtype;
  v_member public.organization_members%rowtype;
  v_site uuid;
begin
  if p_user is null or p_user is distinct from auth.uid() then raise exception 'AUTH_REQUIRED'; end if;
  select * into q from public.quotations where id=p_quote;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  v_site:=coalesce(q.site_id,(select o.service_site_id from public.orders o where o.id=q.order_id),(select r.site_id from public.organization_service_requests r where r.id=q.service_request_id));
  if not private.b2b_quotation_visible(p_quote,p_user)
     or not private.b2b_has_permission(q.organization_id,'approve_quotations',v_site) then
    raise exception 'QUOTATION_APPROVAL_PERMISSION_DENIED';
  end if;
  select * into v_member from public.organization_members
  where organization_id=q.organization_id and user_id=p_user and status='active'
    and (access_expires_at is null or access_expires_at>now());
  if not found then raise exception 'APPROVER_MEMBERSHIP_REQUIRED'; end if;
  if private.b2b_role_mfa_required(q.organization_id,v_member.member_role,v_member.mfa_required)
     and not private.b2b_current_aal2() then raise exception 'MFA_AAL2_REQUIRED'; end if;
  if p_action='accepted' and v_member.approval_limit is not null and coalesce(q.total,0)>v_member.approval_limit then
    raise exception 'APPROVAL_LIMIT_EXCEEDED';
  end if;
  if not q.is_current then raise exception 'QUOTE_NOT_CURRENT'; end if;
  if q.valid_until is not null and q.valid_until<current_date then raise exception 'QUOTE_EXPIRED'; end if;
  if p_action not in ('accepted','declined','revision_requested') then raise exception 'INVALID_QUOTE_ACTION'; end if;
  if p_action in ('declined','revision_requested') and btrim(coalesce(p_note,''))='' then raise exception 'QUOTE_NOTE_REQUIRED'; end if;
  update public.quotations set status=p_action,client_note=nullif(btrim(coalesce(p_note,'')),''),client_action_at=now(),client_action_by=p_user,updated_at=now()
  where id=p_quote and is_current and status in ('sent','viewed');
  if not found then raise exception 'QUOTE_NOT_ACTIONABLE'; end if;
end $$;
revoke all on function private.respond_to_quotation_impl(uuid,uuid,text,text) from public,anon;
grant execute on function private.respond_to_quotation_impl(uuid,uuid,text,text) to authenticated;

-- Core read policies follow Page-9 permissions + site scope.
drop policy if exists orders_read_own_or_admin on public.orders;
create policy orders_read_own_or_admin on public.orders for select to authenticated
using(private.is_balqees_admin() or user_id=(select auth.uid()) or (organization_id is not null and private.b2b_order_visible(id,(select auth.uid()))));

drop policy if exists order_items_read_own_or_admin on public.order_items;
create policy order_items_read_own_or_admin on public.order_items for select to authenticated
using(private.is_balqees_admin() or private.b2b_order_visible(order_id,(select auth.uid())));

drop policy if exists order_events_select_owner on public.order_events;
create policy order_events_select_owner on public.order_events for select to authenticated
using(private.is_balqees_admin() or private.b2b_order_visible(order_id,(select auth.uid())));

drop policy if exists quotations_read on public.quotations;
create policy quotations_read on public.quotations for select to authenticated
using(private.is_balqees_admin() or private.b2b_quotation_visible(id,(select auth.uid())));

drop policy if exists quotation_items_read on public.quotation_items;
create policy quotation_items_read on public.quotation_items for select to authenticated
using(private.is_balqees_admin() or exists(select 1 from public.quotations q where q.id=quotation_id and private.b2b_quotation_visible(q.id,(select auth.uid()))));

drop policy if exists quotation_events_read on public.quotation_events;
create policy quotation_events_read on public.quotation_events for select to authenticated
using(private.is_balqees_admin() or private.b2b_quotation_visible(quotation_id,(select auth.uid())));

drop policy if exists organization_sites_read on public.organization_sites;
create policy organization_sites_read on public.organization_sites for select to authenticated
using(private.is_balqees_admin() or (coalesce((private.b2b_effective_permissions(organization_id,(select auth.uid()))->>'view_sites')::boolean,false) and private.b2b_resource_site_allowed(organization_id,(select auth.uid()),id)));

drop policy if exists contracts_read on public.contracts;
create policy contracts_read on public.contracts for select to authenticated
using(private.is_balqees_admin() or private.b2b_contract_visible(id,(select auth.uid())));

select pg_notify('pgrst','reload schema');
