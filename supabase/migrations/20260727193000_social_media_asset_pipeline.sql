-- Unified social-media asset metadata. Additive and safe for existing assets.

ALTER TABLE IF EXISTS public.media_assets
  DROP CONSTRAINT IF EXISTS media_assets_asset_type_check;

ALTER TABLE IF EXISTS public.media_assets
  ADD CONSTRAINT media_assets_asset_type_check
  CHECK (asset_type IN ('image', 'video', 'gif', 'document'));

ALTER TABLE IF EXISTS public.media_assets
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS orientation TEXT,
  ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS scan_completed_at TIMESTAMPTZ;

UPDATE public.media_assets
SET workspace_id = tenant_id,
    owner_id = user_id
WHERE workspace_id IS NULL OR owner_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_workspace_created
  ON public.media_assets (workspace_id, created_at DESC);
