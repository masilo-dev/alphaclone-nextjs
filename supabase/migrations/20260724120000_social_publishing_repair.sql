-- Social publishing repair: lifecycle columns, overdue recovery, orphaned fake-success posts.
-- Safe / idempotent. Does NOT auto-republish (avoids duplicates).

-- Extra columns used by SocialPublishingService (ignore if already present)
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS live_url text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_response jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS social_posts_tenant_idempotency_uidx
  ON public.social_posts (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Media asset metadata for hardened uploads
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS checksum_sha256 text,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer;

-- Expand status check if present (best-effort; may no-op when constraint name differs)
DO $$
BEGIN
  ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.social_posts
    ADD CONSTRAINT social_posts_status_check
    CHECK (status = ANY (ARRAY[
      'draft',
      'validating',
      'awaiting_approval',
      'approved',
      'uploading_media',
      'queued',
      'scheduled',
      'publishing',
      'published',
      'verification_failed',
      'retrying',
      'failed',
      'cancelled',
      'deleted',
      'orphaned',
      'pending_review',
      'published_sandbox'
    ]));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Repair known fake-success Facebook post (DB insert without provider call)
UPDATE public.social_posts
SET
  status = 'orphaned',
  error_message = COALESCE(
    error_message,
    'Marked orphaned by social publishing repair: ok=true after DB insert without Facebook provider_post_id. Not auto-republished.'
  ),
  last_error = 'fake_success_no_provider_id',
  updated_at = now(),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'repair',
    jsonb_build_object(
      'repaired_at', now(),
      'reason', 'fake_success_no_provider_id',
      'migration', '20260724120000_social_publishing_repair'
    )
  )
WHERE id = '1854057c-abea-4333-8a3a-9354be9217d0'
  AND facebook_post_id IS NULL
  AND linkedin_post_urn IS NULL;

-- Broader sweep: "published" rows with no provider IDs are not published
UPDATE public.social_posts
SET
  status = 'orphaned',
  error_message = COALESCE(
    error_message,
    'Marked orphaned: status was published without facebook_post_id or linkedin_post_urn'
  ),
  last_error = 'published_without_provider_id',
  updated_at = now()
WHERE status = 'published'
  AND facebook_post_id IS NULL
  AND linkedin_post_urn IS NULL
  AND published_at IS NOT NULL;

-- Flag overdue scheduled LinkedIn posts for the scheduler (keep status=scheduled so cron picks them up)
UPDATE public.social_posts
SET
  last_error = COALESCE(last_error, 'overdue_scheduled_awaiting_recovery'),
  updated_at = now(),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'overdue_recovery',
    jsonb_build_object(
      'flagged_at', now(),
      'migration', '20260724120000_social_publishing_repair'
    )
  )
WHERE status = 'scheduled'
  AND scheduled_at IS NOT NULL
  AND scheduled_at <= now()
  AND published_at IS NULL
  AND linkedin_post_urn IS NULL
  AND (
    platforms @> ARRAY['linkedin']::text[]
    OR platform = 'linkedin'
  );

-- Monitoring view for overdue scheduled social posts (>5 minutes)
CREATE OR REPLACE VIEW public.social_posts_overdue AS
SELECT
  id,
  tenant_id,
  platforms,
  platform,
  status,
  scheduled_at,
  published_at,
  facebook_page_id,
  linkedin_organization_id,
  linkedin_post_urn,
  facebook_post_id,
  attempt_count,
  last_error,
  error_message,
  EXTRACT(EPOCH FROM (now() - scheduled_at)) / 60.0 AS overdue_minutes
FROM public.social_posts
WHERE status = 'scheduled'
  AND scheduled_at IS NOT NULL
  AND scheduled_at <= now() - interval '5 minutes';
