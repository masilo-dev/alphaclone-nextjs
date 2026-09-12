-- Canonical media_assets schema catch-up.
--
-- This is intentionally additive: production has historically contained a mix
-- of the early social-media schema and a legacy `name`/`mime_type` shape.
-- Application code uses the file_* names below.  Keep legacy columns intact
-- while backfilling their canonical counterparts.

ALTER TABLE IF EXISTS public.media_assets
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS asset_type TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS public_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS width INTEGER,
  ADD COLUMN IF NOT EXISTS height INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS failure_message TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Upgrade installations that used earlier serializer names. Dynamic SQL is
-- required because a fresh installation does not have these legacy columns.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media_assets' AND column_name = 'name') THEN
    EXECUTE 'UPDATE public.media_assets SET file_name = COALESCE(NULLIF(file_name, ''''), name) WHERE file_name IS NULL OR file_name = ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media_assets' AND column_name = 'filename') THEN
    EXECUTE 'UPDATE public.media_assets SET file_name = COALESCE(NULLIF(file_name, ''''), filename) WHERE file_name IS NULL OR file_name = ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media_assets' AND column_name = 'mime_type') THEN
    EXECUTE 'UPDATE public.media_assets SET file_type = COALESCE(NULLIF(file_type, ''''), mime_type) WHERE file_type IS NULL OR file_type = ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media_assets' AND column_name = 'media_type') THEN
    EXECUTE 'UPDATE public.media_assets SET file_type = COALESCE(NULLIF(file_type, ''''), media_type) WHERE file_type IS NULL OR file_type = ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media_assets' AND column_name = 'size_bytes') THEN
    EXECUTE 'UPDATE public.media_assets SET file_size_bytes = COALESCE(file_size_bytes, size_bytes) WHERE file_size_bytes IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media_assets' AND column_name = 'file_size') THEN
    EXECUTE 'UPDATE public.media_assets SET file_size_bytes = COALESCE(file_size_bytes, file_size) WHERE file_size_bytes IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media_assets' AND column_name = 'media_url') THEN
    EXECUTE 'UPDATE public.media_assets SET public_url = COALESCE(NULLIF(public_url, ''''), media_url) WHERE public_url IS NULL OR public_url = ''''';
  END IF;
END $$;

UPDATE public.media_assets
SET asset_type = CASE
      WHEN COALESCE(file_type, '') LIKE 'video/%' THEN 'video'
      WHEN COALESCE(file_type, '') = 'image/gif' THEN 'gif'
      WHEN COALESCE(file_type, '') = 'application/pdf' THEN 'document'
      ELSE 'image'
    END
WHERE asset_type IS NULL;

-- All AlphaClone-managed objects use Supabase Storage. A non-Supabase URL is
-- preserved as external rather than being mislabeled as a Supabase object.
UPDATE public.media_assets
SET storage_provider = CASE
      WHEN COALESCE(metadata->>'storage_provider', '') <> '' THEN metadata->>'storage_provider'
      WHEN COALESCE(public_url, '') LIKE '%/storage/v1/object/%'
        OR COALESCE(storage_path, '') LIKE 'media/%' THEN 'supabase'
      ELSE 'external'
    END
WHERE storage_provider IS NULL OR storage_provider = '';

UPDATE public.media_assets
SET status = 'ready'
WHERE status IS NULL OR status = '';

ALTER TABLE public.media_assets
  ALTER COLUMN storage_provider SET DEFAULT 'supabase',
  ALTER COLUMN status SET DEFAULT 'ready';

-- Backfill above is exhaustive, so these guarantees are safe for existing
-- rows and prevent a future serializer from producing an unrouteable asset.
ALTER TABLE public.media_assets
  ALTER COLUMN storage_provider SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.media_assets
  DROP CONSTRAINT IF EXISTS media_assets_asset_type_check;
ALTER TABLE public.media_assets
  ADD CONSTRAINT media_assets_asset_type_check
  CHECK (asset_type IN ('image', 'video', 'gif', 'document')) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_status_created
  ON public.media_assets (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_provider_created
  ON public.media_assets (tenant_id, storage_provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_checksum
  ON public.media_assets (tenant_id, checksum_sha256)
  WHERE checksum_sha256 IS NOT NULL;

-- Runtime schema guard. Media entry points call this before querying fields so
-- an incomplete deployment yields MEDIA_SCHEMA_MISMATCH, never a raw 42703.
CREATE OR REPLACE FUNCTION public.assert_media_assets_schema()
RETURNS TABLE (missing_column TEXT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH required(column_name) AS (
    VALUES
      ('id'), ('tenant_id'), ('user_id'), ('file_name'), ('file_type'),
      ('asset_type'), ('storage_provider'), ('storage_path'), ('public_url'),
      ('thumbnail_url'), ('file_size_bytes'), ('checksum_sha256'), ('width'),
      ('height'), ('status'), ('failure_code'), ('failure_message'),
      ('metadata'), ('created_at'), ('updated_at')
  )
  SELECT required.column_name
  FROM required
  LEFT JOIN information_schema.columns actual
    ON actual.table_schema = 'public'
   AND actual.table_name = 'media_assets'
   AND actual.column_name = required.column_name
  WHERE actual.column_name IS NULL
  ORDER BY required.column_name;
$$;

REVOKE ALL ON FUNCTION public.assert_media_assets_schema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_media_assets_schema() TO authenticated, service_role;
