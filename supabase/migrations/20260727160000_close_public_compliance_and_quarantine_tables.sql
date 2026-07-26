-- Close two production tables that were exposed through PostgREST with RLS disabled.
-- Existing application paths use the service role and continue to work.
BEGIN;

ALTER TABLE IF EXISTS public.data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_isolation_quarantine ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.data_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.tenant_isolation_quarantine FROM anon, authenticated;

-- Deliberately no client policies: these contain PII or cross-tenant repair evidence.
-- service_role bypasses RLS; application endpoints must perform authorization themselves.

COMMENT ON TABLE public.data_requests IS
  'Privacy/data-subject requests. Server-only; contains PII and is not exposed to PostgREST clients.';
COMMENT ON TABLE public.tenant_isolation_quarantine IS
  'Server-only quarantine for ambiguous tenant ownership repairs. Never client-readable.';

COMMIT;
