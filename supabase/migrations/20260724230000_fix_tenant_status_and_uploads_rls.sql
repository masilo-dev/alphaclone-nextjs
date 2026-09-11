-- Fix ERROR 42703: column tu.status does not exist
-- (broken membership helpers + uploads Storage RLS for document hub).
--
-- Postgres validates SQL-function bodies at CREATE time. Referencing tu.status
-- fails on schemas where tenant_users has no status column — even inside an
-- information_schema OR branch. Use to_jsonb(tu)->>'status' instead.
--
-- Client uploads use bucket `uploads` with paths:
--   tenant/{tenantId}/uploads/{userId}/{filename}

-- Match production signature: SETOF uuid (policies alias the column as tenant_id).
-- Never DROP this function — dozens of RLS policies depend on it.
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tu.tenant_id
  FROM public.tenant_users tu
  WHERE tu.user_id = auth.uid()
    AND COALESCE(to_jsonb(tu)->>'status', 'active') = 'active';
$$;

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

CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_belongs_to_tenant(p_tenant_id);
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_owner(p_tenant_id uuid)
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
      AND lower(COALESCE(tu.role, '')) IN ('owner', 'admin', 'administrator', 'super_admin', 'tenant_admin')
      AND COALESCE(to_jsonb(tu)->>'status', 'active') = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_tenant_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner(uuid) TO authenticated, service_role;

-- Private uploads bucket (document hub / vault / attachments)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('uploads', 'uploads', false, 104857600)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit);

-- storage.objects is owned by supabase_storage_admin.
-- CREATE/DROP POLICY fails with 42501; ALTER POLICY on existing policies works.
-- See also 20260724230001_uploads_storage_policies_dashboard.sql

ALTER POLICY uploads_insert_authenticated ON storage.objects
WITH CHECK (
  bucket_id = 'uploads'
  AND auth.role() = 'authenticated'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] = 'tenant'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND public.user_belongs_to_tenant(((storage.foldername(name))[2])::uuid)
    )
  )
);

ALTER POLICY uploads_select_authenticated ON storage.objects
USING (
  bucket_id = 'uploads'
  AND auth.role() = 'authenticated'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR owner = auth.uid()
    OR (
      (storage.foldername(name))[1] = 'tenant'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND public.user_belongs_to_tenant(((storage.foldername(name))[2])::uuid)
    )
  )
);

ALTER POLICY uploads_select_public ON storage.objects
USING (
  bucket_id = 'uploads'
  AND false
);

ALTER POLICY uploads_delete_own ON storage.objects
USING (
  bucket_id = 'uploads'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR owner = auth.uid()
    OR (
      (storage.foldername(name))[1] = 'tenant'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND public.user_belongs_to_tenant(((storage.foldername(name))[2])::uuid)
    )
  )
);

-- file_uploads metadata: allow tenant members to read workspace files; insert own rows
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS file_uploads_select_policy ON public.file_uploads;
DROP POLICY IF EXISTS file_uploads_insert_policy ON public.file_uploads;
DROP POLICY IF EXISTS file_uploads_update_policy ON public.file_uploads;
DROP POLICY IF EXISTS file_uploads_delete_policy ON public.file_uploads;
DROP POLICY IF EXISTS "file_uploads_tenant_select" ON public.file_uploads;
DROP POLICY IF EXISTS "file_uploads_tenant_insert" ON public.file_uploads;
DROP POLICY IF EXISTS "file_uploads_tenant_update" ON public.file_uploads;
DROP POLICY IF EXISTS "file_uploads_tenant_delete" ON public.file_uploads;

CREATE POLICY "file_uploads_tenant_select" ON public.file_uploads
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      tenant_id IS NOT NULL
      AND public.user_belongs_to_tenant(tenant_id)
    )
  );

CREATE POLICY "file_uploads_tenant_insert" ON public.file_uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      tenant_id IS NULL
      OR public.user_belongs_to_tenant(tenant_id)
    )
  );

CREATE POLICY "file_uploads_tenant_update" ON public.file_uploads
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      tenant_id IS NOT NULL
      AND public.user_belongs_to_tenant(tenant_id)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      tenant_id IS NOT NULL
      AND public.user_belongs_to_tenant(tenant_id)
    )
  );

CREATE POLICY "file_uploads_tenant_delete" ON public.file_uploads
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      tenant_id IS NOT NULL
      AND public.user_belongs_to_tenant(tenant_id)
    )
  );
