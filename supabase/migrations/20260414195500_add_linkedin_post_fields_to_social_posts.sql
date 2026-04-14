ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS linkedin_post_urn TEXT;

CREATE INDEX IF NOT EXISTS idx_social_posts_linkedin_post_urn
  ON public.social_posts (linkedin_post_urn);
