-- Migration for X (Twitter) Integration
-- Path: supabase/migrations/20260514180000_create_x_integrations.sql

CREATE TABLE IF NOT EXISTS public.x_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    x_user_id TEXT NOT NULL,
    x_username TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    scopes TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, x_user_id)
);

-- Enable RLS
ALTER TABLE public.x_integrations ENABLE ROW LEVEL SECURITY;

-- Policies
<<<<<<< HEAD
DROP POLICY IF EXISTS "Users can view their own tenant x integrations" ON public.x_integrations;
=======
>>>>>>> origin/main
CREATE POLICY "Users can view their own tenant x integrations"
    ON public.x_integrations FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    );

<<<<<<< HEAD
DROP POLICY IF EXISTS "Users can manage their own tenant x integrations" ON public.x_integrations;
=======
>>>>>>> origin/main
CREATE POLICY "Users can manage their own tenant x integrations"
    ON public.x_integrations FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_x_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

<<<<<<< HEAD
DROP TRIGGER IF EXISTS update_x_integrations_updated_at ON public.x_integrations;
=======
>>>>>>> origin/main
CREATE TRIGGER update_x_integrations_updated_at
    BEFORE UPDATE ON public.x_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_x_integrations_updated_at();
