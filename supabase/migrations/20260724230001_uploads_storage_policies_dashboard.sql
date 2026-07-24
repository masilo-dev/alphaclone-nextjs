-- Uploads bucket Storage RLS — use ALTER POLICY (not CREATE/DROP).
-- storage.objects is owned by supabase_storage_admin; CREATE POLICY fails with
-- ERROR 42501 must be owner of table objects, but ALTER POLICY works for postgres.
--
-- Path shapes allowed:
--   tenant/{tenantId}/uploads/{userId}/...
--   {userId}/...   (legacy)

UPDATE storage.buckets
SET public = false
WHERE id = 'uploads';

-- Insert: legacy user folder OR tenant member path
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

-- Select: own folder, owner, or tenant member
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

-- Disable blanket public read on private uploads bucket
ALTER POLICY uploads_select_public ON storage.objects
USING (
  bucket_id = 'uploads'
  AND false
);

-- Delete: own folder, owner, or tenant member
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
