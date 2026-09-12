-- Media readiness is an integrity state, not an upload acknowledgement.
ALTER TABLE IF EXISTS public.media_assets
  ADD COLUMN IF NOT EXISTS failure_code text,
  ADD COLUMN IF NOT EXISTS failure_message text;

UPDATE public.media_assets SET status = 'ready' WHERE status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_assets_status_check'
      AND conrelid = 'public.media_assets'::regclass
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_status_check
      CHECK (status IN ('uploading', 'validating', 'processing', 'ready', 'failed', 'deleted'))
      NOT VALID;
    ALTER TABLE public.media_assets VALIDATE CONSTRAINT media_assets_status_check;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_ready_created
  ON public.media_assets (tenant_id, created_at DESC)
  WHERE status = 'ready';

-- This asset was independently confirmed to contain a truncated JPEG. Never let
-- it reach a provider again; re-uploading the original creates a new ready row.
UPDATE public.media_assets
SET status = 'failed',
    failure_code = 'MEDIA_IMAGE_CORRUPT',
    failure_message = 'Stored JPEG was verified as truncated; source must be re-uploaded.',
    updated_at = now()
WHERE id = '8b676f7b-bc03-49a8-95f7-50e8bb4c562c'
  AND status = 'ready';

-- Keep canonical Instagram discovery synchronized with the same integration
-- rows used to obtain publishing credentials. Tokens remain only in the secret table.
INSERT INTO public.social_connections (
  tenant_id, connected_by_user_id, provider, provider_account_id,
  provider_account_name, connection_status, token_expires_at, metadata
)
SELECT ii.tenant_id, ii.user_id, 'instagram', ii.instagram_account_id,
       COALESCE(ii.username, ii.account_name, ii.instagram_account_id),
       CASE WHEN ii.is_active AND (ii.expires_at IS NULL OR ii.expires_at > now())
         THEN 'active' ELSE 'expired' END,
       ii.expires_at,
       jsonb_build_object('legacy_integration_id', ii.id, 'facebook_page_id', ii.facebook_page_id)
FROM public.instagram_integrations ii
WHERE ii.tenant_id IS NOT NULL AND ii.instagram_account_id IS NOT NULL
ON CONFLICT (tenant_id, provider, provider_account_id) DO UPDATE SET
  provider_account_name = EXCLUDED.provider_account_name,
  connection_status = EXCLUDED.connection_status,
  token_expires_at = EXCLUDED.token_expires_at,
  metadata = EXCLUDED.metadata,
  updated_at = now();

INSERT INTO public.social_identities (
  tenant_id, connection_id, provider, identity_type, provider_identity_id,
  display_name, can_publish, can_upload_media, can_read_insights, is_active, metadata
)
SELECT ii.tenant_id, sc.id, 'instagram', 'instagram_business', ii.instagram_account_id,
       COALESCE(ii.username, ii.account_name, ii.instagram_account_id),
       ii.is_active AND (ii.expires_at IS NULL OR ii.expires_at > now()),
       ii.is_active AND (ii.expires_at IS NULL OR ii.expires_at > now()),
       ii.is_active AND (ii.expires_at IS NULL OR ii.expires_at > now()),
       ii.is_active AND (ii.expires_at IS NULL OR ii.expires_at > now()),
       jsonb_build_object('legacy_integration_id', ii.id, 'facebook_page_id', ii.facebook_page_id)
FROM public.instagram_integrations ii
JOIN public.social_connections sc
  ON sc.tenant_id = ii.tenant_id
 AND sc.provider = 'instagram'
 AND sc.provider_account_id = ii.instagram_account_id
WHERE ii.tenant_id IS NOT NULL AND ii.instagram_account_id IS NOT NULL
ON CONFLICT (tenant_id, provider, identity_type, provider_identity_id) DO UPDATE SET
  connection_id = EXCLUDED.connection_id,
  display_name = EXCLUDED.display_name,
  can_publish = EXCLUDED.can_publish,
  can_upload_media = EXCLUDED.can_upload_media,
  can_read_insights = EXCLUDED.can_read_insights,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = now();
