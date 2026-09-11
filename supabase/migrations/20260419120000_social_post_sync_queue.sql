-- Queue for persisting social post metadata after successful external API publish when DB update fails.

CREATE TABLE IF NOT EXISTS public.social_post_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_post_id uuid NOT NULL REFERENCES public.social_posts (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('linkedin', 'facebook')),
  external_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_social_post_sync_queue_pending
  ON public.social_post_sync_queue (created_at ASC)
  WHERE processed_at IS NULL;

COMMENT ON TABLE public.social_post_sync_queue IS 'Retries applying external post IDs to social_posts after publish.';

ALTER TABLE public.social_post_sync_queue ENABLE ROW LEVEL SECURITY;
