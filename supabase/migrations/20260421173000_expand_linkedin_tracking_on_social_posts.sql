ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS linkedin_organization_id TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_author_urn TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_stats JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_stats_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_engagement_sync_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_social_posts_linkedin_organization_id
  ON public.social_posts (linkedin_organization_id);

CREATE INDEX IF NOT EXISTS idx_social_posts_linkedin_author_urn
  ON public.social_posts (linkedin_author_urn);

NOTIFY pgrst, 'reload schema';
