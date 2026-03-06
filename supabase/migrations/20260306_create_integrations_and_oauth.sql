-- Create oauth_states table for secure OAuth flows
CREATE TABLE IF NOT EXISTS public.oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for cleanup of old states
CREATE INDEX IF NOT EXISTS idx_oauth_states_created_at ON public.oauth_states(created_at);

-- Create integrations table to store OAuth tokens and connection info
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, type)
);

-- Add RLS policies for integrations
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own integrations"
    ON public.integrations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrations"
    ON public.integrations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations"
    ON public.integrations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrations"
    ON public.integrations FOR DELETE
    USING (auth.uid() = user_id);

-- Add trigger for updated_at on integrations
CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_integrations_updated_at_trigger
    BEFORE UPDATE ON public.integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_integrations_updated_at();

-- Add RLS to oauth_states
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Allow users to read/delete their own state, insert their own state, but service role does the actual verification bypassing RLS mostly
CREATE POLICY "Users can manage their own oauth states"
    ON public.oauth_states FOR ALL
    USING (auth.uid() = user_id);
    
-- Ensure schema cache is reloaded
NOTIFY pgrst, 'reload schema';
