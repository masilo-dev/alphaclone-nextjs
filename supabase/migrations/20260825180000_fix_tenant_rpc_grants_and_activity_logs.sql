-- Hotfix: production Supabase logs showed:
--   42501 permission denied for function create_tenant_idempotent
--   57014 statement timeout on activity_logs by tenant_id + created_at desc
--
-- The idempotent tenant RPC is service-role only; re-apply grants after CREATE OR REPLACE.
-- Add composite index for dashboard activity feed queries.

GRANT EXECUTE ON FUNCTION public.create_tenant_idempotent(TEXT, TEXT, UUID, TEXT, TEXT)
    TO service_role;

GRANT EXECUTE ON FUNCTION public.create_tenant(TEXT, TEXT, UUID, TEXT)
    TO service_role;

CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_created_desc
    ON public.activity_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_users_user_tenant
    ON public.tenant_users (user_id, tenant_id);

NOTIFY pgrst, 'reload schema';
