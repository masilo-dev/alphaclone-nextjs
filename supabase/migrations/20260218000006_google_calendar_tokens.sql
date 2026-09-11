-- Migration: Create google_calendar_tokens table
-- Description: Stores per-user Google OAuth tokens for Calendar integration

CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can manage their own calendar tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can manage their own calendar tokens"
    ON public.google_calendar_tokens FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id ON public.google_calendar_tokens(user_id);

-- Documentation
COMMENT ON TABLE public.google_calendar_tokens IS 'Stores Google OAuth tokens specifically for Calendar integration on a per-user basis.';
