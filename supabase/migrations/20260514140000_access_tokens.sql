-- Migration: Access Tokens for Secure Links
-- Description: Creates a table to manage short-lived (30-min) access tokens for emails.

CREATE TABLE IF NOT EXISTS public.access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL, -- 'welcome', 'login', 'invite'
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_access_tokens_token ON public.access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_access_tokens_expires_at ON public.access_tokens(expires_at);

-- RLS: Only service role or admin can manage tokens
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage access tokens" 
    ON public.access_tokens 
    USING (auth.jwt() ->> 'role' = 'service_role');
