-- Existing invoker triggers check the helper ACL even in the service branch.
grant execute on function private.is_balqees_admin() to service_role;
