-- Superseded by:
--   20260724230000_fix_tenant_status_and_uploads_rls.sql
--   20260724230001_uploads_storage_policies_dashboard.sql
--
-- Kept for migration history. Safe helpers only — no CREATE POLICY on
-- storage.objects (owned by supabase_storage_admin → ERROR 42501).

CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.tenant_id = p_tenant_id
      AND tu.user_id = auth.uid()
      AND COALESCE(to_jsonb(tu)->>'status', 'active') = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_belongs_to_tenant(uuid) TO authenticated, service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('uploads', 'uploads', false, 104857600)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit);
