INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-assets',
  'social-assets',
  true,
  26214400,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.generated_assets
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS bucket_id TEXT DEFAULT 'social-assets';

CREATE INDEX IF NOT EXISTS idx_generated_assets_tenant_user_created
  ON public.generated_assets (tenant_id, user_id, created_at DESC);

ALTER TABLE public.generated_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant users read own generated assets" ON public.generated_assets;
CREATE POLICY "Tenant users read own generated assets"
ON public.generated_assets FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "Tenant users delete own generated assets" ON public.generated_assets;
CREATE POLICY "Tenant users delete own generated assets"
ON public.generated_assets FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  AND tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Public read social assets" ON storage.objects;
CREATE POLICY "Public read social assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'social-assets');
