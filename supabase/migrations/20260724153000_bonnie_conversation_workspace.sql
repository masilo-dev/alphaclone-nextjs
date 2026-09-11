-- Bonnie conversation workspace metadata (pin / archive / metadata)
-- Safe to re-run.

ALTER TABLE public.bonnie_conversations
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_bonnie_conversations_pinned
  ON public.bonnie_conversations (tenant_id, user_id, pinned, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bonnie_conversations_archived
  ON public.bonnie_conversations (tenant_id, user_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;
