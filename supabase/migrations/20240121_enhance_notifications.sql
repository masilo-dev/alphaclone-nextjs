-- Enhance notifications table for richer functionality and email tracking

-- 1. Add new columns
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS action_url TEXT;

-- 2. Add new values to notification_type enum (if not exists)
-- Postgres doesn't support "IF NOT EXISTS" for ALTER TYPE ADD VALUE easily in a single block without DO block,
-- but Supabase MCP apply_migration handles standard SQL.
-- We'll use a DO block to be safe.

DO $$
BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice';
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'security';
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'contract';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
