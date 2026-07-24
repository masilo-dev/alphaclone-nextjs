-- Fix document uploads blocked by Storage RLS.
-- Client uploads use bucket `uploads` with paths:
--   tenant/{tenantId}/uploads/{userId}/{filename}
-- Without INSERT/SELECT policies, supabase-js fails with:
--   StorageApiError: new row violates row-level security policy

-- Ensure membership helper exists (idempotent with platform foundation migration).
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
      AND (
        NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenant_users'
            AND column_name = 'status'
        )
        OR COALESCE(tu.status, 'active') = 'active'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_belongs_to_tenant(uuid) TO authenticated, service_role;

-- Private uploads bucket (document hub / vault / attachments)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('uploads', 'uploads', false, 104857600)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop prior uploads policies (names used in older drafts / dashboards)
DROP POLICY IF EXISTS "uploads_select_tenant" ON storage.objects;
DROP POLICY IF EXISTS "uploads_insert_tenant" ON storage.objects;
DROP POLICY IF EXISTS "uploads_update_tenant" ON storage.objects;
DROP POLICY IF EXISTS "uploads_delete_tenant" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can read uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can update uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete uploads" ON storage.objects;

-- Tenant-prefixed path: tenant/{tenantId}/...
-- Legacy path (pre multi-tenant): {userId}/...
CREATE POLICY "uploads_select_tenant" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (
      (
        (storage.foldername(name))[1] = 'tenant'
        AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND public.user_belongs_to_tenant(((storage.foldername(name))[2])::uuid)
      )
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR owner = auth.uid()
    )
  );

CREATE POLICY "uploads_insert_tenant" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (
      (
        (storage.foldername(name))[1] = 'tenant'
        AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND public.user_belongs_to_tenant(((storage.foldername(name))[2])::uuid)
        AND (
          -- Preferred: tenant/{tid}/uploads/{userId}/file
          (storage.foldername(name))[4] = auth.uid()::text
          -- Or any path under the member's tenant folder
          OR (storage.foldername(name))[4] IS NULL
        )
      )
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "uploads_update_tenant" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (
      (
        (storage.foldername(name))[1] = 'tenant'
        AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND public.user_belongs_to_tenant(((storage.foldername(name))[2])::uuid)
      )
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR owner = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'uploads'
    AND (
      (
        (storage.foldername(name))[1] = 'tenant'
        AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND public.user_belongs_to_tenant(((storage.foldername(name))[2])::uuid)
      )
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "uploads_delete_tenant" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (
      (
        (storage.foldername(name))[1] = 'tenant'
        AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND public.user_belongs_to_tenant(((storage.foldername(name))[2])::uuid)
      )
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR owner = auth.uid()
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
