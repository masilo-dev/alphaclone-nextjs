-- Migration: Wave 2 Reliability
-- Adds set_tenant_context function to allow server-side admin clients 
-- to safely set the session context for RLS-aware operations.

CREATE OR REPLACE FUNCTION public.set_tenant_context(tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Sets the configuration parameter for the current session/transaction
  -- This is used by RLS policies that check current_setting('app.current_tenant_id')
  PERFORM set_config('app.current_tenant_id', tenant_id::text, false);
END;
$$;

-- Grant execution to authenticated users (and service role)
GRANT EXECUTE ON FUNCTION public.set_tenant_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_tenant_context(uuid) TO service_role;

COMMENT ON FUNCTION public.set_tenant_context(uuid) IS 'Sets the app.current_tenant_id session variable for RLS multi-tenant scoping.';
