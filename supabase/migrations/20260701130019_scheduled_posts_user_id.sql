-- Align scheduled_posts with MCP schedule_social_post handler (user_id column drift)
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_tenant_status
  ON public.scheduled_posts (tenant_id, status, scheduled_at);
