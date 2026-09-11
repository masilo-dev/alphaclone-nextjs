-- Harden platform-admin helper functions without breaking RLS dependencies.

-- These trigger functions only mutate NEW and do not require elevated privileges.
ALTER FUNCTION public.auto_assign_super_admin_on_insert()
  SECURITY INVOKER;
ALTER FUNCTION public.auto_assign_super_admin_on_insert()
  SET search_path = pg_catalog, public, auth;

ALTER FUNCTION public.sync_is_super_admin_column()
  SECURITY INVOKER;
ALTER FUNCTION public.sync_is_super_admin_column()
  SET search_path = pg_catalog, public, auth;

-- is_super_admin() is intentionally SECURITY DEFINER because it is referenced
-- by RLS policies, including policies on profiles itself. Pin the search path
-- and prevent unauthenticated direct execution while preserving authenticated
-- policy evaluation and server/service-role usage.
ALTER FUNCTION public.is_super_admin()
  SET search_path = pg_catalog, public, auth;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;
