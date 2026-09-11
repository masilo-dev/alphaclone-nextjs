-- Expand social_post_analytics for provider sync snapshots
ALTER TABLE public.social_post_analytics
  ADD COLUMN IF NOT EXISTS comments INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform TEXT NULL,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Keep one analytics row per post (dedupe legacy rows first)
DELETE FROM public.social_post_analytics a
USING public.social_post_analytics b
WHERE a.post_id = b.post_id
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS social_post_analytics_post_id_unique
  ON public.social_post_analytics (post_id);
