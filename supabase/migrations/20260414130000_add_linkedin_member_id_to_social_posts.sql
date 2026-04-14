ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS linkedin_member_id TEXT;

CREATE INDEX IF NOT EXISTS idx_social_posts_linkedin_member_id
  ON public.social_posts (linkedin_member_id);
