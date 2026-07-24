-- Social publishing repair: lifecycle columns + extend social_post_status enum.
-- Safe / idempotent. Does NOT auto-republish (avoids duplicates).
-- NOTE: UPDATEs that write new enum values live in 20260724120001_* so they
-- run in a later transaction after ADD VALUE is committed (PG requirement).

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

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS checksum_sha256 text,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer;

DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'validating',
    'awaiting_approval',
    'approved',
    'uploading_media',
    'verification_failed',
    'retrying',
    'orphaned',
    'deleted',
    'pending_review',
    'published_sandbox'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER TYPE public.social_post_status ADD VALUE IF NOT EXISTS %L', v);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

DO $$
BEGIN
  ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;
