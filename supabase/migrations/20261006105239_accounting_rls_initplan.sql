-- Explicit service-only policy; browser roles have neither schema/table grants
-- nor a policy for the private durable-import table.
create policy accounting_imports_service on private.accounting_imports
 for all to service_role using(true) with check(true);
alter policy accounting_payments_submit on public.accounting_payments
 with check(private.accounting_can_read(link_id) and submitted_by=(select auth.uid()) and status='pending' and office_transfer_id is null);
