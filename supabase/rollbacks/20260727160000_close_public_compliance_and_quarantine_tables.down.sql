-- Emergency compatibility rollback. Restores grants but leaves RLS enabled so the
-- tables do not become publicly readable. No data is changed.
BEGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.data_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_isolation_quarantine TO authenticated;
COMMIT;
