-- Balqees Floral v10.44.3 — Cross-Portal Site Scope Completion
-- Completes runtime QA alignment for Pages 2–8 after Page 9 permissions became authoritative.
-- Idempotent for the v10.44.x schema.

create or replace function private.b2b_document_visible(
  p_org uuid,p_user uuid,p_site uuid,p_order uuid,p_quote uuid,p_contract uuid
)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
  if private.is_balqees_admin() then return true; end if;
  if not exists(
    select 1 from public.organization_members m
    where m.organization_id=p_org
      and m.user_id=p_user
      and m.status='active'
      and (m.access_expires_at is null or m.access_expires_at>now())
  ) then return false; end if;
  if not private.b2b_has_explicit_site_scope(p_org,p_user) then return true; end if;
  if p_site is not null and private.b2b_resource_site_allowed(p_org,p_user,p_site) then return true; end if;
  if p_order is not null and private.b2b_order_visible(p_order,p_user) then return true; end if;
  if p_quote is not null and private.b2b_quotation_visible(p_quote,p_user) then return true; end if;
  if p_contract is not null and private.b2b_contract_visible(p_contract,p_user) then return true; end if;
  return false;
end $$;
revoke all on function private.b2b_document_visible(uuid,uuid,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function private.b2b_document_visible(uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;

create or replace function private.contract_visible_to_member(p_contract uuid,p_org uuid)
returns boolean language sql stable security definer set search_path='' as $$
select private.is_balqees_admin()
   or (
     exists(select 1 from public.contracts c where c.id=p_contract and c.organization_id=p_org)
     and private.b2b_contract_visible(p_contract,auth.uid())
   );
$$;
revoke all on function private.contract_visible_to_member(uuid,uuid) from public,anon;
grant execute on function private.contract_visible_to_member(uuid,uuid) to authenticated;

create or replace function private.site_child_visible(p_site uuid,p_org uuid)
returns boolean language sql stable security definer set search_path='' as $$
select private.is_balqees_admin()
   or (
     coalesce((private.b2b_effective_permissions(p_org,auth.uid())->>'view_sites')::boolean,false)
     and private.b2b_resource_site_allowed(p_org,auth.uid(),p_site)
     and exists(select 1 from public.organization_sites s where s.id=p_site and s.organization_id=p_org)
   );
$$;
revoke all on function private.site_child_visible(uuid,uuid) from public,anon;
grant execute on function private.site_child_visible(uuid,uuid) to authenticated;

create or replace function private.request_contract_renewal_review_impl(p_user uuid,p_contract uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c public.contracts%rowtype;
begin
  if p_user is null or p_user is distinct from auth.uid() then raise exception 'AUTH_REQUIRED'; end if;
  select * into c from public.contracts where id=p_contract;
  if not found then raise exception 'CONTRACT_NOT_FOUND'; end if;
  if not private.b2b_contract_visible(p_contract,p_user)
     or not private.b2b_has_permission(c.organization_id,'approve_quotations',null)
  then raise exception 'CONTRACT_PERMISSION_DENIED'; end if;
  if c.status not in ('active','expiring') then raise exception 'CONTRACT_NOT_RENEWABLE'; end if;
  if c.renewal_status in ('review_requested','in_review') then return; end if;
  update public.contracts
  set renewal_status='review_requested',renewal_review_requested_at=now(),renewal_review_requested_by=p_user,updated_at=now()
  where id=p_contract;
end $$;
revoke all on function private.request_contract_renewal_review_impl(uuid,uuid) from public,anon;
grant execute on function private.request_contract_renewal_review_impl(uuid,uuid) to authenticated;

-- Service requests respect member permissions + site scope.
drop policy if exists organization_service_requests_read on public.organization_service_requests;
create policy organization_service_requests_read on public.organization_service_requests
for select to authenticated
using(private.is_balqees_admin() or private.b2b_request_visible(id,(select auth.uid())));

drop policy if exists organization_service_requests_insert on public.organization_service_requests;
create policy organization_service_requests_insert on public.organization_service_requests
for insert to authenticated
with check(
  created_by=(select auth.uid()) and status='draft'
  and private.b2b_has_permission(organization_id,'create_orders',null)
  and private.b2b_resource_site_allowed(organization_id,(select auth.uid()),site_id)
);

drop policy if exists organization_service_requests_update on public.organization_service_requests;
create policy organization_service_requests_update on public.organization_service_requests
for update to authenticated
using(
  private.is_balqees_admin() or (
    created_by=(select auth.uid()) and status='draft'
    and private.b2b_has_permission(organization_id,'create_orders',null)
    and private.b2b_resource_site_allowed(organization_id,(select auth.uid()),site_id)
  )
)
with check(
  private.is_balqees_admin() or (
    created_by=(select auth.uid())
    and private.b2b_has_permission(organization_id,'create_orders',null)
    and private.b2b_resource_site_allowed(organization_id,(select auth.uid()),site_id)
  )
);

drop policy if exists organization_service_requests_delete on public.organization_service_requests;
create policy organization_service_requests_delete on public.organization_service_requests
for delete to authenticated
using(
  private.is_balqees_admin() or (
    created_by=(select auth.uid()) and status='draft'
    and private.b2b_has_permission(organization_id,'create_orders',null)
    and private.b2b_resource_site_allowed(organization_id,(select auth.uid()),site_id)
  )
);

-- Attachment policies are tied to the parent request, not only organization membership.
drop policy if exists organization_request_attachments_read on public.organization_request_attachments;
create policy organization_request_attachments_read on public.organization_request_attachments
for select to authenticated
using(private.is_balqees_admin() or private.b2b_request_visible(request_id,(select auth.uid())));

drop policy if exists organization_request_attachments_insert on public.organization_request_attachments;
create policy organization_request_attachments_insert on public.organization_request_attachments
for insert to authenticated
with check(
  uploaded_by=(select auth.uid()) and exists(
    select 1 from public.organization_service_requests r
    where r.id=request_id
      and r.organization_id=organization_id
      and r.created_by=(select auth.uid())
      and r.status='draft'
      and private.b2b_has_permission(r.organization_id,'create_orders',null)
      and private.b2b_resource_site_allowed(r.organization_id,(select auth.uid()),r.site_id)
  )
);

drop policy if exists organization_request_attachments_delete on public.organization_request_attachments;
create policy organization_request_attachments_delete on public.organization_request_attachments
for delete to authenticated
using(
  private.is_balqees_admin() or (
    uploaded_by=(select auth.uid()) and exists(
      select 1 from public.organization_service_requests r
      where r.id=request_id
        and r.created_by=(select auth.uid())
        and r.status='draft'
        and private.b2b_resource_site_allowed(r.organization_id,(select auth.uid()),r.site_id)
    )
  )
);

-- Site CRUD respects the member's explicit site scope.
drop policy if exists organization_sites_insert on public.organization_sites;
create policy organization_sites_insert on public.organization_sites
for insert to authenticated
with check(
  private.is_balqees_admin() or (
    private.b2b_has_permission(organization_id,'manage_sites',null)
    and not private.b2b_has_explicit_site_scope(organization_id,(select auth.uid()))
  )
);

drop policy if exists organization_sites_update on public.organization_sites;
create policy organization_sites_update on public.organization_sites
for update to authenticated
using(
  private.is_balqees_admin() or (
    private.b2b_has_permission(organization_id,'manage_sites',null)
    and private.b2b_resource_site_allowed(organization_id,(select auth.uid()),id)
  )
)
with check(
  private.is_balqees_admin() or (
    private.b2b_has_permission(organization_id,'manage_sites',null)
    and private.b2b_resource_site_allowed(organization_id,(select auth.uid()),id)
  )
);

drop policy if exists organization_sites_delete on public.organization_sites;
create policy organization_sites_delete on public.organization_sites
for delete to authenticated
using(
  private.is_balqees_admin() or (
    private.b2b_has_permission(organization_id,'manage_sites',null)
    and private.b2b_resource_site_allowed(organization_id,(select auth.uid()),id)
  )
);

-- Site child writes use the same scope resolver.
do $$
declare t text;
begin
  foreach t in array array['organization_site_areas','organization_site_contacts','organization_site_files'] loop
    execute format('drop policy if exists %I on public.%I',t||'_insert',t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check(
        private.is_balqees_admin() or (
          private.b2b_has_permission(organization_id,''manage_sites'',null)
          and private.b2b_resource_site_allowed(organization_id,(select auth.uid()),site_id)
        )
      )',t||'_insert',t
    );
    execute format('drop policy if exists %I on public.%I',t||'_update',t);
    execute format(
      'create policy %I on public.%I for update to authenticated using(
        private.is_balqees_admin() or (
          private.b2b_has_permission(organization_id,''manage_sites'',null)
          and private.b2b_resource_site_allowed(organization_id,(select auth.uid()),site_id)
        )
      ) with check(
        private.is_balqees_admin() or (
          private.b2b_has_permission(organization_id,''manage_sites'',null)
          and private.b2b_resource_site_allowed(organization_id,(select auth.uid()),site_id)
        )
      )',t||'_update',t
    );
    execute format('drop policy if exists %I on public.%I',t||'_delete',t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using(
        private.is_balqees_admin() or (
          private.b2b_has_permission(organization_id,''manage_sites'',null)
          and private.b2b_resource_site_allowed(organization_id,(select auth.uid()),site_id)
        )
      )',t||'_delete',t
    );
  end loop;
end $$;

-- Contract child records inherit contract + site visibility.
drop policy if exists contract_sites_read on public.contract_sites;
create policy contract_sites_read on public.contract_sites
for select to authenticated
using(
  private.is_balqees_admin() or (
    private.b2b_contract_visible(contract_id,(select auth.uid()))
    and private.b2b_resource_site_allowed(organization_id,(select auth.uid()),site_id)
  )
);

drop policy if exists contract_obligations_read on public.contract_obligations;
create policy contract_obligations_read on public.contract_obligations
for select to authenticated
using(
  private.is_balqees_admin() or (
    visible_to_client
    and private.b2b_contract_visible(contract_id,(select auth.uid()))
    and (site_id is null or private.b2b_resource_site_allowed(organization_id,(select auth.uid()),site_id))
  )
);

drop policy if exists contract_financials_read on public.contract_financials;
create policy contract_financials_read on public.contract_financials
for select to authenticated
using(
  private.is_balqees_admin() or (
    private.b2b_has_permission(organization_id,'view_financial_documents',null)
    and private.b2b_contract_visible(contract_id,(select auth.uid()))
  )
);

-- Documents respect both finance permission and the site/resource scope.
drop policy if exists client_documents_read on public.client_documents;
create policy client_documents_read on public.client_documents
for select to authenticated
using(
  private.is_balqees_admin() or (
    status<>'draft'
    and (visibility='all_members' or private.b2b_has_permission(organization_id,'view_financial_documents',null))
    and private.b2b_document_visible(organization_id,(select auth.uid()),site_id,order_id,quotation_id,contract_id)
  )
);

select pg_notify('pgrst','reload schema');
