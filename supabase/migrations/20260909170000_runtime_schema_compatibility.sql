-- Fields used by the chaser, durable worker, and social publisher.
-- Preserve existing rows; do not infer owners or historical send times.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS owner_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS instagram_post_id TEXT;

NOTIFY pgrst, 'reload schema';
COMMIT;
