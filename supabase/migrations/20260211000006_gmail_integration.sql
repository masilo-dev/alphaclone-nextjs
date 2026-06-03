-- Migration: Create gmail_sync_tokens table
-- Description: Stores per-user Google OAuth tokens for Gmail integration

CREATE TABLE IF NOT EXISTS public.gmail_sync_tokens (
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
ALTER TABLE public.gmail_sync_tokens ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own gmail tokens"
    ON public.gmail_sync_tokens FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_gmail_sync_tokens_user_id ON public.gmail_sync_tokens(user_id);

-- Documentation
COMMENT ON TABLE public.gmail_sync_tokens IS 'Stores Google OAuth tokens specifically for Gmail integration on a per-user basis.';
