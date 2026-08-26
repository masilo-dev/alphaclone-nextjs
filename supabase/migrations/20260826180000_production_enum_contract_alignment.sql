-- Production contract alignment: task_status lifecycle + notification enum safety.
-- Idempotent: safe to re-run; skips values that already exist.

DO $$
BEGIN
  ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'blocked';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Extend notification_type for direct event-type inserts (mapper also maps dot-notation events).
DO $$
BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'mcp.action_failed';
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'social.post_published';
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'social.post_failed';
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'mcp.action_completed';
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'email.failed';
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'email.sent';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
